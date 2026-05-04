import { Binary, Expression, ExprVar, Grouping, Literal, Unary, ExprVisitor, AssignExpression, Call } from "./expr_types";
import { Token } from "./lexer";
import { Block, Dimensions, FunctionStmt, Intent, Precision, ProgramStmt, Stmt, StmtElseIf, StmtExpression, StmtIf, StmtPrint, StmtVar, StmtVisitor, StmtWhile, Subroutine } from "./stmt_types";

export class Node {
    /** 
     * @param {string} value
     * @param {Node[]} nodes
     */
    constructor(value, nodes) {
        this.nodes = nodes
        this.value = value
    }
}

export class TreeBuilder extends ExprVisitor {
    i = 0;
    visitBinaryExpr(expr) {
        this.i++
        return new Node(`n_${this.i}`, [expr.left.accept(this), new Node(expr.token.value), expr.right.accept(this)])
        // return this.paranthesize(expr.token.value,
        //     expr.left, expr.right);
    }

    /** 
     * @param {Unary} expr 
     */
    visitUnaryExpr(expr) {
        this.i++
        return new Node(`n_${this.i}`, [new Node(expr.operator.value), expr.right.accept(this)])
    }

    /** 
     * @param {Grouping} expr 
     */
    visitGroupingExpr(expr) {
        this.i++
        return new Node(`n_${this.i}`, [new Node('('), expr.accept(this), new Node(')')])
    }

    /** 
     * @param {Literal} literal 
     */
    visitLiteral(literal) {
        return new Node(literal.value)
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
        return new Node(`program ${stmt.name}`, stmt.block.stmts.map(n => n.accept(this)))
    }

    /** 
     * @param {StmtVar} stmt 
     */
    visitVarStmt(stmt) {
        this.i++
        return new Node(`n_${this.i}`, [new Node(stmt.type.value), new Node(stmt.name), stmt.initializer.accept(this)])
    }

    // /** 
    //  * @param {ExprVar} expr 
    //  */
    // visitExprVar(expr) {
    //     return expr.accept(this)
    // }

    /** 
     * @param {StmtIf} stmt 
     */
    visitIfStmt(stmt) {
        let elseIfNode = Node("else if", stmt.elseIfChain.map(c => c.accept(this)))
        let elseNode = Node("else", stmt.elseBranch.map(c => c.accept(this)))
        return new Node("if", stmt.condition.accept(this), new Node("then", stmt.thenBranch.map(s => s.accept(this))), elseIfNode, elseNode)
    }

    /**
     * @param {StmtElseIf} stmt
     */
    visitElseIfStmt(stmt) {
        let elseIfNode = Node("else if", stmt.condition.accept(this))
        return new Node("else if", elseIfNode, stmt.stmts.map(c => c.accept(this)))
    }

    /** 
     * @param {StmtWhile} stmt 
     */
    visitWhileStmt(stmt) {

        let res = `do while ${stmt.condition.accept(this)}\n`
        this.indent++
        for (let nest of stmt.body) {
            res += this.indentStr() + nest.accept(this) + "\n"
        }
        this.indent--
        res += this.indentStr() + "end do"
        return res
    }


