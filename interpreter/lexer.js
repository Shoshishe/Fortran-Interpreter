import fs from 'bun:fs'
import { UnexpectedCharacter, UnfinishedString } from './errors'
import { AstPrinter, AstTreePrinter } from './ast'
import { Parser } from './parser'
import { Chunk, OpCode } from './bytecode'
import { compile, interpret, vm } from './vm'
import { TypeChecker } from './type_checker'

/**
 * @readonly
 * @enum {string}
 */
export const TYPES = Object.freeze({
    IDENT: Symbol("ident"),
    STRING: Symbol("string"),
    NUMBER: Symbol("number"),
    FP_NUMBER: Symbol("fp_number"),
    TERMINATOR: Symbol(";"),

    COMMA: Symbol(","),
    MINUS: Symbol("-"),
    PLUS: Symbol("+"),
    ASTERISK: Symbol("*"),
    SLASH: Symbol("/"),
    LEFT_BRACE: Symbol("("),
    RIGHT_BRACE: Symbol(")"),
    EQUAL: Symbol("="),
    LESS: Symbol("<"),
    MORE: Symbol(">"),

    CONCAT: Symbol("//"),
    POW: Symbol('**'),
    DECLARATION: Symbol("::"),
    EQUAL_EQUAL: Symbol("=="),
    LESS_EQUAL: Symbol("<="),
    MORE_EQUAL: Symbol(">="),
    NOT_EQUAL: Symbol("/="),
    TRUE: Symbol('.true.'),
    FALSE: Symbol('.false.'),
    NOT: Symbol('.not.'),
    AND: Symbol('.and.'),
    XOR: Symbol('.neqv.'),
    OR: Symbol('.or.'),


    // IMPLICIT: Symbol('implicit'),
    // PROGRAM: Symbol('program'),
    // PROCEDURE: Symbol('procedure'),
    // NONE: Symbol('none'),
    // INTEGER: Symbol('integer'),
    // CHARACTER: Symbol('character'),
    // BOOLEAN: Symbol('boolean'),

    EOF: Symbol("eof")
})

export class Token {
    /** 
     * @param {Readonly<symbol>} type
     * @param {any} value
     * @param {number} line 
     */
    constructor(type, value, line) {
        this.type = type
        this.value = value
        this.line = line
    }
}

const keywords = new Map([
    [".eq.", TYPES.EQUAL],
    [".ne.", TYPES.NOT_EQUAL],
    [".lt.", TYPES.LESS],
    [".le.", TYPES.LESS_EQUAL],
    [".gt", TYPES.MORE],
    [".ge.", TYPES.MORE_EQUAL],
    ['.true.', TYPES.TRUE],
    ['.false.', TYPES.FALSE],
    ['.not.', TYPES.NOT],
    ['.or.', TYPES.MORE],
    ['.and.', TYPES.AND],
    ['.neqv.', TYPES.XOR],
    ['.or.', TYPES.OR]
])


