import process from "node:process";
import { Dimensions, StringLen, Trait, VAR_TYPES } from "./stmt_types";

export const OpCode = Object.freeze({
    OP_RETURN: 0,
    OP_CONSTANT: 1,
    OP_NEGATE: 2,
    OP_ADD: 3,
    OP_MINUS: 4,
    OP_DIVIDE: 5,
    OP_MUL: 6,
    OP_POW: 7,
    OP_TRUE: 8,
    OP_FALSE: 9,
    OP_NOT: 10,
    OP_EQUAL: 11,
    OP_LESS: 12,
    OP_GREATER: 13,
    OP_PRINT: 14,
    OP_POP: 15,
    OP_DEFINE_GLOBAL: 16,
    OP_DEFINE_LOCAL: 17,
    OP_GET_GLOBAL: 18,
    OP_SET_GLOBAL: 19,
    OP_GET_LOCAL: 20,
    OP_SET_LOCAL: 21,
    OP_JUMP_IF_FALSE: 22,
    OP_JUMP: 23,
    OP_LOOP: 24,
    OP_CALL: 25,
    OP_VOID_RET: 26,
    OP_SET_STR: 27,
    OP_SET_ARR: 28,
    OP_GET_ARR: 29,
})

export const ValueType = Object.freeze({
    VAL_BOOL: Symbol("VAL_BOOL"),
    VAL_INT: Symbol("VAL_INT"),
    VAL_FLOAT: Symbol("VAL_FLOAT"),
    VAL_OBJ: Symbol("VAL_OBJ")
})

export const ObjTypes = Object.freeze({
    OBJ_STRING: Symbol("OBJ_STRING"),
    OBJ_FUNCTION: Symbol("OBJ_FUNCTION"),
    OBJ_ARRAY: Symbol("OBJ_ARRAY")
})

export const functionTypes = Object.freeze({
    TYPE_FUNCTION: Symbol("TYPE_FUNCTION"),
    TYPE_PROGRAM: Symbol("TYPE_PROGRAM")
})

class Obj extends Value {
    /**
     * @param {Readonly<symbol>} type 
     */
    constructor(type) {
        super(ValueType.VAL_OBJ)
        this.obj_type = type
        super.object = this
    }
}

export class ObjString extends Obj {
    constructor(chars = "") {
        super(ObjTypes.OBJ_STRING)
        this.chars = chars
    }
}

export class ObjFunction extends Obj {
    /**
     * @param {number} arity 
     * @param {Chunk} chunk 
     * @param {string} name 
     */
    constructor(arity = 0, chunk = new Chunk(), name = "") {
        super(ObjTypes.OBJ_FUNCTION)
        this.arity = arity
        this.chunk = chunk
        this.name = name
    }
}

export class ObjArray extends Obj {
    /**
     * @param {number[]} dimensions
     * @param {Readonly<symbol>} type 
     * @param {Trait[]} traits
     */
    constructor(dimensions = [], type, traits) {
        super(ObjTypes.OBJ_ARRAY)
        let prev = new Array(dimensions[0])
        /**
         * @type {Value[]}
         */
        this.objs = prev
        this.fill(prev, dimensions.slice(1, dimensions.length), type, traits)
        // for (let i = 1; i < dimensions.length; i++) {
        //     for (let j = 0; j < prev.length; j++) {
        //         prev[j] = new Array(dimensions[i])
        //     }
        //     prev = dimensions[i]
        // }
        // for (let i = 0; i < prev.length; i++) {
        //     prev[i] = zeroValue(type, traits)
        // }
        /**
         * @param {number}
         */
        this.dims = dimensions.length
        this.elemTypes = type
    }

    /**
     * @param {Value[]} arr 
     * @param {number[]} dimensions
     * @param {Readonly<symbol>}type
     * @param {Trait[]} traits
     */
    fill(arr, dimensions, type, traits) {
        for (let i = 0; i < arr.length; i++) {
            if (dimensions.length === 0) {
                arr[i] = zeroValue(type, traits)
            } else {
                arr[i] = Array(dimensions[0])
                this.fill(arr[i], dimensions.slice(1, dimensions.length), type, traits)
            }
        }
    }
}

/**
 * @param {Readonly<symbol>} type 
 * @param {Trait[]} traits 
 * @returns {any}
 */
