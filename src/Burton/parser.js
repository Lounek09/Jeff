const fs = require('fs');


const METHOD_FLAGS = {
  NEED_ARGUMENTS: 1 << 0,
  NEED_ACTIVATION: 1 << 1,
  NEED_REST: 1 << 2,
  HAS_OPTIONAL: 1 << 3,
  IGNORE_REST: 1 << 4,
  NATIVE: 1 << 5,
  SET_DXNS: 1 << 6,
  HAS_PARAM_NAMES: 1 << 7,
};

// AVM 2 reader
module.exports = class Burton {
  constructor(readStream) {
    this._readStream = readStream;
  }

  read() {
    this.minorVersion = this._readStream.readUI16();
    this.majorVersion = this._readStream.readUI16();
    this.constantPool = this.readConstantPool();

    const a = this.constantPool.nameSpaces[this.constantPool.nameSpaces.length - 1];

    let len = this.readEncodedU32();
    this.methods = [];
    for (let i = 0; i < len; i++) {
      this.methods.push(this.readMethod());
    }

    len = this.readEncodedU32();
    this.metadata = [];
    for (let i = 0; i < len; i++) {
      this.metadata.push(this.readMetadata());
    }

    len = this.readEncodedU32();
    this.instances = [];
    for (let i = 0; i < len; i++) {
      this.instances.push(this.readInstance());
    }

    this.classes = [];
    for (let i = 0; i < len; i++) {
      this.classes.push(this.readClass());
    }

    len = this.readEncodedU32();
    this.scripts = [];
    for (let i = 0; i < len; i++) {
      this.scripts.push(this.readScript());
    }

    len = this.readEncodedU32();
    this.methodBodies = [];
    for (let i = 0; i < len-1; i++) {
      this.methodBodies.push(this.readMethodBody());
    }
  }

  readConstantPool() {
    let len = this.readEncodedU32();
    this.ints = [];
    for (let i = 0; i < len -1; i++) {
      this.ints.push(this._readStream.readSI32());
    }

    len = this.readEncodedU32();
    this.uints = [];
    for (let i = 0; i < len -1; i++) {
      this.uints.push(this.readEncodedU32());
    }

    len = this.readEncodedU32();
    this.doubles = [];
    for (let i = 0; i < len -1; i++) {
      this.doubles.push(this._readStream.readDouble());
    }

    len = this.readEncodedU32();
    this.strings = [];
    for (let i = 0; i < len -1; i++) {
      this.strings.push(this.readString());
    }

    len = this.readEncodedU32();
    this.nameSpaces = [];
    for (let i = 0; i < len-1; i++) {
      this.nameSpaces.push(this.readNamespace());
    }

    len = this.readEncodedU32();
    this.nameSpacesSets = [];
    for (let i = 0; i < len -1; i++) {
      this.nameSpacesSets.push(this.readNamespaceSets());
    }

    len = this.readEncodedU32();
    this.multinames = [];
    for (let i = 0; i < len-1; i++) {
      this.multinames.push(this.readMultiname());
    }

    return {
      ints: this.ints,
      uints: this.uints,
      doubles: this.doubles,
      strings: this.strings,
      nameSpaces: this.nameSpaces,
      nameSpacesSets: this.nameSpacesSets,
      multinames: this.multinames,
    };
  }

  readNamespace() {
    const kind = this._readStream.readUI8();
    const name = this.readEncodedU32();
    // TODO: AVM2 specs say that "non-system" namespaces
    // should have an empty name?

    const NAMESPACES = {
      [0x05]: 'private',
      [0x08]: 'namespace',
      [0x16]: 'package',
      [0x17]: 'package internal',
      [0x18]: 'protected',
      [0x19]: 'explicit',
      [0x1A]: 'static protected',
    }

    let type = NAMESPACES[kind];
    if (type === undefined) {
      throw new Error(`Unknown namespace kind ${kind} offset: ${this._readStream.offset.toString(16)}`);
    }
    return { type, name: this.strings[name - 1] };
  }

  readNamespaceSets() {
    const count = this.readEncodedU32();
    const sets = [];
    for (let i = 0; i < count; i++) {
      sets.push(this.nameSpaces[this.readEncodedU32() - 1]);
    }
    return sets;
  }

  readMultiname() {
    const kind = this._readStream.readUI8();

    const MULTINAMES = {
      [0x07]: () => {
        const namespaceIndex = this.readEncodedU32();
        const namespace = this.nameSpaces[namespaceIndex - 1];
        const nameIndex = this.readEncodedU32();
        const name = this.strings[nameIndex - 1];

        return { type: 'QName', namespaceIndex, namespace, nameIndex, name };
      },
      [0x0D]: () => {
        const nameSpaceIndex = this.readEncodedU32();
        const namespace = this.nameSpaces[nameSpaceIndex - 1];
        const nameIndex = this.readEncodedU32();
        const name = this.strings[nameIndex - 1];
        return { type: 'QNameA', namespace, nameSpaceIndex, name, nameIndex };
      },
      [0x0F]: () => {
        const nameIndex = this.readEncodedU32();
        const name = this.strings[nameIndex - 1];
        return { type: 'RTQName', name, nameIndex };
      },
      [0x10]: () => {
        const nameIndex = this.readEncodedU32();
        const name = this.strings[nameIndex - 1];
        return ({ type: 'RTQNameA', nameIndex, name });
      },
      [0x11]: () => ({ type: 'RTQNameL' }),
      [0x12]: () => ({ type: 'RTQNameLA' }),
      [0x09]: () => {
        const nameIndex = this.readEncodedU32();
        const name = this.strings[nameIndex - 1];
        const namespaceSetIndex = this.readEncodedU32();
        const namespaceSet = this.nameSpacesSets[namespaceSetIndex - 1];
        return { type: 'Multiname', name, nameIndex, namespaceSetIndex, namespaceSet };
      },
      [0x0E]: () => {
        const nameIndex = this.readEncodedU32();
        const name = this.strings[nameIndex - 1];
        const namespaceSetIndex = this.readEncodedU32();
        const namespaceSet = this.nameSpacesSets[namespaceSetIndex - 1];
        return { type: 'MultinameA', nameIndex, name, namespaceSetIndex, namespaceSet };
      },
      [0x1B]: () => {
        const namespaceSetIndex = this.readEncodedU32();
        const namespaceSet = this.nameSpacesSets[namespaceSetIndex - 1];
        return { type: 'MultinameL', namespaceSet, namespaceSetIndex };
      },
      [0x1C]: () => {
        const namespaceSetIndex = this.readEncodedU32();
        const namespaceSet = this.nameSpacesSets[namespaceSetIndex - 1];
        return { type: 'MultinameLA', namespaceSet, namespaceSetIndex };
      },
      [0x1D]: () => {
        const baseTypeIndex = this.readEncodedU32();
        const baseType = this.multinames[baseTypeIndex - 1];
        const count = this.readEncodedU32();
        const parameters = [];

        for (let i = 0; i < count; i++) {
          const nameIndex = this.readEncodedU32();
          const name = this.multinames[nameIndex - 1];
          parameters.push({ nameIndex, name });
        }

        return { type: 'TypeName', baseTypeIndex, baseType, parameters };
      },
    };

    return MULTINAMES[kind]();
  }

  readMethod() {
    const numParams = this.readEncodedU32();
    const returnTypeIndex = this.readEncodedU32();
    const returnType = this.multinames[returnTypeIndex - 1];

    const params = [];
    for (let i = 0; i < numParams; i++) {
      const kindIndex = this.readEncodedU32();
      params.push({ kindIndex, kind: this.multinames[kindIndex - 1], name: null, default_value: null });
    }

    const name = this.strings[this.readEncodedU32() - 1];
    const flags = this._readStream.readUI8();

    if (flags & METHOD_FLAGS.HAS_OPTIONAL) {
      const numOptionalParams = this.readEncodedU32();

      if (params.length - numOptionalParams < 0) {
        throw new Error('Invalid number of optional parameters');
      }
      for (let i = params.length - numOptionalParams; i < params.length; i++) {
        params[i].default_value = this.readConstantValue();
      }
    }

    if (flags & METHOD_FLAGS.HAS_PARAM_NAMES) {
      for (let i = 0; i < numParams; i++) {
        params[i].name = this.strings[this.readEncodedU32() - 1];
      }
    }

    return { name, params, returnType, flags };
  }

  readConstantValue() {
    const index = this.readEncodedU32();
    const kind = this._readStream.readUI8();

    const CONSTANT_VALUES = {
      [0x00]: () => undefined,
      [0x01]: () => this.constantPool.strings[index - 1],
      [0x03]: () => this.constantPool.ints[index - 1],
      [0x04]: () => this.constantPool.uints[index - 1],
      [0x05]: () => this.constantPool.nameSpaces[index - 1],
      [0x06]: () => this.constantPool.doubles[index - 1],
      [0x08]: () => this.constantPool.nameSpaces[index - 1],
      [0x0A]: () => false,
      [0x0B]: () => true,
      [0x0C]: () => null,
      [0x16]: () => this.constantPool.nameSpaces[index - 1],
      [0x17]: () => this.constantPool.nameSpaces[index - 1],
      [0x18]: () => this.constantPool.nameSpaces[index - 1],
      [0x19]: () => this.constantPool.nameSpaces[index - 1],
      [0x1A]: () => this.constantPool.nameSpaces[index - 1],
    };

    return CONSTANT_VALUES[kind]();
  }

  readOptionalValue() {
    const index = this.readEncodedU32();
    if (index === 0) {
      return;
    }
    const kind = this._readStream.readUI8();

    const CONSTANT_VALUES = {
      [0x00]: () => undefined,
      [0x01]: () => this.constantPool.strings[index - 1],
      [0x03]: () => this.constantPool.ints[index - 1],
      [0x04]: () => this.constantPool.uints[index - 1],
      [0x05]: () => this.constantPool.nameSpaces[index - 1],
      [0x06]: () => this.constantPool.doubles[index - 1],
      [0x08]: () => this.constantPool.nameSpaces[index - 1],
      [0x0A]: () => false,
      [0x0B]: () => true,
      [0x0C]: () => null,
      [0x16]: () => this.constantPool.nameSpaces[index - 1],
      [0x17]: () => this.constantPool.nameSpaces[index - 1],
      [0x18]: () => this.constantPool.nameSpaces[index - 1],
      [0x19]: () => this.constantPool.nameSpaces[index - 1],
      [0x1A]: () => this.constantPool.nameSpaces[index - 1],
    };

    return CONSTANT_VALUES[kind]();
  }

  readMetadata() {
    const nameIndex = this.readEncodedU32();
    const name = this.strings[nameIndex - 1];
    const itemCount = this.readEncodedU32();

    const items = [];
    for (let i = 0; i < itemCount; i++) {
      const keyIndex = this.readEncodedU32();
      const key = this.strings[keyIndex - 1];
      const valueIndex = this.readEncodedU32();
      const value = this.strings[valueIndex - 1];
      items.push({ keyIndex, key, valueIndex, value });
    }

    return { nameIndex, name, items };
  }

  readInstance() {
    const nameIndex = this.readEncodedU32()
    const name = this.multinames[nameIndex - 1];
    const superNameIndex = this.readEncodedU32()
    const superName = this.multinames[superNameIndex - 1];
    const flags = this._readStream.readUI8();

    const protectedNamespaceIndex = flags & 0x08 ? this.readEncodedU32() : null;
    const protectedNamespace = protectedNamespaceIndex !== null ? this.nameSpaces[protectedNamespaceIndex - 1] : null;
    const interfaces = [];
    const interfaceCount = this.readEncodedU32();
    for (let i = 0; i < interfaceCount; i++) {
      const interfaceIndex = this.readEncodedU32();
      const interfaceName = this.multinames[interfaceIndex - 1];
      interfaces.push({ interfaceIndex, interfaceName });
    }

    const init_method_index = this.readEncodedU32();
    const init_method = this.methods[init_method_index];
    const numTraits = this.readEncodedU32();
    const traits = [];
    for (let i = 0; i < numTraits; i++) {
      traits.push(this.readTrait());
    }

    return {
      nameIndex,
      name,
      superNameIndex,
      superName,
      protectedNamespaceIndex,
      protectedNamespace,
      interfaces,
      traits,
      init_method_index,
      init_method,
      flags,
      isSealed: flags & 0x01 !== 0,
      isFinal: flags & 0x02 !== 0,
      isInterface: flags & 0x04 !== 0,
    };
  }

  readTrait() {
    const nameIndex = this.readEncodedU32();
    const name = this.multinames[nameIndex - 1];
    const flags = this._readStream.readUI8();

    const KIND = {
      [0]: () => {
        const slotId = this.readEncodedU32();
        const typeNameIndex = this.readEncodedU32();
        const typeName = this.multinames[typeNameIndex - 1];
        const value = this.readOptionalValue();
        return { type: 'Slot', slotId, typeNameIndex, typeName, value };
      },
      [1]: () => {
        const dispId = this.readEncodedU32();
        const methodIndex = this.readEncodedU32();
        const method = this.methods[methodIndex];
        return { type: 'Method', dispId, methodIndex, method };
      },
      [2]: () => {
        const dispId = this.readEncodedU32();
        const methodIndex = this.readEncodedU32();
        const method = this.methods[methodIndex];
        return { type: 'Getter',dispId, methodIndex, method };
      },
      [3]: () => {
        const dispId = this.readEncodedU32();
        const methodIndex = this.readEncodedU32();
        const method = this.methods[methodIndex];
        return { type: 'Setter',dispId, methodIndex, method };
      },
      [4]: () => {
        const slotId = this.readEncodedU32();
        const classIndex = this.readEncodedU32();
        const classInfo = this.classes[classIndex];
        return { type: 'Class', slotId, classIndex, class: classInfo };
      },
      [5]: () => {
        const slotId = this.readEncodedU32();
        const functionIndex = this.readEncodedU32();
        const functionInfo = this.methods[functionIndex];
        return ({ type: 'Function', slotId, functionIndex, function: functionInfo })
      },
      [6]: () => {
        const slotId = this.readEncodedU32();
        const typeNameIndex = this.readEncodedU32();
        const typeName = this.multinames[typeNameIndex - 1];
        const value = this.readOptionalValue();
        return ({ type: 'Const', slotId, typeNameIndex, typeName, value });
      },
    };

    const kind = KIND[flags & 0b1111]();

    const metadata = [];
    if (flags & 0b01000000) {
      const metadataCount = this.readEncodedU32();
      for (let i = 0; i < metadataCount; i++) {
        const metadataIndex = this.readEncodedU32();
        const metadataInfo = this.metadata[metadataIndex];
        metadata.push({ metadataIndex, metadata: metadataInfo });
      }
    }

    return { name, flags, metadata, ...kind, isFinal: flags & 0b00010000 !== 0, isOverride: flags & 0b00100000 !== 0 };
  }

  readClass() {
    const initMethodIndex = this.readEncodedU32();
    const initMethod = this.methods[initMethodIndex];
    const numTraits = this.readEncodedU32();
    const traits = [];
    for (let i = 0; i < numTraits; i++) {
      traits.push(this.readTrait());
    }

    return { initMethodIndex, initMethod, traits };
  }

  readScript() {
    const initMethodIndex = this.readEncodedU32();
    const initMethod = this.methods[initMethodIndex];
    const numTraits = this.readEncodedU32();
    const traits = [];
    for (let i = 0; i < numTraits; i++) {
      traits.push(this.readTrait());
    }

    return { initMethodIndex, initMethod, traits };
  }

  readMethodBody() {
    const method = this.readEncodedU32();
    const maxStack = this.readEncodedU32();
    const localCount = this.readEncodedU32();
    const initScopeDepth = this.readEncodedU32();
    const maxScopeDepth = this.readEncodedU32();
    const code = this._readStream.readBytes(this.readEncodedU32());
    const exceptionCount = this.readEncodedU32();
    const exceptions = [];
    for (let i = 0; i < exceptionCount; i++) {
      exceptions.push({
        from: this.readEncodedU32(),
        to: this.readEncodedU32(),
        target: this.readEncodedU32(),
        type: this.readEncodedU32(),
        name: this.readEncodedU32(),
      });
    }

    const traitCount = this.readEncodedU32();
    const traits = [];
    for (let i = 0; i < traitCount; i++) {
      traits.push(this.readTrait());
    }

    return { method, maxStack, localCount, initScopeDepth, maxScopeDepth, code, exceptions, traits };
  }

  readEncodedU32() {
    let val = 0;

    for (let i = 0; i < 35; i += 7) {
      const b = this._readStream.readUI8();
      val |= (b & 0b0111_1111) << i;
      if ((b & 0b1000_0000) === 0) {
        break;
      }
    }

    return val;
  }

  readString() {
    const length = this.readEncodedU32();
    return this._readStream.readBytes(length).toString();
  }

  toData() {
    const extendsInformation = {};

    this.instances.map((instance) => {
      const name = instance.name.name
      if (instance.superName && instance.superName.name) {
        extendsInformation[name] = instance.superName.name;
      }
    });
    return extendsInformation;
  }
}