    /** 
     * @param {AssignExpression} assign 
     */
    visitAssignExpr(assign) {
        this.i++
        return new Node(`n_${this.i}`, new Node(assign.name), new Node("="), assign.expr.accept(this))
    }

}

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
        return "print " + stmt.expr.accept(this)
    }

    /** 
     * @param {ProgramStmt} stmt 
     */
    visitProgramStmt(stmt) {
        let res = `program ${stmt.name}\n`

        this.indent++
        for (let nested of stmt.block) {
            res += this.indentStr() + nested.accept(this) + "\n"
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
            res += this.indentStr() + nest.accept(this) + "\n"
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
                res += this.indentStr() + nest.accept(this) + "\n"
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
            res += this.indentStr() + nest.accept(this) + "\n"
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
            res += this.indentStr() + nest.accept(this) + "\n"
        }
        this.indent--
        res += this.indentStr() + "end do"
        return res
    }


    /** 
     * @param {AssignExpression} assign 
     */
    visitAssignExpr(assign) {
        return `${assign.name.value} = ${assign.expr.accept(this)}`
    }

    /** 
     * @param {Block} block 
     */
    visitBlockStmt(block) {
        let res = ""
        let i = 0
        for (let stmt of block.stmts) {
            res += (i != 0 ? this.indentStr() : "") + stmt.accept(this) + (i != block.stmts.length - 1 ? "\n" : "")
            i++
        }
        return res
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

    // /** 
    //  * @param {string} name 
    //  * @param {...Node} nodes
    //  */
    // treePrint(prefix, isLast, ...nodes) {
    //     // child_count = len(node.children)
    //     // for i, child in enumerate(node.children):
    //     // is_last_child = (i == child_count - 1)
    //     // print_tree(child, new_prefix, is_last_child)
    //     let connector = isLast ? "└── " : "├── "
    //     console.log(`${prefix}${connector}${node.value}`)
    //     let childCnt = nodes.length

    //     let i = 0
    //     for (let node of nodes) {
    //         this.treePrint(node,  connector, isLast)
    //         i++
    //     }
    //     res = res.concat(")")
    //     return res
    // }


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

export class AstTreePrinter extends StmtVisitor {

    /**
     * @param {Stmt | Stmt[]} ast 
     * @returns {string}
     */
    print(ast) {
        let treeStructure;

        if (Array.isArray(ast)) {
            treeStructure = {
                label: "AST Root",
                children: ast.map(stmt => stmt.accept(this))
            };
        } else {
            treeStructure = ast.accept(this);
        }

        return this._buildTreeString(treeStructure, "", true, true);
    }
    /**
     * @param {object} node 
     * @param {string} prefix 
     * @param {boolean} isLast 
     * @param {boolean} isRoot 
     */
    _buildTreeString(node, prefix = "", isLast = true, isRoot = true) {
        if (!node) return "";

        let result = "";
        if (isRoot) {
            result += node.label + "\n";
        } else {
            result += prefix + (isLast ? "└── " : "├── ") + node.label + "\n";
        }

        const nextPrefix = isRoot ? "" : prefix + (isLast ? "    " : "│   ");
        const children = (node.children || []).filter(c => c !== null && c !== undefined);

        for (let i = 0; i < children.length; i++) {
            const isLastChild = i === children.length - 1;
            result += this._buildTreeString(children[i], nextPrefix, isLastChild, false);
        }

        return result;
    }


    _formatExpr(expr) {
        if (!expr) return null;
        let val = typeof expr === 'object' ? JSON.stringify(expr) : String(expr);
        return { label: `Expr: ${val}`, children: [] };
    }

    /**
     * @param {Token} token 
     * @returns {string}
     */
    _formatToken(token) {
        if (!token) return "unknown";
        if (typeof token === 'symbol') return token.description;
        if (token.value) return token.value;
        return String(token);
    }

    _formatTrait(trait) {
        if (trait instanceof Dimensions) return { label: `Dimensions: [${trait.sizes.map(e => e.value).join(', ')}]`, children: [] };
        if (trait instanceof Precision) return {
            label: `Precision: ${trait.precision}`, children: []
        };
        if (trait instanceof Intent) return {
            label: `Intent: ${this._formatToken(trait.type)}`, children: []
        };
        return { label: trait, children: [] };
    }


    visitBlockStmt(stmt) {
        return {
            label: "Block",
            children: stmt.stmts.map(s => s.accept(this))
        };
    }

    visitPrintStmt(stmt) {
        return {
            label: "Print",
            children: [this._formatExpr(stmt.expr)]
        };
    }

    visitExpressionStmt(stmt) {
        return {
            label: "ExpressionStmt",
            children: [this._formatExpr(stmt.expr)]
        };
    }

    /**
     * @param {Call} expr 
     */
    visitCallExpr(expr) {
        return {
            label: `Call: ${expr.callee.accept(this)}`,
            children: [this._formatExpr(expr.args)]
        }
    }

    /**
     * @param {ExprVar} stmt 
     */
    visitExprVar(stmt) {
        return `${stmt.name.value}`
    }


    /**
     * @param {StmtVar} stmt 
     */
    visitVarStmt(stmt) {
        const typeStr = this._formatToken(stmt.type);
        const children = [];

        if (stmt.initializer) {
            children.push({ label: "Initializer", children: [this._formatExpr(stmt.initializer)] });
        }

        if (stmt.traits && stmt.traits.length > 0) {
            children.push({
                label: "Traits",
                children: stmt.traits.map(t => this._formatTrait(t))
            });
        }

        return {
            label: `Var: ${stmt.name.value} (${typeStr})`,
            children: children
        };
    }

    visitProgramStmt(stmt) {
        let children = [];

        if (Array.isArray(stmt.block)) {
            children = stmt.block.map(s => s.accept(this));
        }
        else if (stmt.block && typeof stmt.block.accept === 'function') {
            children = [stmt.block.accept(this)];
        }

        return {
            label: `Program: ${stmt.name}`,
            children: children
        };
    }

    visitIfStmt(stmt) {
        const children = [
            { label: "Condition", children: [this._formatExpr(stmt.condition)] },
            { label: "Then", children: stmt.thenBranch.map(s => s.accept(this)) }
        ]; if (stmt.elseIfChain && stmt.elseIfChain.length > 0) {
            children.push({
                label: "ElseIfChain",
                children: stmt.elseIfChain.map(s => s.accept(this))
            });
        }

        if (stmt.elseBranch && stmt.elseBranch.length > 0) {
            children.push({
                label: "Else",
                children: stmt.elseBranch.map(s => s.accept(this))
            });
        }

        return { label: "If", children };
    }

    visitElseIfStmt(stmt) {
        return {
            label: "ElseIf",
            children: [
                { label: "Condition", children: [this._formatExpr(stmt.condition)] },
                { label: "Body", children: stmt.stmts.map(s => s.accept(this)) }
            ]
        };
    }

    visitWhileStmt(stmt) {
        return {
            label: "While",
            children: [
                { label: "Condition", children: [this._formatExpr(stmt.condition)] },
                { label: "Body", children: stmt.body.map(s => s.accept(this)) }
            ]
        };
    }


    /**
     * @param {Subroutine} stmt 
     */
    visitSubroutineStmt(stmt) {
        const children = [];

        if (stmt.params && stmt.params.length > 0) {
            children.push({
                label: `Params: ${stmt.params.map(p => this._formatToken(p.name)).join(', ')}`,
                children: []
            });
        }

        children.push({
            label: "Body",
            children: stmt.body.map(s => s.accept(this))
        });

        return {
            label: `Subroutine: ${stmt.name}`, children: children
        };
    }

    /**
     * @param {FunctionStmt} stmt 
     */
    visitFunctionStmt(stmt) {
        const children = [];
        if (stmt.params && stmt.params.length > 0) {
            children.push({
                label: `Params: ${stmt.params.map(p => this._formatToken(p.name)).join(', ')}`,
                children: []
            });
        }

        children.push({
            label: "Body",
            children: stmt.body.map(s => s.accept(this))
        });

        children.push({
            label: "Output",
            children: this._formatToken(stmt.output.name)
        })

        return {
            label: `Function: ${stmt.name}`, children: children
        };
    }
}