function zeroValue(type, traits) {
    let sz;
    switch (type) {
        case VAR_TYPES.BOOLEAN:
            return BOOL_VAL(false)
        case VAR_TYPES.INT:
            return INT_VAL(0)
        case VAR_TYPES.REAL:
            return FLOAT_VAL(0.0)
        case VAR_TYPES.CHARACTER:
            return new ObjString(" ".repeat(((sz = traits.find(t => t instanceof StringLen))) ? sz.len : 1))
    }

}

export class Value {
    /**
     * @param {Readonly<symbol>} type 
     * @param {any} object 
     */
    constructor(type, object) {
        this.type = type
        /**
         * @type {number|ObjString|ObjFunction|ObjArray}
         */
        this.object = object
    }

    toString() {
        switch (this.type) {
            case ValueType.VAL_FLOAT:
                return `${this.object.toFixed(8).padStart(13, " ")}`
            case ValueType.VAL_INT:
                return `${this.object}`.padStart(12, " ")
            case ValueType.VAL_BOOL:
                return this.object == true ? "T" : "F"
            case ValueType.VAL_OBJ:
                return this.toStringObject()
        }
    }

    toStringObject() {
        switch (this.object.obj_type) {
            case ObjTypes.OBJ_STRING:
                return this.object.chars;
            case ObjTypes.OBJ_FUNCTION:
                if (this.object.name === "") {
                    return "<program>"
                }
                return `<fn ${this.object.name}>`
            case ObjTypes.OBJ_ARRAY: {
                /**
                 * @type {Value}
                 */
                let res = ""
                for (const obj of this.object.objs) {
                    res += (obj.toString())
                    // obj.print()
                }
                return res
            }
        }
    }

    print() {
        console.log(this.toString())
    }
}

/**
 * @param {boolean} val 
 * @returns {Value}
 */
export function BOOL_VAL(val) {
    return new Value(ValueType.VAL_BOOL, val)
}

/**
 * @param {number} val 
 * @returns {Value}
 */
export function INT_VAL(val) {
    return new Value(ValueType.VAL_INT, val)
}

/**
 * @param {number} val 
 * @returns {Value}
 */
export function FLOAT_VAL(val) {
    return new Value(ValueType.VAL_FLOAT, val)
}



/**
 * @param {Value} val 
 * @returns {boolean}
 */
export function IS_BOOL(val) {
    return val.type == ValueType.VAL_BOOL
}

/**
 * @param {Value} val 
 * @returns {boolean}
 */
export function IS_INT(val) {
    return val.type == ValueType.VAL_INT
}

/**
 * @param {Value} val 
 * @returns {boolean}
 */
export function IS_FLOAT(val) {
    return val.type == ValueType.VAL_FLOAT
}

/**
 * @param {Value} val 
 * @param {Readonly<symbol>} type 
 * @returns {boolean}
 */
export function IS_OBJ_TYPE(val, type) {
    return IS_OBJ(val) && val.type === type
}

/**
 * @param {Value} val 
 * @returns {boolean}
 */
export function IS_OBJ(val) {
    return val instanceof Obj
}

/**
 * @param {Value} val 
 * @returns {boolean}
 */
export function IS_NUMBER(val) {
    return IS_INT(val) || IS_FLOAT(val)
}

export class Chunk {
    /**
     * @type {number[]}
     */
    code = []
    /**
     * @type {Value[]}
     */
    constants = []
    /**
     * @type {number[]}
     */
    lines = []
    /**
     * @param {number} byte 
     * @param {number} line 
     * @returns {void}
     */
    Write(byte, line) {
        this.code.push(byte)
        this.lines.push(line)
    }

    /**
     * @param {Value} value 
     * @returns {number}
     */
    AddConstant(value) {
        this.constants.push(value)
        return this.constants.length - 1
    }

