import { Expression } from "./expr_types";
import { Token } from "./lexer";

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
     * @param {Array<Stmt>} stmts
     */
    constructor(name, stmts) {
        super()
        this.name = name;
        this.stmts = stmts;
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
     */
    constructor(expr) {
        super()
        this.expr = expr;
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
     * @param {Expression} condition
     * @param {Stmt[]} thenBranch
     * @param {StmtElseIf[]?} elseIfChain
     * @param {Stmt[]} elseBranch
     */
    constructor(condition, thenBranch, elseIfChain, elseBranch) {
        super();
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
    CHARACTER: Symbol("character")
})

export class StmtVar extends Stmt {
    /**
     * @param {string} name
     * @param {Token} type
     * @param {Expression} initializer
     */
    constructor(name, type, initializer) {
        super()
        this.name = name
        this.initializer = initializer
        this.type = type
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
     * @param {string} name
     * @param {Stmt[]} body
     * @param {Token[]} params
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