import { ParseError } from "./errors";
import { AssignExpression, Binary, Call, Expression, ExprVar, Grouping, Literal, Unary } from "./expr_types";
import { ProgramStmt, Stmt, StmtElseIf, StmtExpression, StmtIf, StmtPrint, StmtVar, StmtWhile, Subroutine } from "./stmt_types"
import { Token, TYPES } from "./lexer"

const STATES = Object.freeze({
    UnitStart: Symbol("start"),
    Specification: Symbol("specification"),
    Execution: Symbol("execution")
})

export class Parser {
    current = 0;
    state = STATES.UnitStart
    /**
     * @param {Token[]} tokens
     */
    constructor(tokens) {
        this.tokens = tokens
    }

    /**
     * @returns {Expression?}
     */
    parse() {
        try {
            return this.main()
        } catch (err) {
            return null;
        }
    }

    /**
     * @returns {Expression}
     */
    main() {
        try {
            let returned = this.declaration()
            return returned
        } catch (err) {
            return null;
        }
    }

    /**
     * @returns {Stmt}
     */
    declaration() {
        try {
            if (this.check(TYPES.IDENT) && isVariableType(this.peek().value)) {
                if (this.state != STATES.Specification) {
                    this.error(this.peek(), "Expected 0 declarations after specification part")
                }
                return this.typedDeclaration()
            } else if (this.check(TYPES.IDENT) && this.peek().value == "subroutine") {
                this.advance()
                return this.subroutine()
            } else if (this.check(TYPES.IDENT) && this.peek().value == "function") {
                this.advance()
                return this.function()
            }
            return this.statement()
        } catch (err) {
            this.synchronize();
            return null;
        }
    }

    /**
     * @returns {Stmt}
     */
    typedDeclaration() {
        let type = this.consume(TYPES.IDENT, "Expected a type name in declaration")
        this.consume(TYPES.DECLARATION, "Expected '::' token after a type")

        let name = this.consume(TYPES.IDENT, "Expected a variable name")
        let initializer = null;
        if (this.match(TYPES.EQUAL)) {
            initializer = this.expression();
        }
        this.consume(TYPES.TERMINATOR, "Expected '\\n' after a variable declaration");
        return new StmtVar(name.value, type, initializer);
    }

    /**
     * @returns {Stmt}
     */
    subroutine() {
        let subroutineName = this.consume(TYPES.IDENT, "Expected subroutine name after subroutine keyword")
        this.consume(TYPES.LEFT_BRACE, `Expected '(' after subroutine name`)
        let params = []
        if (!this.check(TYPES.RIGHT_BRACE)) {
            do {
                if (params.length >= 255) {
                    this.error(this.peek(), "Can't have more than 255 parameters.")
                }
                params.push(this.consume(TYPES.IDENT, "expected param name"));
            } while (this.match(TYPES.COMMA))
        }
        this.consume(TYPES.RIGHT_BRACE, "Expected ')' after parameters declaration")
        let stmts = []
        while (!this.checkTwoNames("end", "subroutine")) {
            stmts.push(this.statement())
        }
        this.consume(TYPES.IDENT, "Expected end keyword after subroutine declaration")
        this.consume(TYPES.IDENT, "Expected subroutine keyword after end during subroutine declaration")
        let closingName = this.consume(TYPES.IDENT, "Expected to get subroutine name after end subroutine statement")
        if (closingName != subroutineName) {
            this.error(this.peek(), `Expected subroutine name ${subroutineName} to match name ${closingName} after end subroutine statement`)
        }
        return new Subroutine()
    }

    /**
     * @returns {Stmt}
     */
    statement() {
        if (this.matchKeyword("print")) { this.state = STATES.Execution; return this.printStatement(); }
        if (this.matchKeyword("program")) { this.state = STATES.Execution; return this.programStatement(); }
        if (this.matchKeyword("if")) { this.state = STATES.Execution; return this.ifStatement() }
        if (this.matchKeyword("do")) { this.state = STATES.Execution; return this.whileStatement() }
        return this.expressionStatement();
    }

