import { Binary, Expression, ExprVar, Grouping, Literal, Unary, ExprVisitor, AssignExpression } from "./expr_types";
import { ProgramStmt, StmtElseIf, StmtExpression, StmtIf, StmtPrint, StmtVar, StmtWhile } from "./stmt_types";

export class AstPrinter extends ExprVisitor {
    indent = 0
    /** 
    @param {ExprVisitor} expr
     */
    print(expr) {
        return expr.accept(this)
    }

    /** 
     * @param {Binary} expr //JDJJSDJ
     * @returns {void}
     */

    visitBinaryExpr(expr) {
        return this.paranthesize(expr.token.value,
            expr.left, expr.right);
    }

    /** 
     * @param {Unary} expr 
     */
    visitUnaryExpr(expr) {
        return this.paranthesize(expr.operator.value, expr.right)
    }

    /** 
     * @param {Grouping} expr 
     */
    visitGroupingExpr(expr) {
        return this.paranthesize("group", expr.expr)
    }

    /** 
     * @param {Literal} literal 
     */
    visitLiteral(literal) {
        return literal.value
    }

    /** 
     * @param {StmtExpression} stmt 
     */
    visitExpressionStmt(stmt) {
        return stmt.expr.accept(this)
    }

    /** 
     * @param {StmtPrint} stmt 
     */
    visitPrintStmt(stmt) {
        return this.paranthesize("print", stmt.expr)
    }

    /** 
     * @param {ProgramStmt} stmt 
     */
    visitProgramStmt(stmt) {
        let res = `program ${stmt.name}\n`

        this.indent++
        for (let nested of stmt.stmts) {
            res += this.indentStr()+nested.accept(this)+"\n"
        }
        this.indent--
        //  this.paranthesize("program", ...stmt.stmts)
        res += `end program ${stmt.name}`
        return res
    }


    /** 
     * @param {StmtVar} stmt 
     */
    visitVarStmt(stmt) {
        return `${stmt.type.value} ${stmt.name} = ` + stmt.initializer.accept(this)
    }

    /** 
     * @param {ExprVar} expr 
     */
    visitExprVar(expr) {
        return expr.name.value
    }

    /** 
     * @param {StmtIf} stmt 
     */
    visitIfStmt(stmt) {
        let res = `if ${stmt.condition.accept(this)} then \n`
        this.indent++
        for (let nest of stmt.thenBranch) {
            res += this.indentStr() + nest.accept(this)+"\n"
        }
        this.indent--
        if (stmt.elseIfChain) {
            for (let nest of stmt.elseIfChain) {
                res += nest.accept(this)
            }
        }
        if (stmt.elseBranch) {
            res += this.indentStr() + "else\n"
            this.indent++
            for (let nest of stmt.elseBranch) {
                res += this.indentStr()+nest.accept(this)+"\n"
            }
            this.indent--
        }
        res += this.indentStr() + "end if"
        return res
    }

    /**
     * @param {StmtElseIf} stmt
     */
    visitElseIfStmt(stmt) {
        let res = this.indentStr() + `else if ${stmt.condition.accept(this)} then \n`
        this.indent++
        for (let nest of stmt.stmts) {
            res += this.indentStr() + nest.accept(this)+"\n"
        }
        this.indent--
        return res
    }

    /** 
     * @param {StmtWhile} stmt 
     */
    visitWhileStmt(stmt) {
        let res = `do while ${stmt.condition.accept(this)}\n`
        this.indent++
        for (let nest of stmt.body) {
            res += this.indentStr() + nest.accept(this)+"\n"
        }
        this.indent--
        res += this.indentStr()+"end do"
        return res
    }


    /** 
     * @param {AssignExpression} assign 
     */
    visitAssignExpr(assign) {
        return `${assign.name} = ${assign.expr.accept(this)}`
    }

    /** 
     * @param {string} name 
     * @param {...Expression} exprs
     */
    paranthesize(name, ...exprs) {
        let res = "".concat("(", name)
        for (let expr of exprs) {
            res = res.concat(" ", expr.accept(this))
        }
        res = res.concat(")")
        return res
    }
    /**
     * @returns {string}
     */
    indentStr() {
        let res = ""
        if (this.indent > 0) {
            res += '├'
        }
        return res + "──".repeat(this.indent)
    }
}

// export class AstPrettyPrinter extends ExprVisitor {
//     /** 
//      * @param {Binary} expr
//      * @returns {void}
//      */
//     level = 0;

//     /** 
//     @param {Expression} expr
//      */
//     print(expr) {
//         return expr.accept(this)
//     }
//     /** 
//      * @param {Binary} expr 
//      */
//     visitBinaryExpr(expr) {
//         let line = "".concat(expr.token.type.description)
//         this.level += 2
//         line = line.concat("\n├", "─".repeat(this.level - 1), expr.left.accept(this))
//         line = line.concat("\n├", "─".repeat(this.level - 1), expr.right.accept(this))
//         this.level -= 2;
//         return line
//     }

//     /** 
//      * @param {Unary} expr 
//      */
//     visitUnaryExpr(expr) {
//         return "".concat(expr.operator.type.description).concat(expr.right.accept(this))
//     }

//     /** 
//      * @param {Grouping} expr 
//      */
//     visitGroupingExpr(expr) {
//         return "".concat("(", expr.expr.accept(this), ")")
//     }

//     /** 
//      * @param {Literal} literal 
//      */
//     visitLiteral(literal) {
//         return "".concat(literal.value)
//     }
//     /** 
//      * @param {...Expression} exprs
//      */
//     paranthesize(...exprs) {
//         let res = "".concat("(")
//         for (let expr of exprs) {
//             res = res.concat(" ", expr.accept(this))
//         }
//         res = res.concat(")")
//         return res.concat("\n")
//     }
// }