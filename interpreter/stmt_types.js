import { Expression, ExprVar, ExprVisitor } from "./expr_types";
import { Token, TYPES } from "./lexer";


export const Stmts = (C) => class extends StmtVisitor { }
export const Exprs = (C) => class extends ExprVisitor { }
export class StmtVisitor {
    /**
     * @param {Stmt} stmt
     */
    visitBlockStmt(stmt) { };

    /**
     * @param {StmtPrint} stmt
     */
    visitPrintStmt(stmt) { }

    /**
     * @param {StmtExpression} stmt
     */
    visitExpressionStmt(stmt) { }

    /**
     * @param {StmtVar} stmt
     */
    visitVarStmt(stmt) { }

    /**
     * @param {ProgramStmt} stmt
     */
    visitProgramStmt(stmt) { }

    /**
     * @param {StmtIf} stmt
     */
    visitIfStmt(stmt) { }

    /**
     * @param {StmtElseIf} stmt
     */
    visitElseIfStmt(stmt) { }

    /**
     * @param {StmtWhile} stmt
     */
    visitWhileStmt(stmt) { }

    /**
     * @param {Subroutine} stmt
     */
    visitSubroutineStmt(stmt) { }

    /**
     * @param {FunctionStmt} stmt
     */
    visitFunctionStmt(stmt) { }
}

export class Stmt {

    /**
     * @param {StmtVisitor} visitor
     */
    accept(visitor) { throw Error('not implemented'); };
}

export class Block extends Stmt {
    /**
     * @param {Array<Stmt>} stmts
     */
    constructor(stmts) {
        super();
        this.stmts = stmts;
    }

    /**
     * @param {StmtVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitBlockStmt(this)
    }
}

export class StmtExpression extends Stmt {
    /**
     * @param {Expression} expr
     */
    constructor(expr) {
        super()
        this.expr = expr;
    }
    /**
     * @param {StmtVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitExpressionStmt(this)
    }
}

export class ProgramStmt extends Stmt {
    /**
     * @param {string} name
     * @param {Block} block
     */
    constructor(name, block) {
        super()
        this.name = name;
        this.block = block;
    }
    /**
     * @param {StmtVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitProgramStmt(this)
    }
}

export class StmtPrint extends Stmt {
    /**
     * @param {Expression} expr
     * @param {number} line
     */
    constructor(expr, line) {
        super()
        this.expr = expr;
        this.line = line
    }
    /**
     * @param {StmtVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitPrintStmt(this)
    }
}

export class StmtWhile extends Stmt {
    /**
     * @param {Expression} condition
     * @param {Stmt[]} body
     */
    constructor(condition, body) {
        super()
        this.condition = condition;
        this.body = body
    }
    /**
     * @param {StmtVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitWhileStmt(this)
    }
}

export class StmtIf extends Stmt {
    /**
     * @param {Token} start
     * @param {Expression} condition
     * @param {Stmt[]} thenBranch
     * @param {StmtElseIf[]?} elseIfChain
     * @param {Stmt[]} elseBranch
     */
    constructor(start, condition, thenBranch, elseIfChain, elseBranch) {
        super();
        this.start = start
        this.condition = condition;
        this.thenBranch = thenBranch;
        this.elseIfChain = elseIfChain;
        this.elseBranch = elseBranch
    }
    /**
     * @param {StmtVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitIfStmt(this)
    }
}

export class StmtElseIf extends Stmt {
    /**
     * @param {Expression} condition
     * @param {Stmt[]} stmts
     */
    constructor(condition, stmts) {
        super();
        this.stmts = stmts;
        this.condition = condition
    }
    /**
     * @param {StmtVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitElseIfStmt(this)
    }
}

export const VAR_TYPES = Object.freeze({
    INT: Symbol("integer"),
    REAL: Symbol("real"),
    CHARACTER: Symbol("character"),
    BOOLEAN: Symbol("boolean"),
    SUBROUTINE: Symbol("subroutine")
})


export class Trait { }
export class Dimensions extends Trait {
    /**
     * @param {Token[]} sz
     */
    constructor(sz) {
        super()
        this.sizes = sz
    }
}
export class Precision extends Trait {
    /**
     * @param {number} precision
     */
    constructor(precision) {
        super()
        this.precision = precision
    }
}

export class StringLen extends Trait {
    /**
     * @param {number} len
     */
    constructor(len) {
        super()
        this.len = len
    }
}

export const IntentTypes = Object.freeze({
    IN: Symbol("in"),
    INOUT: Symbol("inout"),
    OUT: Symbol("out")
})

export class Intent extends Trait {
    /**
     * @param {Token} type 
     */
    constructor(type) {
        super()
        this.type = type
    }
}

export class StmtVar extends Stmt {
    /**
     * @param {Token} name
     * @param {Readonly<symbol>} type
     * @param {Expression?} initializer    
     * @param {Trait[]} traits
     */
    constructor(name, type, initializer, traits = []) {
        super()
        this.name = name
        this.initializer = initializer
        this.type = type
        this.traits = traits
    }
    /**
     * @param {StmtVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitVarStmt(this)
    }
}

export class Subroutine extends Stmt {
    /**
     * @param {Token} name
     * @param {Block} body
     * @param {Param[]} params
     */
    constructor(name, body, params) {
        super()
        this.name = name
        this.body = body
        this.params = params
    }
    /**
     * @param {StmtVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitSubroutineStmt(this)
    }
}

export class Param {
    /**
     * @param {Token} name 
     * @param {Readonly<symbol>} type 
     * @param {Trait[]} traits 
     */
    constructor(name, type = VAR_TYPES.REAL, traits) {
        this.name = name
        this.type = type
        this.traits = traits
    }
}
export class FunctionStmt extends Stmt {
    /**
     * @param {Token} name
     * @param {Block} body
     * @param {Param[]} params
     * @param {Param} output
     */
    constructor(name, body, params, output) {
        super()
        this.name = name
        this.body = body
        this.params = params
        this.output = output
    }
    /**
     * @param {StmtVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitFunctionStmt(this)
    }
}