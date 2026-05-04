import { Chunk, functionTypes, ObjArray, ObjFunction, ObjString, ObjTypes, OpCode, Value, ValueType } from "./bytecode";
import { AssignExpression, Binary, Call, Expression, ExprVar, ExprVisitor, Grouping, Literal, Unary } from "./expr_types";
import { Token, TYPES } from "./lexer";
import { Block, Dimensions, Exprs, FunctionStmt, ProgramStmt, Stmt, StmtExpression, StmtIf, StmtPrint, Stmts, StmtVar, StmtWhile, StringLen, Subroutine, Trait, VAR_TYPES } from "./stmt_types";
import { DEBUG_PRINT_CODE } from "./vm";

class Local {
    /**
     * @param {Token} name 
     * @param {Trait[]} traits
     * @param {Readonly<symbol>} type
     */
    constructor(name, traits, type) {
        this.name = name
        this.traits = traits
        this.type = type
    }
}

export class CompilerContext {
    /**
     * @param {string} name
     */
    constructor(name) {
        this.name = name;
        this.chunk = new Chunk();

        /**
         * @type {Local[]}
         */
        this.locals = [];
        this.scopeDepth = 0
        /**
         * @type {Token}
         */
        this.outputName = null;
    }
}

class CompilerBase { }
/**
 * @implements {ExprVisitor}
 */
export class Compiler extends Stmts(Exprs(CompilerBase)) {
    /**
     * @param {Readonly<symbol>} functionType 
     */
    constructor(functionType) {
        super()
        /**
         * @type {ObjFunction}
         */
        this.function = new ObjFunction()
        /**
         * @type {Readonly<symbol>}
         */
        this.type = functionType
        /**
         * @type {number}
         */
        this.scopeDepth = 0

        this.hadError = false
        /**
         * @type {Local[]}
         */
        this.locals = []
    }
    get chunk() {
        return this.hadError ? null : this.function.chunk
    }

    /**
     * @param {Stmt[]} stmts 
     * @returns {ObjFunction}
     */
    compile(stmts) {
        stmts.forEach(s => s.accept(this))
        let fn = this.endCompiler()
        if (DEBUG_PRINT_CODE) {
            fn.chunk.DisassembleChunk(this.type == functionTypes.TYPE_PROGRAM ? "program" : `function<${fn.name}>`);
        }
        return fn
    }

    /**
     * @param {*} output 
     * @returns {ObjFunction}
     */
    endCompiler(output) {
        if (output) {
            this.chunk.Write(-1)
            this.chunk.Write(OpCode.OP_RETURN)
        } else {
            this.chunk.Write(OpCode.OP_VOID_RET)
        }
        let fn = this.function
        return fn
    }
    /**
     * @param {Value} value 
     * @returns {number}
     */
    makeConstant(value) {
        let constant = this.chunk.AddConstant(value)
        if (constant > 255) {
            this.hadError
            console.error("Too many constants in one chunk")
        }
        return constant
    }

    /**
     * @param {Unary} expr 
     */
    visitUnaryExpr(expr) {
        let token = expr.operator
        expr.right.accept(this)
        switch (expr.operator) {
            case TYPES.MINUS: this.chunk.Write(OpCode.OP_NEGATE, token.line); break;
            case TYPES.NOT: this.chunk.Write(OpCode.OP_NOT, token.line); break;
            default: return
        }
    }

    /**
     * @param {Binary} expr
     */
    visitBinaryExpr(expr) {
        expr.left.accept(this)
        expr.right.accept(this)
        switch (expr.token.type) {
            case TYPES.PLUS: this.chunk.Write(OpCode.OP_ADD, expr.token.line); break;
            case TYPES.MINUS: this.chunk.Write(OpCode.OP_MINUS, expr.token.line); break;
            case TYPES.POW:
                this.chunk.Write(OpCode.OP_POW, expr.token.line)
                break;
            case TYPES.ASTERISK:
                this.chunk.Write(OpCode.OP_MUL, expr.token.line)
                break;
            case TYPES.AND: {
                let endJump = this.emitJump(OpCode.OP_JUMP_IF_FALSE)
                this.chunk.Write(OpCode.OP_POP)
                expr.right.accept(this)
                this.patchJump(endJump)
                return
            }
            case TYPES.OR: {
                let elseJump = this.emitJump(OpCode.OP_JUMP_IF_FALSE)
                let endJump = this.emitJump(OpCode.OP_JUMP)
                this.patchJump(elseJump)
                this.Write(OpCode.OP_POP)
                expr.right.accept(this)
                this.patchJump(endJump)
                return
            }
            case TYPES.SLASH:
                this.chunk.Write(OpCode.OP_DIVIDE, expr.token.line)
                break;
            case TYPES.MORE:
                this.chunk.Write(OpCode.OP_GREATER, expr.token.line);
                break;
            case TYPES.MORE_EQUAL:
                this.chunk.Write(OpCode.OP_LESS, expr.token.line)
                this.chunk.Write(OpCode.OP_NOT, expr.token.line)
                break;
            case TYPES.LESS:
                this.chunk.Write(OpCode.OP_LESS, expr.token.line)
                break;
            case TYPES.LESS_EQUAL:
                this.chunk.Write(OpCode.OP_GREATER, expr.token.line)
                this.chunk.Write(OpCode.OP_NOT, expr.token.line)
                break;
            case TYPES.EQUAL_EQUAL:
                this.chunk.Write(OpCode.OP_EQUAL, expr.token.line)
                break;
            case TYPES.NOT_EQUAL:
                this.chunk.Write(OpCode.OP_EQUAL, expr.token.line)
                this.chunk.Write(OpCode.OP_NOT, expr.token.line)
                break;
            default: return;
        }
    }