    /**
     * @returns {Array<Stmt>}
     */
    programStatement() {
        let name = this.consume(TYPES.IDENT, "Expected program %ident% declaration")
        this.consume(TYPES.TERMINATOR, 'Expected newline after program decl statement')
        let statements = []
        this.state = STATES.Specification
        while (!this.checkTwoNames("end", "program")) {
            statements.push(this.declaration())
        }
        if (!this.matchKeyword("end")) {
            this.error(this.peek(), "Expected end program statement at while loop")
        }
        if (!this.matchKeyword("program")) {
            this.error(this.peek(), "Expected end program %ident%")
        }
        let closingName = this.peek()
        if (closingName.type != TYPES.IDENT || closingName.value != name.value) {
            this.error(closingName, "Expected end program %ident%, matching start decl")
        }
        this.state = STATES.UnitStart
        return new ProgramStmt(name.value, statements)
    }

    /**
     * @returns {Stmt}
     */
    printStatement() {
        if (this.match(TYPES.ASTERISK) || this.match(TYPES.STRING)) { return this.printStatement(); }
        this.consume(TYPES.COMMA, "Expected , after print keyword")
        let expr = this.expression();
        this.consume(TYPES.TERMINATOR, "Expected '\\n' after print statement")
        return new StmtPrint(expr);
    }

    /**
     * @returns {StmtIf}
     */
    ifStatement() {
        this.consume(TYPES.LEFT_BRACE, "Expected '(' after 'if'.")
        let condition = this.expression()
        this.consume(TYPES.RIGHT_BRACE, "Expected ')' after if condition")
        if (!this.matchKeyword("then")) {
            this.error(this.peek(), "Expected then keyword after if condition")
        }
        this.consume(TYPES.TERMINATOR, "Expected newline after then clause")

        let thenBranch = [];
        let elseBranch = [];
        let elseIfChain = [];
        while (!this.checkKeyword("else") && !this.checkTwoNames("end", "if")) {
            thenBranch.push(this.statement())
        }
        while (this.matchKeyword("else")) {
            if (this.matchKeyword("if")) {
                elseIfChain.push(this.elseIfStatement())
            } else {
                this.consume(TYPES.TERMINATOR, "Expected new line after else clause")
                while (!this.checkTwoNames("end", "if")) {
                    elseBranch.push(this.statement())
                }
            }
        }

        if (!this.matchKeyword("end")) {
            this.error(this.peek(), "Expected end after if declaration")
        }
        if (!this.matchKeyword("if")) {
            this.error(this.peek(), "Expected end if after if declaration")
        }
        this.consume(TYPES.TERMINATOR, "Expected new line after ending if statement")
        return new StmtIf(condition, thenBranch, elseIfChain, elseBranch)
    }

    /**
     * @returns {StmtElseIf}
     */
    elseIfStatement() {
        let statements = []
        this.consume(TYPES.LEFT_BRACE, "Expected '(' after 'else if'")
        let condition = this.expression()
        this.consume(TYPES.RIGHT_BRACE, "Expected ')' after else if condition")
        if (!this.matchKeyword("then")) {
            this.error(this.peek(), "Expected then keyword after else if condition")
        }
        this.consume(TYPES.TERMINATOR, "Expected newline after then clause in else if")
        while (!(this.checkKeyword("else") || this.checkKeyword("end"))) {
            statements.push(this.statement())
        }
        return new StmtElseIf(condition, statements)
    }

    /**
     * @returns {StmtWhile}
     */
    whileStatement() {
        if (!this.matchKeyword("while")) {
            this.error(this.peek(), "Expected while keyword after do")
        }

        this.consume(TYPES.LEFT_BRACE, "Expected '(' after do while clause")
        let condition = this.expression()
        this.consume(TYPES.RIGHT_BRACE, "Expected ')' after condition")
        this.consume(TYPES.TERMINATOR, "Expected newline after parentheses")
        let body = []
        while (!this.checkTwoNames("end", "do")) {
            body.push(this.statement())
        }
        this.consume(TYPES.IDENT, "Expected end keyword after do while clause to be token of ident type")
        this.consume(TYPES.IDENT, "Expected do keyword after do while end... to be token of ident type ")
        this.consume(TYPES.TERMINATOR, "Expected newline after do while statement termination")
        return new StmtWhile(condition, body)
    }

