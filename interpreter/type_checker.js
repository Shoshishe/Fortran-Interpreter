import { AssignExpression, Binary, Call, Expression, ExprVar, ExprVisitor, Grouping, Literal, Unary } from "./expr_types";
import { Token, TYPES } from "./lexer";
import { Block, Dimensions, FunctionStmt, Intent, IntentTypes, ProgramStmt, Stmt, StmtExpression, StmtIf, StmtPrint, StmtVar, StmtVisitor, StmtWhile, Subroutine, Trait, VAR_TYPES } from "./stmt_types";

class TypeMetadata {
    /**
     * @param {Readonly<symbol>} type 
     * @param {Trait[]} traits 
     * @param {Array} params 
     */
    constructor(type, traits = [], params) {
        this.type = type
        this.traits = traits
        this.params = params
    }
}

export class Environment {
    constructor(enclosing = null) {
        this.values = new Map()
        this.enclosing = enclosing
    }

    define(name, typeMetadata) {
        this.values.set(name, typeMetadata);
    }

    /**
     * @param {string} name 
     * @param {number} line 
     * @returns {TypeMetadata}
     */
    lookup(name, line) {
        if (this.values.has(name)) return this.values.get(name);
        if (this.enclosing) return this.enclosing.lookup(name, line);
        throw new Error(`Undefined variable: ${name} at line ${line}`);
    }

    has(name) {
        return this.values.has(name)
    }
}


const sameValues = (a, b) => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((v, i) => v === sortedB[i]);
};
/**
 * @param {TypeMetadata} type1 
 * @param {TypeMetadata} type2 
 * @returns {TypeMetadata?}
 */
function promote(type1, type2) {
    if (type1.type === type2.type && sameValues(type1.traits, type2.traits)) return type1;
    if (((type1.type === VAR_TYPES.INT && type2.type === VAR_TYPES.REAL) ||
        (type1.type === VAR_TYPES.REAL && type2.type === VAR_TYPES.INT)) && sameValues(type1.traits, type2.traits)) {
        return new TypeMetadata(VAR_TYPES.REAL);
    } else if (type1.type === VAR_TYPES.BOOLEAN && type2.type === VAR_TYPES.INT && sameValues(type1.traits, type2.traits)) {
        return new TypeMetadata(VAR_TYPES.BOOLEAN)
    }

    return undefined
    // throw new Error(`Incompatible types: ${type1.description} and ${type2.description} `);
}

export class TypeChecker extends StmtVisitor {

    hasError = false
    constructor() {
        super()
        /**
         * @type {Environment}
         */
        this.environment = new Environment()
    }

    /**
     * @param {Stmt[]} statements 
     */
    check(statements) {
        for (const stmt of statements) {
            try {
                stmt.accept(this);
            } catch (error) {
                console.error(`Type Error: ${error.message}`);
                this.hasError = true
                // throw error;
            }
        }
        console.log("Semantic analysis successfull.");
    }

    /**
     * @param {Expression} expr 
     * @returns {Readonly<symbol>}
     */
    evalType(expr) {
        return expr.accept(this)
    }

    /**
     * @param {ProgramStmt} stmt 
     */
    visitProgramStmt(stmt) {
        stmt.block.accept(this)
    }
    /**
     * @param {Block} stmt 
     */
    visitBlockStmt(stmt) {
        const previous = this.environment;
        this.environment = new Environment(previous);

        for (const s of stmt.stmts) {
            s.accept(this);
        }

        this.environment = previous;
        return null;
    }

    /**
     * @param {StmtVar} stmt 
     */
    visitVarStmt(stmt) {
        let initializerType;
        if (stmt.initializer !== null) {
            initializerType = this.evalType(stmt.initializer)
            if (stmt.type !== promote(new TypeMetadata(stmt.type), initializerType)?.type) {
                throw new Error(`Type mismatch for ${stmt.name.value} at line ${stmt.name.line}: cannot assign ${initializerType.description} to ${stmt.type.description}`)
            }
        }
        if (!this.environment.has(stmt.name)) {
            this.environment.define(stmt.name.value, new TypeMetadata(stmt.type, stmt.traits))
        } else {
            throw new Error(`Redeclaration of ${stmt.name.value} at line ${stmt.name.line}`)
        };
        return null
    }

    /**
     * @param {StmtExpression} stmt 
     */
    visitExpressionStmt(stmt) {
        stmt.expr.accept(this)
        return null
    }

    /**
     * @param {StmtPrint} stmt 
     */
    visitPrintStmt(stmt) {
        stmt.expr.accept(this)
        return null
    }

    /**
     * @param {StmtWhile} stmt 
     */
    visitWhileStmt(stmt) {
        stmt.condition.accept(this)
        for (let nest of stmt.body) {
            nest.accept(this)
        }
        return null
    }

    /**
     * @param {FunctionStmt} stmt 
     */
    visitFunctionStmt(stmt) {
        this.environment.define(stmt.name.value, new TypeMetadata(VAR_TYPES.SUBROUTINE, undefined, stmt.params))

        const previous = this.environment;
        this.environment = new Environment(previous);

        for (const param of stmt.params) {
            this.environment.define(param.name.value, new TypeMetadata(param.type));
        }
        this.environment.define(stmt.output.name.value, new TypeMetadata(stmt.output.type))
        for (const s of stmt.body.stmts) {
            s.accept(this);
        }
        this.environment = previous;
    }
    /**
     * @param {StmtIf} stmt 
     */
    visitIfStmt(stmt) {
        const conditionType = this.evalType(stmt.condition);
        if (conditionType !== VAR_TYPES.BOOLEAN) {
            throw new Error(`IF condition must be a logical expression at line ${stmt.start.line}`);
        }

        stmt.thenBranch.forEach(s => s.accept(this));

        if (stmt.elseIfChain) {
            stmt.elseIfChain.forEach(elseif => elseif.accept(this));
        }

        if (stmt.elseBranch) {
            stmt.elseBranch.forEach(s => s.accept(this));
        }
        return null;
    }