    /**
     * @param {AssignExpression} expr 
     */
    visitAssignExpr(expr) {
        if (expr.left instanceof ExprVar) {
            this.namedVariable(expr.left.name, expr.expr)
        } else {
            expr.left.accept(this)
            expr.expr.accept(this)
            this.chunk.Write(OpCode.OP_SET_ARR)
            // this.namedVariable(expr.name, expr.expr)
        }
    }

    /**
     * @param {Grouping} expr 
     */
    visitGroupingExpr(expr) {
        expr.expr.accept(this)
    }

    /**
     * @param {Literal} expr
     */
    visitLiteral(expr) {
        if (typeof expr.value === "boolean") {
            if (expr.value) { this.chunk.Write(OpCode.OP_TRUE, expr.line) } else {
                this.chunk.Write(OpCode.OP_FALSE, expr.line)
            }
        } else if (typeof expr.value === "number") {
            if (!expr.isFp) {
                this.emitConstant(new Value(ValueType.VAL_INT, expr.value))
            } else {
                this.emitConstant(new Value(ValueType.VAL_FLOAT, expr.value))
            }
        } else if (typeof expr.value === "string") {
            this.emitConstant(new ObjString(expr.value))
        }
    }

    /**
     * @param {StmtExpression} expr 
     */
    visitExpressionStmt(expr) {
        expr.expr.accept(this)
        this.chunk.Write(OpCode.OP_POP)
    }

    /**
     * @param {StmtVar} stmt
     */
    visitVarStmt(stmt) {
        if (this.locals.length == 255) {
            return
        }
        let global = this.identifierConstant(stmt.name)
        this.declareVariable(stmt.name, stmt.traits, stmt.type)
        if (stmt.initializer) {
            // this.namedVariable(stmt.name, stmt.initializer)
            stmt.initializer.accept(this)
        } else {
            this.emitZeroValue(stmt)
        }
        this.defineVariable(global, stmt.name.line, stmt.type)
    }


    /**
     * @param {Block} block 
     */
    visitBlockStmt(block) {
        let blockLocals = 0
        for (let stmt of block.stmts) {
            let prevCount = this.locals.length
            stmt.accept(this)
            if (this.locals.length - prevCount == 1) {
                blockLocals++
            }
        }
        while (blockLocals > 0) {
            this.chunk.Write(OpCode.OP_POP)
            this.locals.pop()
            blockLocals--
        }
    }

    /**
     * @param {StmtIf} stmt 
     */
    visitIfStmt(stmt) {
        stmt.condition.accept(this)
        let thenJump = this.emitJump(OpCode.OP_JUMP_IF_FALSE)
        stmt.thenBranch.forEach(s => s.accept(this))
        let elseJumps = [this.emitJump(OpCode.OP_JUMP)];
        this.patchJump(thenJump)
        if (stmt.elseIfChain && stmt.elseIfChain.length > 0) {
            let elseIfJump
            for (const [_, elseIf] of stmt.elseIfChain.entries()) {
                if (elseIfJump) {
                    this.patchJump(elseIfJump)
                }
                elseIf.condition.accept(this)
                elseIfJump = this.emitJump(OpCode.OP_JUMP_IF_FALSE)
                elseIf.stmts.forEach(s => s.accept(this))
                elseJumps.push(this.emitJump(OpCode.OP_JUMP))
            }
            this.patchJump(elseIfJump)
        }
        if (stmt.elseBranch) {
            stmt.elseBranch.forEach(s => s.accept(this))
        }
        elseJumps.forEach(j => this.patchJump(j))
    }

