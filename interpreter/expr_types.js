// @ts-check

import { Token } from "./lexer";

export class ExprVisitor {
    //VERY-VERY-HEAVY TODO
    /**
     * @param {Binary} expr
     */
    visitBinaryExpr(expr) { }
    /**
     * @param {Unary} expr
     */
    visitUnaryExpr(expr) { }

    /**
     * @param {Literal} expr
     */
    visitLiteral(expr) { }
    /**
     * @param {Grouping} expr
     */
    visitGroupingExpr(expr) { }

    /**
     * @param {ExprVar} expr
     */
    visitExprVar(expr) { }

    /**
     * @param {AssignExpression} expr
     */
    visitAssignExpr(expr) { }

    /**
     * @param {Call} expr
     */
    visitCallExpr(expr) { }

}

class Acceptor {
    /**
     * @param {ExprVisitor} _visitor
     */
    accept(_visitor) {
        throw new Error("Not implemented, you fool")
    }
}

export class Expression extends Acceptor {
    /**
     * @param {ExprVisitor} _visitor
     */
    accept(_visitor) {
        throw new Error("Not implemented, you fool")
    }
}

export class AssignExpression extends Expression {
    /**
     * @param {Expression} left
     * @param {Expression} value
     * @param {Token} equals
     */
    constructor(left, value, equals) {
        super()
        this.left = left
        this.expr = value
        this.equals = equals
    }
    /**
     * @param {ExprVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitAssignExpr(this)
    }
}

export class ExprVar extends Expression {
    /**
     * @param {Token} name
     */
    constructor(name) {
        super()
        this.name = name
    }
    /**
     * @param {ExprVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitExprVar(this)
    }
}

export class Call extends Expression {
    /**
     * @param {Token} paren
     * @param {ExprVar} callee
     * @param {Expression[]} args
     * @param {boolean} isIndexing
     */
    constructor(paren, callee, args, isIndexing = false) {
        super()
        this.paren = paren
        this.callee = callee
        this.args = args
        this.isIndexing = isIndexing
    }

    /**
     * @param {ExprVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitCallExpr(this)
    }
}


export class Binary extends Expression {
    /** 
     * @param {Expression} left
     * @param {Token} operator
     * @param {Expression} right
     */
    constructor(left, operator, right) {
        super()
        this.left = left;
        this.right = right;
        this.token = operator;
    }
    /**
     * @param {ExprVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitBinaryExpr(this)
    }
}


export class Unary extends Expression {
    /** 
     * @param {Token} operator
     * @param {Expression} right
     */
    constructor(operator, right) {
        super()
        this.operator = operator;
        this.right = right;
    }
    /**
     * @param {ExprVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitUnaryExpr(this)
    }
}
export class Literal extends Expression {
    /** 
     * @param {any} value
     * @param {number} line
     * @param {boolean} isFp
     */
    constructor(value, line, isFp=false) {
        super();
        this.value = value;
        this.line = line
        this.isFp = isFp
    }
    /**
     * @param {ExprVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitLiteral(this)
    }
}
export class Grouping extends Expression {
    /** 
     * @param {Expression} expr
     */
    constructor(expr) {
        super();
        this.expr = expr;
    }

    /**
     * @param {ExprVisitor} visitor
     */
    accept(visitor) {
        return visitor.visitGroupingExpr(this)
    }
}