    /**
     * @param {Subroutine} stmt 
     */
    visitSubroutineStmt(stmt) {
        this.environment.define(stmt.name.value, new TypeMetadata(VAR_TYPES.SUBROUTINE, undefined, stmt.params))

        const previous = this.environment;
        this.environment = new Environment(previous);

        for (const param of stmt.params) {
            this.environment.define(param.name.value, new TypeMetadata(VAR_TYPES.REAL));
        }
        for (const s of stmt.body.stmts) {
            s.accept(this);
        }
        this.environment = previous;
    }


    /**
     * @param {Literal} expr 
     * @returns {Readonly<symbol>}
     */
    visitLiteral(expr) {
        if (typeof expr.value === 'number') {
            return expr.isFp ? new TypeMetadata(VAR_TYPES.REAL) : new TypeMetadata(VAR_TYPES.INT);
        }
        if (typeof expr.value === 'string') return new TypeMetadata(VAR_TYPES.CHARACTER);
        if (typeof expr.value === "boolean") return new TypeMetadata(VAR_TYPES.BOOLEAN)
        return null;
    }

    /**
     * @param {ExprVar} expr 
     * @returns {TypeMetadata}
     */
    visitExprVar(expr) {
        const metadata = this.environment.lookup(expr.name.value, expr.name.line);
        return metadata;
    }

    /**
     * @param {Grouping} expr 
     * @returns {Readonly<symbol>}
     */
    visitGroupingExpr(expr) {
        return expr.expr.accept(this);
    }

    /**
     * @param {Unary} expr 
     * @returns {TypeMetadata}
     */
    visitUnaryExpr(expr) {
        const rightType = expr.right.accept(this);

        if (expr.operator.type === TYPES.MINUS || expr.operator.type === TYPES.PLUS) {
            if (rightType !== VAR_TYPES.INT && rightType !== VAR_TYPES.REAL) {
                throw new Error(`Arithmetic unary operator requires numeric type at line ${expr.operator.line}.`);
            }
        }
        return rightType;
    }

    /**
     * @param {Binary} expr 
     * @returns {TypeMetadata}
     */
    visitBinaryExpr(expr) {
        const leftType = expr.left.accept(this);
        const rightType = expr.right.accept(this);

        if ([TYPES.EQUAL, TYPES.PLUS, TYPES.MINUS, TYPES.ASTERISK, TYPES.POW, TYPES.SLASH].includes(expr.token.type)) {
            if (!promote(leftType, rightType)) {
                throw new Error(`Incompatible types for arithmetic operation: Cannot assign ${rightType.description} to ${leftType.description} at line ${expr.token.line}`)
            }
            return promote(leftType, rightType)
        }

        if ([TYPES.EQUAL_EQUAL, TYPES.MORE, TYPES.MORE_EQUAL, TYPES.LESS, TYPES.LESS_EQUAL].includes(expr.token.type)) {
            if (promote(leftType, rightType) === undefined) {
                throw new Error(`Inassignable to boolean types at line ${expr.token.line}`)
            };
            return new TypeMetadata(VAR_TYPES.BOOLEAN);
        }
        throw new Error(`Unknown operator: ${expr.token.value} at line ${expr.token.line}`);
    }

    /**
     * @param {AssignExpression} expr 
     * @returns {TypeMetadata?}
     */
    visitAssignExpr(expr) {
        const varMetadata = expr.left.accept(this)
        const valueType = expr.expr.accept(this);

        const isReadOnly = varMetadata.traits.some(t => t instanceof Intent && t.type === IntentTypes.IN);
        if (isReadOnly) {
            throw new Error(`Variable '${expr.name.value}' is INTENT(IN) and cannot be modified.`);
        }

        if (varMetadata?.type === VAR_TYPES.REAL && valueType?.type === VAR_TYPES.INT) {
            return VAR_TYPES.REAL;
        }
        if (varMetadata?.type !== valueType?.type) {
            throw new Error(`Type mismatch: Cannot assign ${valueType.description} to ${varMetadata.type.description} at line ${expr.equals.line}`);
        }

        return varMetadata;
    }

    /**
     * @param {Call} expr 
     * @returns {TypeMetadata?}
     */
    visitCallExpr(expr) {
        const callee = this.environment.lookup(expr.callee.name.value, expr.callee.name.line);

        let dims
        if ((dims = callee.traits.find(t => t instanceof Dimensions))) {
            if (dims.sizes.length != expr.args.length) {
                throw new Error(`Expected ${callee.params.length} arguments for indexing but got ${expr.args.length}`)
            }
            expr.isIndexing = true
            return callee
        } else {
            if (callee.type !== VAR_TYPES.SUBROUTINE) {
                throw new Error(`${expr.callee.name.value} is not a subroutine or an array to be indexed.`);
            }

            if (expr.args.length !== callee.params.length) {
                throw new Error(`Expected ${callee.params.length} arguments but got ${expr.args.length} at line ${expr.callee.name.line}.`);
            }

            for (let i = 0; i < expr.args.length; i++) {
                const argType = expr.args[i].accept(this)?.type;
                const paramType = callee.params[i].type;
                if (argType !== paramType && !promote(argType, paramType)) {
                    throw new Error(`Argument ${i} type mismatch at line ${expr.callee.name.line}.`);
                }
            }

            return null;
        }
    }
}
