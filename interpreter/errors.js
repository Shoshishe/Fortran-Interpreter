/** @param {number} line */
/** @param {number} column */
/** @returns {Error} */
export class UnexpectedCharacter extends Error {
    constructor(char, line, column) {
        super()
        this.message = `Unexpected '${char}' character at line: ${line}, column: ${column}`
        this.name = 'Unexpected character'
    }
}
export class UnfinishedString extends Error {
    constructor(line, column) {
        super()
        this.message = `Unclosed string at line ${line}, column ${column}`
        this.name = 'Unfinished string'
    }
}

export class ParseError extends Error {
    constructor() {
        super()
    }
}