    /**
     * @param {StmtWhile} stmt 
     */
    visitWhileStmt(stmt) {
        let loopStart = this.chunk.code.length
        stmt.condition.accept(this)

        let exitJmp = this.emitJump(OpCode.OP_JUMP_IF_FALSE)
        this.chunk.Write(OpCode.OP_POP)
        stmt.body.forEach(s => s.accept(this))
        this.emitLoop(loopStart)

        this.patchJump(exitJmp)
        this.chunk.Write(OpCode.OP_POP)
    }

    /**
     * 
     * @param {ProgramStmt} stmt 
     */
    visitProgramStmt(stmt) {
        this.scopeDepth++
        stmt.block.accept(this)
        while (this.locals.length > 0) {
            this.chunk.Write(OpCode.OP_POP)
            this.locals.pop()
        }
        this.scopeDepth--
    }

    /**
     * @param {FunctionStmt} stmt 
     */
    visitFunctionStmt(stmt) {
        let compiler = new Compiler(functionTypes.TYPE_FUNCTION)
        compiler.scopeDepth++
        this.setFunctionParams(compiler.function, stmt)
        stmt.params.forEach(p => {
            let global = compiler.identifierConstant(stmt.name)
            compiler.defineVariable(global, p.name.line)
        })

        let global = this.identifierConstant(stmt.name)
        compiler.compile(stmt.body)
        let fn = this.endCompiler()
        this.chunk.Write(OpCode.OP_CONSTANT)
        this.chunk.Write(this.makeConstant(fn))
        this.defineVariable(global, stmt.name.line)

        if (stmt.output) {
            global = compiler.identifierConstant(stmt.output.name)
            compiler.defineVariable(global, stmt.output.name.line)
        } else {
            compiler.chunk.Write(-1)
        }

        while (this.locals.length > 0) {
            this.chunk.Write(OpCode.OP_POP)
            this.locals.pop()
        }

        compiler.chunk.Write(OpCode.OP_RETURN)
    }

    /**
     * @param {Subroutine} stmt 
     */
    visitSubroutineStmt(stmt) {
        let compiler = new Compiler(functionTypes.TYPE_FUNCTION)
        compiler.scopeDepth++
        this.setFunctionParams(compiler.function, stmt)

        stmt.params.forEach(p => {
            let global = compiler.identifierConstant(p.name)
            compiler.declareVariable(p.name, p.traits, p.type)
        })

        let global = this.identifierConstant(stmt.name)


        for (const nest of stmt.body.stmts) {
            if (nest instanceof StmtVar) {
                if (stmt.params.some(p => p.name.value === nest.name.value)) {
                    continue
                }
            }
            nest.accept(compiler)
        }
        while (compiler.locals.length > 0) {
            compiler.chunk.Write(OpCode.OP_POP)
            compiler.locals.pop()
        }
        stmt.params.forEach(() => {
            compiler.chunk.Write(OpCode.OP_POP)
        })
        let fn = compiler.endCompiler()
        if (DEBUG_PRINT_CODE) {
            fn.chunk.DisassembleChunk(`function<${fn.name}>`)
        }

        this.chunk.Write(OpCode.OP_CONSTANT)
        this.chunk.Write(this.makeConstant(fn))
        this.defineVariable(global, stmt.name.line)

    }

    /**
     * @param {ObjFunction} ObjFunction 
     * @param {Subroutine|FunctionStmt} subroutine 
     */
    setFunctionParams(ObjFunction, subroutine) {
        ObjFunction.arity = subroutine.params.length
        ObjFunction.name = subroutine.name.value
    }

    /**
     * @param {Call} expr 
     */
    visitCallExpr(expr) {
        if (!expr.isIndexing) {
            expr.callee.accept(this)
        }
        expr.args.forEach(e => e.accept(this))
        if (expr.isIndexing) {
            this.chunk.Write(OpCode.OP_GET_ARR, expr.paren.line)
            this.chunk.Write(this.resolveLocal(expr.callee.name), expr.callee.name)
        } else {
            this.chunk.Write(OpCode.OP_CALL, expr.paren.line)
        }
        this.chunk.Write(expr.args.length, expr.paren.line)
    }

    /**
     * @param {StmtPrint} stmt 
     */
    visitPrintStmt(stmt) {
        stmt.expr.accept(this)
        this.chunk.Write(OpCode.OP_PRINT, stmt.line)
    }

    /**
     * @param {ExprVar} expr 
     */
    visitExprVar(expr) {
        this.namedVariable(expr.name)
    }