    /**
     * @param {number} offset
     * @returns {void}
     */
    DisassembleInstruction(offset) {
        process.stdout.write(`${String(offset).padStart(4, '0')} `)
        if (offset > 0 && this.lines[offset] === this.lines[offset - 1] && this.lines[offset] !== undefined) {
            process.stdout.write("   | ");
        }
        let instruction = this.code[offset]

        let type = Object.entries(OpCode).find((val) => val[1] == instruction)
        if (type) {
            switch (type[1]) {
                case OpCode.OP_CONSTANT:
                case OpCode.OP_DEFINE_LOCAL:
                case OpCode.OP_DEFINE_GLOBAL:
                case OpCode.OP_GET_GLOBAL:
                case OpCode.OP_SET_GLOBAL:
                    return constantInstruction(type[0], this, offset)
                case OpCode.OP_SET_LOCAL:
                case OpCode.OP_GET_LOCAL:
                case OpCode.OP_CALL:
                    return byteInstruction(type[0], this, offset)
                case OpCode.OP_JUMP:
                case OpCode.OP_JUMP_IF_FALSE:
                    return jumpInstruction(type[0], 1, this, offset)
                case OpCode.OP_LOOP:
                    return jumpInstruction(type[0], -1, this, offset)
                case OpCode.OP_SET_STR:
                    return stringInstruction(type[0], this, offset)
                case OpCode.OP_GET_ARR:
                    return arrayInstruction(type[0], this, offset)

                default: return simpleInstruction(type[0], offset)
            }
        } else {
            console.log(`Unknown opcode ${instruction}`)
            return offset + 1
        }
        // switch (instruction) {

        //     case OpCode.OP_RETURN:
        //         return simpleInstruction("OP_RETURN", offset)
        //     case OpCode.OP_CONSTANT:
        //         return constantInstruction("OP_CONSTANT", this, offset)
        //     case OpCode.OP_NEGATE:
        //         return simpleInstruction("OP_NEGATE", offset)
        //     case OpCode.OP_ADD:
        //         return simpleInstruction("OP_ADD", offset);
        //     case OpCode.OP_MINUS:
        //         return simpleInstruction("OP_SUBTRACT", offset);
        //     case OpCode.OP_MUL:
        //         return simpleInstruction("OP_MULTIPLY", offset);
        //     case OpCode.OP_DIVIDE:
        //         return simpleInstruction("OP_DIVIDE", offset);
        //     case OpCode.OP_TRUE:
        //         return simpleInstruction("OP_TRUE", offset);
        //     case OpCode.OP_FALSE:
        //         return simpleInstruction("OP_FALSE", offset);
        //     case OpCode.OP_NOT:
        //         return simpleInstruction("OP_NOT", offset)
        //     case OpCode.OP_GREATER:
        //         return simpleInstruction("OP_GREATER", offset)
        //     case OpCode.OP_LESS:
        //         return simpleInstruction("OP_LESS", offset)
        //     case OpCode.OP_EQUAL:
        //         return simpleInstruction("OP_EQUAL", offset)
        //     case OpCode.OP_PRINT:
        //         return simpleInstruction("OP_PRINT", offset)
        //     default:
        //         console.log(`Unknown opcode ${instruction}\n`)
        //         return offset + 1
        // }
    }

    /**
     * @param {string} name
     * @returns {void}
     */
    DisassembleChunk(name) {
        console.log(`== ${name} ==`)
        for (let offset = 0; offset < this.code.length;) {
            offset = this.DisassembleInstruction(offset)
        }
    }
}


/**
 * @param {string} name 
 * @param {number} offset
 * @returns {number}
 */
function simpleInstruction(name, offset) {
    console.log(`${name}`)
    return offset + 1
}

/**
 * @param {string} name 
 * @param {Chunk} chunk 
 * @param {number} offset
 * @returns {number}
 */
function constantInstruction(name, chunk, offset) {
    let constant = chunk.code[offset + 1]

    process.stdout.write(`${name} ${String(constant).padStart(4, '0')} `)
    chunk.constants[constant].print()
    return offset + 2
}

/**
 * @param {string} name 
 * @param {Chunk} chunk 
 * @param {number} offset
 * @returns {number}
 */
function byteInstruction(name, chunk, offset) {
    let slot = chunk.code[offset + 1]
    console.log(`${name} ${String(slot).padStart(4, '0')}`)
    return offset + 2
}

function stringInstruction(name, chunk, offset) {
    let size = chunk.code[offset + 1]
    let slot = chunk.code[offset + 2]
    console.log(`${name} ${String(slot).padStart(4, '0')} SZ - ${size}`)
    return offset + 3
}

function arrayInstruction(name, chunk, offset) {
    let slot = chunk.code[offset + 1]
    let argsCount = chunk.code[offset + 2]
    console.log(`${name} ${String(slot).padStart(4, '0')} args - ${argsCount}`)
    return offset + 3
}

/**
 * @param {string} name 
 * @param {number} sign 
 * @param {Chunk} chunk 
 * @param {number} offset
 * @returns {number}
 */
function jumpInstruction(name, sign, chunk, offset) {
    let jump = chunk.code[offset + 1] << 8
    jump |= chunk.code[offset + 2]
    console.log(`${name} ${String(offset).padStart(4, '0')} -> ${String(offset + 3 + sign * jump).padStart(4, '0')}`)
    return offset + 3
}