export const Scanner = {
    line: 1,
    column: 1,
    start: 0,
    offset: 0,
    src: "",
    tokens: [],
    setData: function (src) {
        this.src = src
    },
    peek: function () {
        if (this.offset < this.src.length) {
            return this.src[this.offset]
        } else {
            return "\0"
        }
    },
    peekNext: function () {
        if (this.offset + 1 >= this.src.length) return '\0';
        return this.src[this.offset + 1];
    },
    lexAll: function () {
        while (!this.isAtEnd()) {
            this.start = this.offset;
            try {
                this.scanToken()
            } catch (e) {
                console.log(e)
            }
        }
        this.tokens.push(new Token(TYPES.EOF, ""))
    },
    addToken: function (TokenType, value, line) {
        if (value === undefined) {
            value = this.src.substring(this.start, this.offset).toLowerCase()
        }
        this.tokens.push(new Token(TokenType, value, this.line))
    },
    isAtEnd: function () { return this.offset >= this.src.length },
    isDigit: function (char) { return char >= '0' && char <= '9' },
    isSpace: function (char) { return char === '\n' || char === '\r' || char == " " || char == '\t' },
    isAlpha: function (char) { return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || char == '_' },
    isAlphaNum: function (char) { return this.isDigit(char) || this.isAlpha(char) },
    scanToken: function () {
        let c = this.advance();
        switch (c) {
            case '(':
                this.addToken(TYPES.LEFT_BRACE)
                break;
            case ')':
                this.addToken(TYPES.RIGHT_BRACE)
                break;
            case '.':
                this.dotLiterals();
                break;
            case ',':
                this.addToken(TYPES.COMMA)
                break;
            case '-':
                this.addToken(TYPES.MINUS)
                break;
            case '=':
                this.lookaheadOnce('=') ? this.addToken(TYPES.EQUAL_EQUAL) : this.addToken(TYPES.EQUAL)
                break;
            case '<':
                this.lookaheadOnce('=') ? this.addToken(TYPES.LESS_EQUAL) : this.addToken(TYPES.LESS)
                break;
            case '>':
                this.lookaheadOnce('=') ? this.addToken(TYPES.MORE_EQUAL) : this.addToken(TYPES.MORE)
                break;
            case '+':
                this.addToken(TYPES.PLUS)
                break;
            case '*':
                this.lookaheadOnce('*') ? this.addToken(TYPES.POW) : this.addToken(TYPES.ASTERISK)
                break;
            case ':':
                if (this.lookaheadOnce(':')) {
                    this.addToken(TYPES.DECLARATION)
                } else {
                    throw new UnexpectedCharacter(this.peekNext(), this.line, this.column)
                }
                break;
            case '!':
                while (this.peek() !== '\n') {
                    this.advance()
                }
                while ((this.peek() == '\n' || this.isSpace(this.peek())) && !this.isAtEnd()) {
                    if (this.peek() == '\n') {
                        this.line++
                    }
                    this.advance()
                }
                // while (this.peek() != '\n' && !this.isAtEnd()) { this.advance(); }
                // while (this.peek() == '\n' && !this.isAtEnd()) {
                //     this.line++
                //     this.advance()
                // }
                break;
            case '/':
                if (this.lookaheadOnce('=')) {
                    this.addToken(TYPES.NOT_EQUAL)
                } else if (this.lookaheadOnce('/')) {
                    this.addToken(TYPES.CONCAT)
                } else {
                    this.addToken(TYPES.SLASH)
                };
                break;
            case '"':
                this.string();
                break;
            case ' ':
            case '\r':
            case '\t':
                break;
            case '\n':
                this.addToken(TYPES.TERMINATOR, '\n')
                if (this.peek() == "\n") {
                    while (this.peekNext() == "\n") {
                        this.advance()
                        this.line++
                    }
                    this.advance();
                }
                this.line++;
                this.column = 1;
                break;
            default:
                if (this.isDigit(c)) {
                    this.number();
                } else if (this.isAlpha(c)) {
                    this.identifier()
                }
                else {
                    throw new UnexpectedCharacter(c, this.line, this.column);
                }
        }
    },
    advance: function () {
        this.column++;
        return this.src[this.offset++];
    },
    lookaheadOnce: function (expected) {
        if (this.isAtEnd()) { return false; }
        if (this.src[this.offset] != expected) {
            return false;
        }
        this.offset++;
        return true;
    },

    dotLiterals: function () {
        while (this.peek() != '.' && !this.isAtEnd()) {
            if (this.peek() == '\n') {
                throw new UnexpectedCharacter('\\n', this.line, this.start)
            }
            this.advance();
        }
        if (this.isAtEnd()) {
            throw new UnexpectedCharacter(this.src[this.start], this.line, this.start)
        }
        this.advance()
        let key = this.src.substring(this.start, this.offset)
        let value = keywords.get(key)
        if (value === undefined) {
            throw new UnexpectedCharacter(this.src[this.start], this.line, this.start)
        }
        this.addToken(value)
    },

    string: function () {
        while (this.peek() != '"' && !this.isAtEnd()) {
            if (this.peek() == '\n') {
                throw new UnfinishedString(this.line, this.column)
            }
            this.advance();
        }
        if (this.isAtEnd()) {
            console.log("Unterminated string")
        }
        this.advance()
        let value = `${this.src.substring(this.start + 1, this.offset - 1)}`
        this.addToken(TYPES.STRING, value)
    },

    number: function () {
        while (this.isDigit(this.peek())) {
            this.advance();
        }
        if (this.peek() == '.' && this.isDigit(this.peekNext())) {
            this.advance();
            while (this.isDigit(this.peek())) {
                this.advance();
            }
            this.addToken(TYPES.FP_NUMBER, parseFloat(this.src.substring(this.start, this.offset)))
        } else if (!this.isAlpha(this.peek())) {
            this.addToken(TYPES.NUMBER, parseInt(this.src.substring(this.start, this.offset), 10))
        } else {
            throw new UnexpectedCharacter(this.peek(), this.line, this.column)
        }
    },
    identifier: function () {
        while (this.isAlphaNum(this.peek())) {
            this.advance()
        }
        this.addToken(TYPES.IDENT)
    }
}

const filename = 'main.f90'

fs.readFile(filename, 'utf-8', (err, data) => {

    // let i = 1;
    // let table = `------LITERALS AND IDENTIFIERS-------\nID     | VALUE\n-------------------------------------\n`
    // for (let token of Scanner.tokens) {
    //     if (token.type === TYPES.IDENT || token.type === TYPES.STRING || token.type === TYPES.NUMBER ||
    //         token.type === TYPES.TRUE || token.type === TYPES.FALSE) {
    //         table += `${i}`.padEnd(7, " ")
    //         table += `|`
    //         table += `${token.value}`
    //         table += `\n`
    //         i++
    //     }
    // }
    // console.log(table)

    // i = 1;
    // let result = ""
    // for (let token of Scanner.tokens) {
    //     if (token.type === TYPES.IDENT) {
    //         result += `<ИД${i}>`
    //         i++
    //     } else {
    //         result += token.value
    //     }
    // }
    // console.log(result)

    // let expr = new BinaryExpression(new UnaryExpression(new Token(TYPES.MINUS, "-"), new Literal(123)), new Token(TYPES.ASTERISK, "*"),
    //     new BinaryExpression(
    //         new BinaryExpression(
    //             new Literal(2), new Token(TYPES.PLUS, "+"),
    //             new Literal(8)),
    //         new Token(TYPES.MINUS, "-"),
    //         new Literal(10))
    // );
    // console.log(new AstPrettyPrinter().print(expr))

    // let parser = new Parser(Scanner.tokens)
    // let ast = parser.parse()
    // if (!parser.hadError) {
    //     let typeChecker = new TypeChecker()
    //     // typeChecker.check(ast)
    //     console.log(new AstTreePrinter().print(ast))
    // }

    // chunk.DisassembleChunk("test_chunk")
    console.log(data)
    let res = interpret(filename)
    console.log(res.description)
})

// compile(filename)