    /**
     * @param {Value} value 
     */
    emitConstant(value) {
        this.chunk.Write(OpCode.OP_CONSTANT)
        this.chunk.Write(this.makeConstant(value))
    }

    /**
     * @param {Readonly<number>} instruction 
     */
    emitJump(instruction) {
        this.chunk.Write(instruction)
        this.chunk.Write(0xff)
        this.chunk.Write(0xff)
        return this.chunk.code.length - 2
    }

    /**
     * @param {number} offset 
     */
    patchJump(offset) {
        let jump = this.chunk.code.length - offset - 2
        if (jump > 0xffff) {
            this.hadError = false
            console.error("Too much code to jump over")
        }
        this.chunk.code[offset] = (jump >> 8) & 0xff
        this.chunk.code[offset + 1] = jump & 0xff
    }

    /**
     * @param {number} loopStart 
     */
    emitLoop(loopStart) {
        this.chunk.Write(OpCode.OP_LOOP)

        let offset = this.chunk.code.length - loopStart + 2
        if (offset > 0xffff) {
            console.error("Loop body too large")
        }
        this.chunk.Write((offset >> 8) & 0xff)
        this.chunk.Write(offset & 0xff)
    }

    /**
     * @param {Token} name 
     */
    identifierConstant(name) {
        return this.makeConstant(new ObjString(name.value))
    }

    /**
     * @param {number} global
     * @param {number} line
     */
    defineVariable(global, line) {
        if (this.scopeDepth > 0) {
            return
        }
        this.chunk.Write(OpCode.OP_DEFINE_GLOBAL, line)
        this.chunk.Write(global, line)
    }

    /**
     * @param {Token} name 
     * @param {Trait[]} traits 
     * @param {Readonly<symbol>} type
     */
    declareVariable(name, traits, type) {
        if (this.scopeDepth == 0) return;
        this.addLocal(new Local(name, traits, type))
    }

    /**
     * @param {Local} local 
     */
    addLocal(local) {
        if (this.locals.length > 255) {
            console.error("Too many local variables in a function")
            return
        }
        for (const [i, seen] of this.locals.entries()) {
            if (seen.name.value === local.name.value) {
                //Probably shouldn't even allocate one
                // this.locals[i] = local
                return
            }
        }
        this.locals.push(local)
    }

    /**
     * @param {Token} name
     * @param {Expression} initializer  
     */
    namedVariable(name, initializer) {
        let getOp, setOp
        let arg = this.resolveLocal(name)
        if (arg != -1) {
            if (this.locals[arg].type === VAR_TYPES.CHARACTER) {
                setOp = OpCode.OP_SET_STR
            } else {
                setOp = OpCode.OP_SET_LOCAL
            }
            getOp = OpCode.OP_GET_LOCAL
        } else {
            arg = this.identifierConstant(name)
            getOp = OpCode.OP_GET_GLOBAL
            setOp = OpCode.OP_SET_GLOBAL
        }
        if (initializer) {
            initializer.accept(this)
            this.chunk.Write(setOp, name.line)
            if (setOp === OpCode.OP_SET_STR) {
                let sz = this.locals[arg].traits.find(t => t instanceof StringLen)
                this.chunk.Write(sz ? sz.len : 1, name.line)
            }
            this.chunk.Write(arg, name.line)
        } else {
            this.chunk.Write(getOp, name.line)
            this.chunk.Write(arg, name.line)
        }
    }

    /**
     * @param {Token} name 
     */
    resolveLocal(name) {
        let i = 0
        for (let local of this.locals) {
            if (local.name.value === name.value) {
                return i
            }
            i++
        }
        return -1
    }

    /**
     * @param {StmtVar} stmt
     */
    //TODO: FIX FOR ARRAYS
    emitZeroValue(stmt) {
        /**
         * @type {Dimensions}
         */
        let traits
        if ((traits = stmt.traits.find(t => t instanceof Dimensions))) {
            this.emitConstant(new ObjArray(traits.sizes.map(t => t.value), stmt.type, stmt.traits))
            return
        }
        switch (stmt.type) {
            case VAR_TYPES.INT:
                this.emitConstant(new Value(ValueType.VAL_INT, 0))
                break;
            case VAR_TYPES.REAL:
                this.emitConstant(new Value(ValueType.VAL_FLOAT, 0.0))
                break;
            case VAR_TYPES.CHARACTER: {
                let sz = 1;
                let lenTrait = stmt.traits.find(t => t instanceof StringLen)
                this.emitConstant(new Value(ValueType.VAL_OBJ, " ".repeat(lenTrait ? lenTrait.len : sz)))
                break;
            }
        }
    }


}
