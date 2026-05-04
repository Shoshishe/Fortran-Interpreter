import { Chunk, FLOAT_VAL, functionTypes, IS_FLOAT, IS_NUMBER, IS_OBJ, ObjArray, ObjFunction, ObjString, ObjTypes, OpCode, Value, ValueType } from "./bytecode";
import process from "node:process"
import fs, { read } from "node:fs"
import { Scanner } from "./lexer";
import { Parser } from "./parser";
import { TypeChecker } from "./type_checker";
import { Compiler, CompilerContext } from "./compiler";
import { VAR_TYPES } from "./stmt_types";

class ValueArray {
    constructor(length, offset = 0, buffer = new Array(length)) {
        this.length = length
        this.buffer = buffer
        this.offset = offset
        this.sp = 0
    }


    /**
     * @param {number} i 
     * @param {Value} item
     */
    set(i, item) {
        this.buffer[this.offset + i] = item
    }

    /**
     * @param {Value} item
     */
    push(item) {
        if (this.sp > this.buffer.length) {
            throw Error("Stack overflow")
        }
        this.buffer[this.offset + this.sp++] = item
    }

    /**
     * @returns {Value}
     */
    pop() {
        delete this.buffer[this.sp]
        return this.buffer[this.offset + --this.sp]
    }
    /**
     * @param {number} i 
     * @returns {Value}
     */
    get(i) {
        return this.buffer[this.offset + i]
    }

    /**
     * @param {number} dist
     * @returns {Value}
     */
    peek(dist = 0) {
        if (this.isEmpty()) {
            throw new Error("Stack underflow during peek")
        }
        return this.buffer[this.offset + this.sp - 1 - dist];
    }

    /**
     * @returns {boolean}
     */
    isEmpty() {
        return this.length == 0
    }

    /**
     * @param {number} start 
     * @returns {ValueArray}
     */
    slice(start = 0) {
        return new ValueArray(this.buffer.length - start, start, this.buffer)
    }

}

const INTERPRET_RESULT = Object.freeze({
    INTERPRET_OK: Symbol("INTERPRET_OK"),
    INTERPRET_COMPILE_ERR: Symbol("INTERPRET_COMPILE_ERR"),
    INTERPRET_RUNTIME_ERR: Symbol("INTERPRET_RUNTIME_ERR")
})

class CallFrame {
    /**
     * @param {ObjFunction} fn
     * @param {number} ip
     * @param {ValueArray} slots
     */
    constructor(fn = new ObjFunction(), ip = 0, slots = new ValueArray(256)) {
        this.function = fn
        this.ip = ip
        /**
         * @type {ValueArray}
         */
        this.slots = slots
    }
}

class Vm {
    constructor() {
        /**
         * @type {ValueArray}
         */
        this.stack = new ValueArray(256)
        /**
         * @type {Map<string,Value>}
         */
        this.globals = new Map()
        /**
         * @type {CallFrame[]}
         */
        this.frames = []
    }

    /**
     * @param {Value} item 
     */
    push(item) {
        this.stack.push(item)
    }

    /**
     * @returns {Value}
     */
    pop() {
        return this.stack.pop()
    }
    /**
     * @returns {CallFrame}
     */
    get frame() {
        return this.frames[this.frames.length - 1]
    }
    set frame(ip) {
        this.frames.peek().ip = ip
    }

    /**
     * @returns {Chunk}
     */
    get chunk() {
        return this.frame.function.chunk
    }
    get ip() {
        return this.frame.ip
    }

    set ip(value) {
        this.frame.ip = value
    }

    get code() {
        return this.frame.function.chunk.code
    }
}


export let DEBUG_PRINT_CODE = true
let DEBUG_EXEC_TRACING = false
export let vm = new Vm()


/**
 * @param {string} src 
 * @returns {ObjFunction}
 */
export function compile(src) {
    const data = fs.readFileSync(src, 'utf-8')
    Scanner.setData(data);
    Scanner.lexAll();

    let parser = new Parser(Scanner.tokens);
    let ast = parser.parse();
    if (parser.hadError) {
        return null;
    }

    let typeChecker = new TypeChecker();
    typeChecker.check(ast);
    if (typeChecker.hadError) {
        return null;
    }

    let compiler = new Compiler(functionTypes.TYPE_PROGRAM);
    let fn = compiler.compile(ast);
    if (compiler.hadError) {
        return null;
    }

    vm.frames.push(new CallFrame(fn, 0, vm.stack));
    return fn
}


/**
 * @param {string} src 
 * @returns {Readonly<symbol>}
 */
export function interpret(src) {
    let fn
    if (!(fn = compile(src))) {
        return INTERPRET_RESULT.INTERPRET_COMPILE_ERR
    }
    return run()
}

