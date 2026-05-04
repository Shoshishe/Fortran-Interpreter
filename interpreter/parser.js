import { ParseError } from "./errors";
import { AssignExpression, Binary, Call, Expression, ExprVar, Grouping, Literal, Unary } from "./expr_types";
import { Block, Dimensions, FunctionStmt, Intent, IntentTypes, Param, Precision, ProgramStmt, Stmt, StmtElseIf, StmtExpression, StmtIf, StmtPrint, StmtVar, StmtWhile, StringLen, Subroutine, Trait, VAR_TYPES } from "./stmt_types"
import { Token, TYPES } from "./lexer"

const STATES = Object.freeze({
    UnitStart: Symbol("start"),
    Specification: Symbol("specification"),
    Execution: Symbol("execution")
})

export class Parser {
    current = 0;
    state = STATES.UnitStart
    hadError = false
    /**
     * @param {Token[]} tokens
     */
    constructor(tokens) {
        this.tokens = tokens
    }

    /**
     * @returns {Stmt[]}
     */
    parse() {
        let res = []
        try {
            while (!this.isAtEnd()) {
                res.push(this.main())
            }
            return res
        } catch (err) {
            return null;
        }
    }

    /**
     * @returns {Stmt}
     */
    main() {
        try {
            let returned = this.declaration()
            if (returned instanceof StmtVar) {
                if (returned.traits.some(e => e instanceof Intent)) {
                    let invalidIntent = returned.traits.find(e => e instanceof Intent)
                    this.error(invalidIntent.type, "Cannot declare intents outside of function blocks")
                }
            }
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
                if (this.state === STATES.Execution) {
                    this.error(this.peek(), "Expected no variable declarations in executions part")
                } else if (this.state === STATES.UnitStart) {
                    this.error(this.peek(), "Expected no variable declarations in global scope")
                }
                let returned = this.typedDeclaration()
                if (returned instanceof StmtVar) {
                    if (returned.traits.some(e => e instanceof Intent)) {
                        let invalidIntent = returned.traits.find(e => e instanceof Intent)
                        this.error(invalidIntent.type, "Cannot declare intents outside of function blocks")
                    }
                }
                return returned
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
        let traits = []
        if (this.peek().type == TYPES.LEFT_BRACE) {
            this.consume(TYPES.LEFT_BRACE)
            let traitName = this.consume(TYPES.IDENT, "Expected trait name during declaration")
            this.consume(TYPES.EQUAL, "Expected equal durng trait name initialization")
            let sz = this.consume(TYPES.NUMBER, "Expected size to be of a number type")
            this.consume(TYPES.RIGHT_BRACE, "Expected right brace during array size declaration")
            traits.push(new StringLen(sz.value))
        }

        while (this.match(TYPES.COMMA)) {
            traits.push(this.trait())
        }
        this.consume(TYPES.DECLARATION, "Expected '::' token after a type")

        let name = this.consume(TYPES.IDENT, "Expected a variable name")
        if (this.match(TYPES.LEFT_BRACE)) {
            traits.push(this.arrayDims())
        }

        let initializer = null
        if (this.match(TYPES.EQUAL)) {
            initializer = this.expression();
        }

        if (this.peek().type == TYPES.LEFT_BRACE) {
            this.consume(TYPES.LEFT_BRACE)
            let sizes = []
            do {
                let size = this.consume(TYPES.NUMBER, "Expected number during array size declaration")
                sizes.push(size)
            } while (this.match(TYPES.COMMA))
            this.consume(TYPES.RIGHT_BRACE, "Expected right brace during array size declaration")
            let sizesTrait = traits.find(e => e instanceof Dimensions)
            sizesTrait !== undefined ? sizesTrait.sizes.push(...sizes) : traits.push(new Dimensions(sizes))
        }

        this.consume(TYPES.TERMINATOR, "Expected '\\n' after a variable declaration");
        return new StmtVar(name, this._identToType(type), initializer, traits);
    }

    /**
     * @param {Token} ident 
     * @returns {Readonly<symbol>}
     */
    _identToType(ident) {
        switch (ident.value) {
            case "integer": return VAR_TYPES.INT
            case "logical": return VAR_TYPES.BOOLEAN
            case "real": return VAR_TYPES.REAL
            case "character": return VAR_TYPES.CHARACTER
            case "subroutine": return VAR_TYPES.SUBROUTINE
        }
    }
    /**
     * @returns {Trait}
     */
    trait() {
        if (this.matchKeyword("dimension")) {
            this.consume(TYPES.LEFT_BRACE, "Expected left brace in dimension declaration")
            return this.arrayDims()
        } else if (this.match(TYPES.LEFT_BRACE)) {
            this.consumeKeyword("kind", "Expected kind parameter when declaring trait")
            this.consume(TYPES.EQUAL, "Expected asignment operator when specifying kind")
            let prec = this.consume(TYPES.NUMBER, "Expected integer when specifying precision")
            this.consume(TYPES.RIGHT_BRACE, "Expected right brace to terminate dimension declaration")
            return new Precision(prec)
        } else if (this.matchKeyword("intent")) {
            this.consume(TYPES.LEFT_BRACE, "Expected left brace after intent declaration")
            let intent = this.consume(TYPES.IDENT, "Expected identifier to specify intent")
            let type = Object.values(IntentTypes).find(item => item.description == intent)
            if (type === undefined) {
                this.error(intent, "Expected intent value to be type of in/inout/out")
            }
            this.consume(TYPES.RIGHT_BRACE, "Expected right brace after specifying intent")
            return new Intent(intent)
        }
        this.error(this.peek(), "Expected trait specialization")
        return undefined
    }

    /**
     * @returns {Dimensions}
     */
    arrayDims() {
        let dims = []
        do {
            let dim = this.consume(TYPES.NUMBER, "Expected at least one integer parameter to dimension trait")
            dims.push(dim)
        } while (this.match(TYPES.COMMA))
        this.consume(TYPES.RIGHT_BRACE, "Expected right brace after dimension declarations")
        return new Dimensions(dims)
    }
    /**
     * @returns {Subroutine}
     */
    subroutine() {
        this.state = STATES.Specification
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
        this.consume(TYPES.TERMINATOR)
        let stmts = []
        while (!this.checkTwoNames("end", "subroutine")) {
            stmts.push(this.declaration())
        }
        this.consume(TYPES.IDENT, "Expected end keyword after subroutine declaration")
        this.consume(TYPES.IDENT, "Expected subroutine keyword after end during subroutine declaration")
        let closingName = this.peek()
        if (closingName.type == TYPES.IDENT && closingName.value == subroutineName.value) {
            this.consume(TYPES.IDENT)
        }
        this.consume(TYPES.TERMINATOR, "Expected \n after newline declaration")

        /**
         * @type {Map<string, Param>}
         */
        let typedParams = new Map()
        for (let param of params) {
            typedParams.set(param.value, new Param(param, VAR_TYPES.REAL, [IntentTypes.IN]))
        }
        for (let stmt of stmts) {
            if (stmt instanceof StmtVar) {
                let nonTypedParam = params.find(p => p.value === stmt.name.value)
                if (nonTypedParam !== undefined) {
                    typedParams.set(nonTypedParam.value, new Param(nonTypedParam, stmt.type, stmt.traits))
                }
            }
        }
        this.state = STATES.UnitStart
        return new Subroutine(subroutineName, new Block(stmts), [...typedParams.values()])
    }

    /**
     * @returns {FunctionStmt}
     */
    function() {
        this.state = STATES.Specification
        let functionName = this.consume(TYPES.IDENT, "Expected function name after function keyword")
        this.consume(TYPES.LEFT_BRACE, `Expected '(' after subroutine name`)

        /**
         * @type {Token[]}
         */
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
        this.consumeKeyword("output", "Expected output keyword after function instantination")

        this.consume(TYPES.LEFT_BRACE, "Expected left brace during function output declaration")
        let output = this.consume(TYPES.IDENT, "Expected ident to be function output value")
        this.consume(TYPES.RIGHT_BRACE, "Expected right brace to finish function output declaration")
        this.consume(TYPES.TERMINATOR)

        let stmts = []
        while (!this.checkTwoNames("end", "function")) {
            stmts.push(this.declaration())
        }
        this.consume(TYPES.IDENT, "Expected end keyword after subroutine declaration")
        this.consume(TYPES.IDENT, "Expected subroutine keyword after end during subroutine declaration")
        let closingName = this.peek()
        if (closingName.type == TYPES.IDENT && closingName.value == functionName.value) {
            this.consume(TYPES.IDENT)
        }
        this.consume(TYPES.TERMINATOR, "Expected \n after newline declaration")

        /**
         * @type {Map<string, Param>}
         */
        let typedParams = new Map()
        for (let param of params) {
            typedParams.set(param.value, new Param(param, VAR_TYPES.REAL, [IntentTypes.IN]))
        }
        let typedOutput = new Param(output.name, VAR_TYPES.REAL)
        for (let stmt of stmts) {
            if (stmt instanceof StmtVar) {
                let nonTypedParam = params.find(p => p.value === stmt.name.value)
                if (nonTypedParam !== undefined) {
                    typedParams.set(nonTypedParam.value, new Param(nonTypedParam, stmt.type, stmt.traits))
                } else if (stmt.name.value === output.value) {
                    typedOutput = new Param(output, stmt.type, stmt.traits)
                }
            }
        }
        this.state = STATES.UnitStart
        return new FunctionStmt(functionName, new Block(stmts), typedParams, typedOutput)
    }

    /**
     * @returns {Stmt}
     */
    statement() {
        if (this.matchKeyword("print")) { this.state = STATES.Execution; return this.printStatement(); }
        if (this.matchKeyword("program")) { this.state = STATES.Execution; return this.programStatement(); }
        if (this.matchKeyword("if")) { this.state = STATES.Execution; return this.ifStatement() }
        if (this.matchKeyword("do")) {
            this.state = STATES.Execution;
            if (this.next().type != TYPES.EQUAL) {
                return this.whileStatement()
            } else {
                return this.forStatement()
            }
        }
        if (this.matchKeyword("call")) {
            this.state = STATES.Execution; let returned = this.call();
            this.consume(TYPES.TERMINATOR, "Expected terminator after calling a subroutine")
            return returned
        }
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
        if (closingName.type == TYPES.IDENT && closingName.value == name.value) {
            this.consume(TYPES.IDENT)
        }
        this.state = STATES.UnitStart
        return new ProgramStmt(name.value, new Block(statements))
    }

    /**
     * @returns {Stmt}
     */
    printStatement() {
        let printKv = this.previous()
        if (this.match(TYPES.ASTERISK) || this.match(TYPES.STRING)) { return this.printStatement(); }
        this.consume(TYPES.COMMA, "Expected , after print keyword")
        let expr = this.expression();
        this.consume(TYPES.TERMINATOR, "Expected '\\n' after print statement")
        return new StmtPrint(expr, printKv.line);
    }

    /**
     * @returns {StmtIf}
     */
    ifStatement() {
        let start = this.consume(TYPES.LEFT_BRACE, "Expected '(' after 'if'.")
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
        return new StmtIf(start, condition, thenBranch, elseIfChain, elseBranch)
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
     * @returns {Stmt[]}
     */
    forStatement() {
        let ident = this.consume(TYPES.IDENT, "Expected ident in a do loop clause")
        let equals = this.consume(TYPES.EQUAL, "Expected equal token in a do loop")
        let start = this.consume(TYPES.NUMBER, "Expected integer in a start of do loop clause")

        this.consume(TYPES.COMMA, "Expected comma in i..j clause in a do loop")
        let end = this.consume(TYPES.NUMBER, "Expected integer at end of do loop clause")
        this.consume(TYPES.TERMINATOR, "Expected statement termination after for loop ranging")

        let body = []
        while (!this.checkTwoNames("end", "do")) {
            body.push(this.statement())
        }

        this.consume(TYPES.IDENT, "Expected end keyword after do while clause to be token of ident type")
        this.consume(TYPES.IDENT, "Expected do keyword after do while end... to be token of ident type ")
        this.consume(TYPES.TERMINATOR, "Expected newline after do while statement termination")

        let initializer = new StmtVar(ident, VAR_TYPES.INT, new Literal(start.value, ident.line))
        let plusToken = new Token(TYPES.PLUS, "+", 0)
        let increment = new AssignExpression(new ExprVar(ident), new Binary(new ExprVar(ident), plusToken, new Literal(1, ident.line)), equals)
        body = body.concat(new StmtExpression(increment))

        let condition = new Binary(new ExprVar(ident), new Token(TYPES.LESS_EQUAL, "<=", 0), new Literal(end.value, ident.line))
        return new Block([initializer, new StmtWhile(condition, body)])
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
            // let name = expr.name;
            return new AssignExpression(expr, value, equals);
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
        while (this.match(TYPES.NOT_EQUAL, TYPES.EQUAL_EQUAL)) {
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
        return this.call();
    }
    /**
     * @returns {Expression}
     */
    primary() {
        /**
         * @type {Token}
         */
        if (this.match(TYPES.FALSE)) { return new Literal(false, this.previous().line) }
        if (this.match(TYPES.TRUE)) { return new Literal(true, this.previous().line) }
        if (this.match(TYPES.NUMBER, TYPES.STRING)) { return new Literal(this.previous().value, this.previous().line) }
        if (this.match(TYPES.FP_NUMBER)) { return new Literal(this.previous().value, this.previous().line, true) }
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
        this.hadError = true
        this.logError(token, message);
        return new ParseError();
    }
    /**
     * @param {Token} token
     * @param {string} message 
     */
    logError(token, message) {
        if (token.type == TYPES.EOF) {
            console.error("".concat(token.line, " at end", message))
        } else {
            console.error(`Line ${token.line} at '${token.value}', ${message}`.replace('\n', '\\n'))
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
     * @param {string} name 
     * @param {string} message
     * @returns {Token}
     */
    consumeKeyword(name, message) {
        if (this.checkKeyword(name)) { return this.advance(); }
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
    twiceNext() {
        if (this.current > this.tokens.length - 2) { return this.tokens[this.tokens.length - 1] }
        return this.tokens[this.current + 2];
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