    /**
     * @returns {Stmt}
     */
    expressionStatement() {
        let expr = this.expression()
        this.consume(TYPES.TERMINATOR, "Expected '\\n' after expression")
        return new StmtExpression(expr)
    }

    /**
     * @returns {Expression}
     */
    expression() {
        return this.assignment();
    }

    /**
     * @returns {Expression}
     */
    assignment() {
        let expr = this.logicOr();
        if (this.match(TYPES.EQUAL)) {
            this.state = STATES.Execution
            let equals = this.previous();
            let value = this.assignment();

            if (expr instanceof ExprVar) {
                let name = expr.name;
                return new AssignExpression(name, value);
            }
            this.error(equals, "Invalid assignment target.");
        }
        return expr;
    }

    /**
     * @returns {Expression}
     */
    logicOr() {
        let expr = this.logicAnd()
        while (this.match(TYPES.OR)) {
            let operator = this.previous();
            let right = this.equality()
            expr = new Binary(expr, operator, right)
        }
        return expr
    }

    /**
     * @returns {Expression}
     */
    logicAnd() {
        let expr = this.equality()
        while (this.match(TYPES.AND)) {
            let operator = this.previous();
            let right = this.logicAnd()
            expr = new Binary(expr, operator, right)
        }
        return expr
    }

    /**
     * @returns {Expression}
     */
    equality() {
        let expr = this.comparison();
        while (this.match(TYPES.EQUAL, TYPES.EQUAL_EQUAL)) {
            let operator = this.previous();
            let right = this.comparison();
            expr = new Binary(expr, operator, right);
        }
        return expr
    }
    /**
     * @returns {Expression}
     */
    comparison() {
        let expr = this.term();
        while (this.match(TYPES.MORE, TYPES.MORE_EQUAL, TYPES.LESS, TYPES.LESS_EQUAL)) {
            let operator = this.previous()
            let right = this.term();
            expr = new Binary(expr, operator, right)
        }
        return expr
    }
    /**
     * @returns {Expression}
     */
    term() {
        let expr = this.factor();
        while (this.match(TYPES.MINUS, TYPES.PLUS)) {
            let operator = this.previous();
            let right = this.factor();
            expr = new Binary(expr, operator, right)
        }
        return expr
    }
    /**
     * @returns {Expression}
     */
    factor() {
        let expr = this.power();
        while (this.match(TYPES.ASTERISK, TYPES.SLASH)) {
            let operator = this.previous();
            let right = this.power();
            expr = new Binary(expr, operator, right)
        }
        return expr
    }
    /**
     * @returns {Expression}
     */
    power() {
        let expr = this.unary();
        while (this.match(TYPES.POW)) {
            let operator = this.previous()
            let right = this.unary();
            expr = new Binary(expr, operator, right)
        }
        return expr
    }
    /**
     * @returns {Expression}
     */
    unary() {
        if (this.match(TYPES.MINUS, TYPES.PLUS, TYPES.NOT)) {
            let operator = this.previous();
            let right = this.unary();
            return new Unary(operator, right)
        }
        return this.primary();
    }
    /**
     * @returns {Expression}
     */
    primary() {
        if (this.match(TYPES.FALSE)) { return new Literal(false) }
        if (this.match(TYPES.TRUE)) { return new Literal(true) }
        if (this.match(TYPES.NUMBER, TYPES.STRING)) { return new Literal(this.previous().value) }
        if (this.match(TYPES.IDENT)) {
            return new ExprVar(this.previous());
        }
        if (this.match(TYPES.LEFT_BRACE)) {
            let expr = this.expression()
            this.consume(TYPES.RIGHT_BRACE, "Expected ')' after expression.")
            return new Grouping(expr);
        }

        throw this.error(this.peek(), "Expected expression.");
    }