export function run() {
    for (; ;) {

        if (DEBUG_EXEC_TRACING) {
            vm.stack.print()
            vm.chunk.DisassembleInstruction(vm.frame.ip)
        }
        let instruction
        switch (instruction = readByte()) {
            case OpCode.OP_CALL: {
                let argCount = readByte()
                if (!callValue(vm.stack.peek(argCount), argCount)) {
                    return INTERPRET_RESULT.INTERPRET_RUNTIME_ERR
                }
                break;
            }
            case OpCode.OP_GET_ARR: {
                let slot = readByte()
                let argCount = readByte()
                let val;
                if ((val = indexValue(vm.frame.slots.get(slot), argCount)) === null) {
                    return INTERPRET_RESULT.INTERPRET_RUNTIME_ERR
                }
                while (argCount > 0) {
                    vm.pop()
                    argCount--
                }

                vm.push(val)
                break;
            }
            case OpCode.OP_SET_ARR: {
                let rhs = vm.pop()
                let lhs = vm.pop()
                lhs.object = rhs.object
                break;
            }
            case OpCode.OP_CONSTANT: {
                let constant = readConstant()
                vm.push(constant)
                break;
            }
            case OpCode.OP_DEFINE_GLOBAL: {
                let name = readString()
                vm.globals.set(name.chars, vm.pop())
                break;
            }
            case OpCode.OP_GET_GLOBAL:
                {
                    let name = readString();
                    let value;
                    if (!(value = vm.globals.get(name.chars))) {
                        runtimeError(`Undefined variable ${name.chars}`)
                    }
                    vm.push(value)
                    break;
                }
            case OpCode.OP_SET_GLOBAL: {
                let name = readString()
                if (!vm.globals.has(name.chars)) {
                    runtimeError(`Undefined variable ${name.chars}`)
                    return INTERPRET_RESULT.INTERPRET_RUNTIME_ERR
                }
                break;
            }
            case OpCode.OP_GET_LOCAL: {
                let slot = readByte()
                vm.push(vm.frame.slots.get(slot))
                break;
            }
            case OpCode.OP_SET_LOCAL: {
                let slot = readByte();
                vm.frame.slots.set(slot, vm.stack.peek())
                break;
            }
            case OpCode.OP_SET_STR: {
                let sz = readByte();
                let slot = readByte();
                /**
                 * @type {ObjString}
                 */
                let str = vm.stack.peek()
                str.chars = sz > str.chars.length ? str.chars.padEnd(sz, " ") : str.chars.slice(0, sz)
                vm.frame.slots.set(slot, str);
                break;
            }
            case OpCode.OP_JUMP_IF_FALSE: {
                let offset = readShort()
                if (isFalsey(vm.stack.peek())) { vm.frame.ip += offset }
                break;
            }
            case OpCode.OP_JUMP: {
                let offset = readShort()
                vm.frame.ip += offset
                break;
            }
            case OpCode.OP_LOOP: {
                let offset = readShort()
                vm.frame.ip -= offset
                break;
            }
            case OpCode.OP_RETURN: {
                // console.log(vm.stack.pop())
                let result = vm.pop()
                vm.frames.pop()
                if (vm.frames.length == 0) {
                    vm.stack.pop()
                    return INTERPRET_RESULT.INTERPRET_OK
                }
                vm.stack = vm.frame.slots
                vm.push(result)
                break;
            }
            case OpCode.OP_VOID_RET: {
                vm.frames.pop()
                if (vm.frames.length == 0) {
                    vm.stack.pop()
                    return INTERPRET_RESULT.INTERPRET_OK
                }
                vm.stack = vm.frame.slots
                break;
            }
            case OpCode.OP_NEGATE: {
                if (!IS_NUMBER(vm.stack.peek())) {
                    runtimeError("Operand must be a number")
                    return INTERPRET_RESULT.INTERPRET_RUNTIME_ERR
                }
                vm.push(-vm.pop());
                break;
            }
            case OpCode.OP_POP: vm.pop(); break;
            case OpCode.OP_PRINT:
                vm.pop().print();
                break;
            case OpCode.OP_TRUE:
                vm.push(new Value(ValueType.VAL_BOOL, true));
                break;
            case OpCode.OP_FALSE:
                vm.push(new Value(ValueType.VAL_BOOL, false));
                break;
            case OpCode.OP_EQUAL: {
                let b = vm.pop()
                let a = vm.pop()
                vm.push(new Value(ValueType.VAL_BOOL, valuesEqual(a, b)))
                break;
            }
            case OpCode.OP_LESS: binaryOp((a, b) => a < b); break;
            case OpCode.OP_GREATER: binaryOp((a, b) => a > b); break;
            case OpCode.OP_ADD: binaryOp((a, b) => a + b); break;
            case OpCode.OP_DIVIDE: binaryOp((a, b) => a / b); break;
            case OpCode.OP_POW: binaryOp((a, b) => a ** b); break;
            case OpCode.OP_MUL: binaryOp((a, b) => a * b); break;
            case OpCode.OP_MINUS: binaryOp((a, b) => a - b); break;
            case OpCode.OP_NOT: vm.push(new Value(ValueType.VAL_BOOL, isFalsey(vm.pop()))); break;
        }
    }
}