    /**
     * @returns {Expression}
     */
    call() {
        let expr = this.primary()
        while (true) {
            if (this.match(TYPES.LEFT_BRACE)) {
                expr = this.finishCall(expr)
            } else {
                break;
            }
        }
        return expr
    }

    /**
     * @param {Expression} callee
     * @returns {Call}
     */
    finishCall(callee) {
        let args = [];
        if (!this.check(TYPES.RIGHT_BRACE)) {
            do {
                if (args.length >= 255) {
                    this.error(this.peek(), "Can't have more than 255 arguments to a subroutine/function")
                }
                args.push(this.expression())
            } while (this.match(TYPES.COMMA))
        }
        let brace = this.consume(TYPES.RIGHT_BRACE, "Expected ')' after arguments list");
        return new Call(brace, callee, args)
    }

    error(token, message) {
        this.logError(token, message);
        return new ParseError();
    }
    /**
     * @param {Token} token
     * @param {string} message 
     */
    logError(token, message) {
        if (token.type == TYPES.EOF) {
            console.log("".concat(token.line, " at end", message))
        } else {
            console.log(`Line ${token.line} at '${token.value}', ${message}`.replace('\n', '\\n'))
        }
    }
    /**
     * @param {Token} type 
     * @param {string} message
     * @returns {Token}
     */
    consume(type, message) {
        if (this.check(type)) { return this.advance(); }
        throw Error(this.peek(), message)
    }

    /**
     * @param {...Token} types 
     * @returns {boolean}
     */
    match(...types) {
        for (let type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    /**
     * @param {string} keyword 
     * @returns {boolean}
     */
    matchKeyword(keyword) {
        if (this.isAtEnd()) {
            return false
        }
        if (this.peek().type == TYPES.IDENT && this.peek().value == keyword) {
            this.advance();
            return true;
        }
        return false;
    }

    /**
     * @returns {Token}
     */
    advance() {
        if (!this.isAtEnd()) { this.current++ }
        return this.previous()
    }
    /**
     * @param {Token} type 
     * @returns {boolean}
     */
    check(type) {
        if (this.isAtEnd()) { return false; }
        return this.peek().type == type
    }

    /**
     * @param {string} name 
     * @returns {boolean}
     */
    checkKeyword(name) {
        if (this.isAtEnd()) { return false; }
        return this.peek().type == TYPES.IDENT && this.peek().value == name
    }

    /**
     * @param {string} first
     * @param {string} second
     * @returns {boolean}
     */
    checkTwoNames(first, second) {
        if (this.current > this.tokens.length - 2) {
            return true
        }

        return this.peek().value == first && this.peek().type == TYPES.IDENT && this.next().value == second && this.next().type == TYPES.IDENT
    }


    /**
     * @returns {boolean}
     */
    isAtEnd() {
        return this.peek().type == TYPES.EOF;
    }

    /**
     * @returns {Token}
     */
    peek() {
        return this.tokens[this.current];
    }
    /**
     * @returns {Token}
     */
    next() {
        if (this.isAtEnd()) { return this.tokens[this.tokens.length - 1] }
        return this.tokens[this.current + 1];
    }
    /**
     * @returns {Token}
     */
    previous() {
        return this.tokens[this.current - 1];
    }

    synchronize() {
        this.advance()
        while (!this.isAtEnd()) {
            if (this.previous().type == TYPES.TERMINATOR) { return };
            switch (this.peek().type) {
                case TYPES.DECLARATION:
                case TYPES.TERMINATOR:
                    //mb some others?   
                    return
            }
            this.advance();
        }
    }
}

/**
 * @param {string} value 
 * @returns {boolean}
 */
function isVariableType(value) {
    return value === "integer" || value === "character" || value === "logical" || value === "real" || value == "complex"
}