/**
 * @param {Value} callee 
 * @param {number} argCount 
 * @returns {boolean} 
 */
function callValue(callee, argCount) {
    if (IS_OBJ(callee)) {
        switch (callee.obj_type) {
            case ObjTypes.OBJ_FUNCTION:
                return call(callee, argCount);
            default:
                break;
        }
    }
    runtimeError("Can only call functions and subroutines.");
    return false;
}
/**
 * @param {Value} callee 
 * @param {number} argCount
 * @returns {Value} 
 */
function indexValue(callee, argCount) {
    if (IS_OBJ(callee)) {
        switch (callee.obj_type) {
            case ObjTypes.OBJ_ARRAY:
                return index(callee, argCount);
            default:
                break;
        }
    }
    runtimeError("Can only index arrays")
    return null
}

/**
 * @param {ObjArray} arr 
 * @param {number[]} argCount 
 * @returns {Value}
 */
function index(arr, argCount) {
    if (argCount != arr.dims) {
        runtimeError(`Expected ${arr.dims} arguments for indexing but got ${argCount}.`)
        return false;
    }

    let cur = arr.objs
    for (let i = 0; i < argCount; i++) {
        let arg = vm.stack.peek(i)
        if (cur.length < arg) {
            runtimeError(`Array contains ${cur.length} items but got ${arg} index`)
        }
        if (!Array.isArray(cur)) {
            runtimeError(`Indexed variable is not an array`)
        }
        if (!Number.isInteger(arg.object - 1)) {
            runtimeError(`Indexing array by non-integer key`)
        }
        cur = cur[arg.object - 1]
    }
    return cur
}

/**
 * @param {ObjFunction} fn 
 * @param {number} argCount 
 * @returns {boolean}
 */
function call(fn, argCount) {
    if (argCount != fn.arity) {
        runtimeError(`Expected ${fn.arity} arguments but got ${argCount}.`)
        return false;
    }

    vm.frames.push(new CallFrame(fn, 0, vm.frame.slots.slice(argCount + 1)))
    return true;
}

/** 
 * @returns {number}
 */
function readByte() {
    return vm.code[vm.ip++]
}

function readShort() {
    vm.ip += 2
    return (vm.code[vm.ip - 2] << 8) | vm.code[vm.ip - 1]
}

/** 
 * @returns {Value}
 */
function readConstant() {
    return vm.chunk.constants[readByte()]
}

/**
 * @returns {ObjString}
 */
function readString() {
    return readConstant().object
}

/**
 * @param {string} format 
 */
function runtimeError(format) {
    console.error(format)
    for (let i = vm.frames.length - 1; i >= 0; i--) {
        let frame = vm.frames[i];
        let fn = frame.function;
        let instruction = frame.ip - 1
        let errStr = `[line ${fn.chunk.lines[instruction]}] in `
        if (fn.name == "") {
            errStr += "script"
        } else {
            errStr += fn.name;
        }
        console.error(errStr)
    }
}

/**
 * @param {Value} a 
 * @param {Value} b 
 * @returns {boolean}
 */
function valuesEqual(a, b) {
    if (a.type != b.type) {
        return false
    }
    switch (a.type) {
        case VAR_TYPES.BOOLEAN:
            return a.object === b.object
        case VAR_TYPES.INT:
        case VAR_TYPES.REAL:
            return a.object == b.object
        case VAR_TYPES.CHARACTER:
            return a.object === b.object
        default:
            return false
    }
}

/** 
 * @param {function(number,number): number} operation
 */
function binaryOp(operation) {
    const b = vm.pop()
    const a = vm.pop()
    if (!IS_NUMBER(a) || !IS_NUMBER(b)) {
        return INTERPRET_RESULT.INTERPRET_RUNTIME_ERR
    }
    vm.push(new Value(IS_FLOAT(a) || IS_FLOAT(b) ? ValueType.VAL_FLOAT : ValueType.VAL_INT, operation(a.object, b.object)))
}

/**
 * @param {Value} value 
 * @returns {boolean}
 */
function isFalsey(value) {
    return value.object === false || (IS_NUMBER(value) && value.object == 0)
}
