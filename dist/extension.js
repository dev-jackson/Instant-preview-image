/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deactivate = exports.activate = void 0;
const path_1 = __importDefault(__webpack_require__(2));
const vscode = __importStar(__webpack_require__(1));
const fs = __importStar(__webpack_require__(3));
const image_size_1 = __importDefault(__webpack_require__(4));
function activate(context) {
    const supportedLanguages = ["javascript", 'typescript'];
    const provider = vscode.languages.registerHoverProvider(supportedLanguages, {
        async provideHover(document, position, token) {
            const line = document.lineAt(position.line);
            const text = line.text;
            // Expresión regular para encontrar importaciones de imágenes
            const regex = /(['"])(.+?\.(png|jpg|jpeg|gif|svg))\1/;
            const match = regex.exec(text);
            if (!match) {
                return undefined;
            }
            const matchedText = match[2]; // El segundo grupo de captura contiene la ruta del archivo
            const matchedRange = new vscode.Range(line.lineNumber, match.index, line.lineNumber, match.index + match[0].length);
            if (!matchedText) {
                return undefined;
            }
            const fileExtensions = vscode.workspace.getConfiguration().get('instantPreviewImage.fileExtensions') || ['.png', '.jpg', '.jpeg', '.gif', '.svg'];
            if (fileExtensions.some(ext => matchedText.endsWith(ext))) {
                const filePath = path_1.default.resolve(path_1.default.dirname(document.uri.fsPath), matchedText);
                const imagePath = vscode.Uri.file(filePath);
                if (!fs.existsSync(filePath)) {
                    return undefined;
                }
                try {
                    const dimensions = (0, image_size_1.default)(filePath);
                    const markdownString = new vscode.MarkdownString();
                    markdownString.appendMarkdown(`![Image Preview](${imagePath.toString()})\n\n`);
                    markdownString.appendMarkdown(`**File Name:** ${path_1.default.basename(filePath)}\n\n`);
                    markdownString.appendMarkdown(`**Type:** ${dimensions.type?.toUpperCase()}\n\n`);
                    markdownString.appendMarkdown(`**Dimensions:** ${dimensions.width} x ${dimensions.height} px`);
                    markdownString.isTrusted = true;
                    return new vscode.Hover(markdownString, matchedRange);
                }
                catch (err) {
                    console.error(err);
                    return undefined;
                }
            }
            return undefined;
        },
    });
    context.subscriptions.push(provider);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;


/***/ }),
/* 1 */
/***/ ((module) => {

"use strict";
module.exports = require("vscode");

/***/ }),
/* 2 */
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ }),
/* 3 */
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),
/* 4 */
/***/ ((module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.types = exports.setConcurrency = exports.disableTypes = exports.disableFS = exports.imageSize = void 0;
const fs = __webpack_require__(3);
const path = __webpack_require__(2);
const queue_1 = __webpack_require__(5);
const index_1 = __webpack_require__(10);
const detector_1 = __webpack_require__(30);
// Maximum input size, with a default of 512 kilobytes.
// TO-DO: make this adaptive based on the initial signature of the image
const MaxInputSize = 512 * 1024;
// This queue is for async `fs` operations, to avoid reaching file-descriptor limits
const queue = new queue_1.default({ concurrency: 100, autostart: true });
const globalOptions = {
    disabledFS: false,
    disabledTypes: [],
};
/**
 * Return size information based on an Uint8Array
 *
 * @param {Uint8Array} input
 * @param {String} filepath
 * @returns {Object}
 */
function lookup(input, filepath) {
    // detect the file type.. don't rely on the extension
    const type = (0, detector_1.detector)(input);
    if (typeof type !== 'undefined') {
        if (globalOptions.disabledTypes.indexOf(type) > -1) {
            throw new TypeError('disabled file type: ' + type);
        }
        // find an appropriate handler for this file type
        if (type in index_1.typeHandlers) {
            const size = index_1.typeHandlers[type].calculate(input, filepath);
            if (size !== undefined) {
                size.type = size.type ?? type;
                return size;
            }
        }
    }
    // throw up, if we don't understand the file
    throw new TypeError('unsupported file type: ' + type + ' (file: ' + filepath + ')');
}
/**
 * Reads a file into an Uint8Array.
 * @param {String} filepath
 * @returns {Promise<Uint8Array>}
 */
async function readFileAsync(filepath) {
    const handle = await fs.promises.open(filepath, 'r');
    try {
        const { size } = await handle.stat();
        if (size <= 0) {
            throw new Error('Empty file');
        }
        const inputSize = Math.min(size, MaxInputSize);
        const input = new Uint8Array(inputSize);
        await handle.read(input, 0, inputSize, 0);
        return input;
    }
    finally {
        await handle.close();
    }
}
/**
 * Synchronously reads a file into an Uint8Array, blocking the nodejs process.
 *
 * @param {String} filepath
 * @returns {Uint8Array}
 */
function readFileSync(filepath) {
    // read from the file, synchronously
    const descriptor = fs.openSync(filepath, 'r');
    try {
        const { size } = fs.fstatSync(descriptor);
        if (size <= 0) {
            throw new Error('Empty file');
        }
        const inputSize = Math.min(size, MaxInputSize);
        const input = new Uint8Array(inputSize);
        fs.readSync(descriptor, input, 0, inputSize, 0);
        return input;
    }
    finally {
        fs.closeSync(descriptor);
    }
}
// eslint-disable-next-line @typescript-eslint/no-use-before-define
module.exports = exports = imageSize; // backwards compatibility
exports["default"] = imageSize;
/**
 * @param {Uint8Array|string} input - Uint8Array or relative/absolute path of the image file
 * @param {Function=} [callback] - optional function for async detection
 */
function imageSize(input, callback) {
    // Handle Uint8Array input
    if (input instanceof Uint8Array) {
        return lookup(input);
    }
    // input should be a string at this point
    if (typeof input !== 'string' || globalOptions.disabledFS) {
        throw new TypeError('invalid invocation. input should be a Uint8Array');
    }
    // resolve the file path
    const filepath = path.resolve(input);
    if (typeof callback === 'function') {
        queue.push(() => readFileAsync(filepath)
            .then((input) => process.nextTick(callback, null, lookup(input, filepath)))
            .catch(callback));
    }
    else {
        const input = readFileSync(filepath);
        return lookup(input, filepath);
    }
}
exports.imageSize = imageSize;
const disableFS = (v) => {
    globalOptions.disabledFS = v;
};
exports.disableFS = disableFS;
const disableTypes = (types) => {
    globalOptions.disabledTypes = types;
};
exports.disableTypes = disableTypes;
const setConcurrency = (c) => {
    queue.concurrency = c;
};
exports.setConcurrency = setConcurrency;
exports.types = Object.keys(index_1.typeHandlers);


/***/ }),
/* 5 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var inherits = __webpack_require__(6)
var EventEmitter = (__webpack_require__(9).EventEmitter)

module.exports = Queue
module.exports["default"] = Queue

function Queue (options) {
  if (!(this instanceof Queue)) {
    return new Queue(options)
  }

  EventEmitter.call(this)
  options = options || {}
  this.concurrency = options.concurrency || Infinity
  this.timeout = options.timeout || 0
  this.autostart = options.autostart || false
  this.results = options.results || null
  this.pending = 0
  this.session = 0
  this.running = false
  this.jobs = []
  this.timers = {}
}
inherits(Queue, EventEmitter)

var arrayMethods = [
  'pop',
  'shift',
  'indexOf',
  'lastIndexOf'
]

arrayMethods.forEach(function (method) {
  Queue.prototype[method] = function () {
    return Array.prototype[method].apply(this.jobs, arguments)
  }
})

Queue.prototype.slice = function (begin, end) {
  this.jobs = this.jobs.slice(begin, end)
  return this
}

Queue.prototype.reverse = function () {
  this.jobs.reverse()
  return this
}

var arrayAddMethods = [
  'push',
  'unshift',
  'splice'
]

arrayAddMethods.forEach(function (method) {
  Queue.prototype[method] = function () {
    var methodResult = Array.prototype[method].apply(this.jobs, arguments)
    if (this.autostart) {
      this.start()
    }
    return methodResult
  }
})

Object.defineProperty(Queue.prototype, 'length', {
  get: function () {
    return this.pending + this.jobs.length
  }
})

Queue.prototype.start = function (cb) {
  if (cb) {
    callOnErrorOrEnd.call(this, cb)
  }

  this.running = true

  if (this.pending >= this.concurrency) {
    return
  }

  if (this.jobs.length === 0) {
    if (this.pending === 0) {
      done.call(this)
    }
    return
  }

  var self = this
  var job = this.jobs.shift()
  var once = true
  var session = this.session
  var timeoutId = null
  var didTimeout = false
  var resultIndex = null
  var timeout = job.hasOwnProperty('timeout') ? job.timeout : this.timeout

  function next (err, result) {
    if (once && self.session === session) {
      once = false
      self.pending--
      if (timeoutId !== null) {
        delete self.timers[timeoutId]
        clearTimeout(timeoutId)
      }

      if (err) {
        self.emit('error', err, job)
      } else if (didTimeout === false) {
        if (resultIndex !== null) {
          self.results[resultIndex] = Array.prototype.slice.call(arguments, 1)
        }
        self.emit('success', result, job)
      }

      if (self.session === session) {
        if (self.pending === 0 && self.jobs.length === 0) {
          done.call(self)
        } else if (self.running) {
          self.start()
        }
      }
    }
  }

  if (timeout) {
    timeoutId = setTimeout(function () {
      didTimeout = true
      if (self.listeners('timeout').length > 0) {
        self.emit('timeout', next, job)
      } else {
        next()
      }
    }, timeout)
    this.timers[timeoutId] = timeoutId
  }

  if (this.results) {
    resultIndex = this.results.length
    this.results[resultIndex] = null
  }

  this.pending++
  self.emit('start', job)
  var promise = job(next)
  if (promise && promise.then && typeof promise.then === 'function') {
    promise.then(function (result) {
      return next(null, result)
    }).catch(function (err) {
      return next(err || true)
    })
  }

  if (this.running && this.jobs.length > 0) {
    this.start()
  }
}

Queue.prototype.stop = function () {
  this.running = false
}

Queue.prototype.end = function (err) {
  clearTimers.call(this)
  this.jobs.length = 0
  this.pending = 0
  done.call(this, err)
}

function clearTimers () {
  for (var key in this.timers) {
    var timeoutId = this.timers[key]
    delete this.timers[key]
    clearTimeout(timeoutId)
  }
}

function callOnErrorOrEnd (cb) {
  var self = this
  this.on('error', onerror)
  this.on('end', onend)

  function onerror (err) { self.end(err) }
  function onend (err) {
    self.removeListener('error', onerror)
    self.removeListener('end', onend)
    cb(err, this.results)
  }
}

function done (err) {
  this.session++
  this.running = false
  this.emit('end', err)
}


/***/ }),
/* 6 */
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

try {
  var util = __webpack_require__(7);
  /* istanbul ignore next */
  if (typeof util.inherits !== 'function') throw '';
  module.exports = util.inherits;
} catch (e) {
  /* istanbul ignore next */
  module.exports = __webpack_require__(8);
}


/***/ }),
/* 7 */
/***/ ((module) => {

"use strict";
module.exports = require("util");

/***/ }),
/* 8 */
/***/ ((module) => {

if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      })
    }
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      var TempCtor = function () {}
      TempCtor.prototype = superCtor.prototype
      ctor.prototype = new TempCtor()
      ctor.prototype.constructor = ctor
    }
  }
}


/***/ }),
/* 9 */
/***/ ((module) => {

"use strict";
module.exports = require("events");

/***/ }),
/* 10 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.typeHandlers = void 0;
// load all available handlers explicitly for browserify support
const bmp_1 = __webpack_require__(11);
const cur_1 = __webpack_require__(13);
const dds_1 = __webpack_require__(15);
const gif_1 = __webpack_require__(16);
const heif_1 = __webpack_require__(17);
const icns_1 = __webpack_require__(18);
const ico_1 = __webpack_require__(14);
const j2c_1 = __webpack_require__(19);
const jp2_1 = __webpack_require__(20);
const jpg_1 = __webpack_require__(21);
const ktx_1 = __webpack_require__(22);
const png_1 = __webpack_require__(23);
const pnm_1 = __webpack_require__(24);
const psd_1 = __webpack_require__(25);
const svg_1 = __webpack_require__(26);
const tga_1 = __webpack_require__(27);
const tiff_1 = __webpack_require__(28);
const webp_1 = __webpack_require__(29);
exports.typeHandlers = {
    bmp: bmp_1.BMP,
    cur: cur_1.CUR,
    dds: dds_1.DDS,
    gif: gif_1.GIF,
    heif: heif_1.HEIF,
    icns: icns_1.ICNS,
    ico: ico_1.ICO,
    j2c: j2c_1.J2C,
    jp2: jp2_1.JP2,
    jpg: jpg_1.JPG,
    ktx: ktx_1.KTX,
    png: png_1.PNG,
    pnm: pnm_1.PNM,
    psd: psd_1.PSD,
    svg: svg_1.SVG,
    tga: tga_1.TGA,
    tiff: tiff_1.TIFF,
    webp: webp_1.WEBP,
};


/***/ }),
/* 11 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.BMP = void 0;
const utils_1 = __webpack_require__(12);
exports.BMP = {
    validate: (input) => (0, utils_1.toUTF8String)(input, 0, 2) === 'BM',
    calculate: (input) => ({
        height: Math.abs((0, utils_1.readInt32LE)(input, 22)),
        width: (0, utils_1.readUInt32LE)(input, 18),
    }),
};


/***/ }),
/* 12 */
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.findBox = exports.readUInt = exports.readUInt32LE = exports.readUInt32BE = exports.readInt32LE = exports.readUInt24LE = exports.readUInt16LE = exports.readUInt16BE = exports.readInt16LE = exports.toHexString = exports.toUTF8String = void 0;
const decoder = new TextDecoder();
const toUTF8String = (input, start = 0, end = input.length) => decoder.decode(input.slice(start, end));
exports.toUTF8String = toUTF8String;
const toHexString = (input, start = 0, end = input.length) => input
    .slice(start, end)
    .reduce((memo, i) => memo + ('0' + i.toString(16)).slice(-2), '');
exports.toHexString = toHexString;
const readInt16LE = (input, offset = 0) => {
    const val = input[offset] + input[offset + 1] * 2 ** 8;
    return val | ((val & (2 ** 15)) * 0x1fffe);
};
exports.readInt16LE = readInt16LE;
const readUInt16BE = (input, offset = 0) => input[offset] * 2 ** 8 + input[offset + 1];
exports.readUInt16BE = readUInt16BE;
const readUInt16LE = (input, offset = 0) => input[offset] + input[offset + 1] * 2 ** 8;
exports.readUInt16LE = readUInt16LE;
const readUInt24LE = (input, offset = 0) => input[offset] + input[offset + 1] * 2 ** 8 + input[offset + 2] * 2 ** 16;
exports.readUInt24LE = readUInt24LE;
const readInt32LE = (input, offset = 0) => input[offset] +
    input[offset + 1] * 2 ** 8 +
    input[offset + 2] * 2 ** 16 +
    (input[offset + 3] << 24);
exports.readInt32LE = readInt32LE;
const readUInt32BE = (input, offset = 0) => input[offset] * 2 ** 24 +
    input[offset + 1] * 2 ** 16 +
    input[offset + 2] * 2 ** 8 +
    input[offset + 3];
exports.readUInt32BE = readUInt32BE;
const readUInt32LE = (input, offset = 0) => input[offset] +
    input[offset + 1] * 2 ** 8 +
    input[offset + 2] * 2 ** 16 +
    input[offset + 3] * 2 ** 24;
exports.readUInt32LE = readUInt32LE;
// Abstract reading multi-byte unsigned integers
const methods = {
    readUInt16BE: exports.readUInt16BE,
    readUInt16LE: exports.readUInt16LE,
    readUInt32BE: exports.readUInt32BE,
    readUInt32LE: exports.readUInt32LE,
};
function readUInt(input, bits, offset, isBigEndian) {
    offset = offset || 0;
    const endian = isBigEndian ? 'BE' : 'LE';
    const methodName = ('readUInt' + bits + endian);
    return methods[methodName](input, offset);
}
exports.readUInt = readUInt;
function readBox(buffer, offset) {
    if (buffer.length - offset < 4)
        return;
    const boxSize = (0, exports.readUInt32BE)(buffer, offset);
    if (buffer.length - offset < boxSize)
        return;
    return {
        name: (0, exports.toUTF8String)(buffer, 4 + offset, 8 + offset),
        offset,
        size: boxSize,
    };
}
function findBox(buffer, boxName, offset) {
    while (offset < buffer.length) {
        const box = readBox(buffer, offset);
        if (!box)
            break;
        if (box.name === boxName)
            return box;
        offset += box.size;
    }
}
exports.findBox = findBox;


/***/ }),
/* 13 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CUR = void 0;
const ico_1 = __webpack_require__(14);
const utils_1 = __webpack_require__(12);
const TYPE_CURSOR = 2;
exports.CUR = {
    validate(input) {
        const reserved = (0, utils_1.readUInt16LE)(input, 0);
        const imageCount = (0, utils_1.readUInt16LE)(input, 4);
        if (reserved !== 0 || imageCount === 0)
            return false;
        const imageType = (0, utils_1.readUInt16LE)(input, 2);
        return imageType === TYPE_CURSOR;
    },
    calculate: (input) => ico_1.ICO.calculate(input),
};


/***/ }),
/* 14 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ICO = void 0;
const utils_1 = __webpack_require__(12);
const TYPE_ICON = 1;
/**
 * ICON Header
 *
 * | Offset | Size | Purpose |
 * | 0	    | 2    | Reserved. Must always be 0.  |
 * | 2      | 2    | Image type: 1 for icon (.ICO) image, 2 for cursor (.CUR) image. Other values are invalid. |
 * | 4      | 2    | Number of images in the file. |
 *
 */
const SIZE_HEADER = 2 + 2 + 2; // 6
/**
 * Image Entry
 *
 * | Offset | Size | Purpose |
 * | 0	    | 1    | Image width in pixels. Can be any number between 0 and 255. Value 0 means width is 256 pixels. |
 * | 1      | 1    | Image height in pixels. Can be any number between 0 and 255. Value 0 means height is 256 pixels. |
 * | 2      | 1    | Number of colors in the color palette. Should be 0 if the image does not use a color palette. |
 * | 3      | 1    | Reserved. Should be 0. |
 * | 4      | 2    | ICO format: Color planes. Should be 0 or 1. |
 * |        |      | CUR format: The horizontal coordinates of the hotspot in number of pixels from the left. |
 * | 6      | 2    | ICO format: Bits per pixel. |
 * |        |      | CUR format: The vertical coordinates of the hotspot in number of pixels from the top. |
 * | 8      | 4    | The size of the image's data in bytes |
 * | 12     | 4    | The offset of BMP or PNG data from the beginning of the ICO/CUR file |
 *
 */
const SIZE_IMAGE_ENTRY = 1 + 1 + 1 + 1 + 2 + 2 + 4 + 4; // 16
function getSizeFromOffset(input, offset) {
    const value = input[offset];
    return value === 0 ? 256 : value;
}
function getImageSize(input, imageIndex) {
    const offset = SIZE_HEADER + imageIndex * SIZE_IMAGE_ENTRY;
    return {
        height: getSizeFromOffset(input, offset + 1),
        width: getSizeFromOffset(input, offset),
    };
}
exports.ICO = {
    validate(input) {
        const reserved = (0, utils_1.readUInt16LE)(input, 0);
        const imageCount = (0, utils_1.readUInt16LE)(input, 4);
        if (reserved !== 0 || imageCount === 0)
            return false;
        const imageType = (0, utils_1.readUInt16LE)(input, 2);
        return imageType === TYPE_ICON;
    },
    calculate(input) {
        const nbImages = (0, utils_1.readUInt16LE)(input, 4);
        const imageSize = getImageSize(input, 0);
        if (nbImages === 1)
            return imageSize;
        const imgs = [imageSize];
        for (let imageIndex = 1; imageIndex < nbImages; imageIndex += 1) {
            imgs.push(getImageSize(input, imageIndex));
        }
        return {
            height: imageSize.height,
            images: imgs,
            width: imageSize.width,
        };
    },
};


/***/ }),
/* 15 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DDS = void 0;
const utils_1 = __webpack_require__(12);
exports.DDS = {
    validate: (input) => (0, utils_1.readUInt32LE)(input, 0) === 0x20534444,
    calculate: (input) => ({
        height: (0, utils_1.readUInt32LE)(input, 12),
        width: (0, utils_1.readUInt32LE)(input, 16),
    }),
};


/***/ }),
/* 16 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GIF = void 0;
const utils_1 = __webpack_require__(12);
const gifRegexp = /^GIF8[79]a/;
exports.GIF = {
    validate: (input) => gifRegexp.test((0, utils_1.toUTF8String)(input, 0, 6)),
    calculate: (input) => ({
        height: (0, utils_1.readUInt16LE)(input, 8),
        width: (0, utils_1.readUInt16LE)(input, 6),
    }),
};


/***/ }),
/* 17 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HEIF = void 0;
const utils_1 = __webpack_require__(12);
const brandMap = {
    avif: 'avif',
    mif1: 'heif',
    msf1: 'heif', // hief-sequence
    heic: 'heic',
    heix: 'heic',
    hevc: 'heic', // heic-sequence
    hevx: 'heic', // heic-sequence
};
exports.HEIF = {
    validate(buffer) {
        const ftype = (0, utils_1.toUTF8String)(buffer, 4, 8);
        const brand = (0, utils_1.toUTF8String)(buffer, 8, 12);
        return 'ftyp' === ftype && brand in brandMap;
    },
    calculate(buffer) {
        // Based on https://nokiatech.github.io/heif/technical.html
        const metaBox = (0, utils_1.findBox)(buffer, 'meta', 0);
        const iprpBox = metaBox && (0, utils_1.findBox)(buffer, 'iprp', metaBox.offset + 12);
        const ipcoBox = iprpBox && (0, utils_1.findBox)(buffer, 'ipco', iprpBox.offset + 8);
        const ispeBox = ipcoBox && (0, utils_1.findBox)(buffer, 'ispe', ipcoBox.offset + 8);
        if (ispeBox) {
            return {
                height: (0, utils_1.readUInt32BE)(buffer, ispeBox.offset + 16),
                width: (0, utils_1.readUInt32BE)(buffer, ispeBox.offset + 12),
                type: (0, utils_1.toUTF8String)(buffer, 8, 12),
            };
        }
        throw new TypeError('Invalid HEIF, no size found');
    }
};


/***/ }),
/* 18 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ICNS = void 0;
const utils_1 = __webpack_require__(12);
/**
 * ICNS Header
 *
 * | Offset | Size | Purpose                                                |
 * | 0	    | 4    | Magic literal, must be "icns" (0x69, 0x63, 0x6e, 0x73) |
 * | 4      | 4    | Length of file, in bytes, msb first.                   |
 *
 */
const SIZE_HEADER = 4 + 4; // 8
const FILE_LENGTH_OFFSET = 4; // MSB => BIG ENDIAN
/**
 * Image Entry
 *
 * | Offset | Size | Purpose                                                          |
 * | 0	    | 4    | Icon type, see OSType below.                                     |
 * | 4      | 4    | Length of data, in bytes (including type and length), msb first. |
 * | 8      | n    | Icon data                                                        |
 */
const ENTRY_LENGTH_OFFSET = 4; // MSB => BIG ENDIAN
const ICON_TYPE_SIZE = {
    ICON: 32,
    'ICN#': 32,
    // m => 16 x 16
    'icm#': 16,
    icm4: 16,
    icm8: 16,
    // s => 16 x 16
    'ics#': 16,
    ics4: 16,
    ics8: 16,
    is32: 16,
    s8mk: 16,
    icp4: 16,
    // l => 32 x 32
    icl4: 32,
    icl8: 32,
    il32: 32,
    l8mk: 32,
    icp5: 32,
    ic11: 32,
    // h => 48 x 48
    ich4: 48,
    ich8: 48,
    ih32: 48,
    h8mk: 48,
    // . => 64 x 64
    icp6: 64,
    ic12: 32,
    // t => 128 x 128
    it32: 128,
    t8mk: 128,
    ic07: 128,
    // . => 256 x 256
    ic08: 256,
    ic13: 256,
    // . => 512 x 512
    ic09: 512,
    ic14: 512,
    // . => 1024 x 1024
    ic10: 1024,
};
function readImageHeader(input, imageOffset) {
    const imageLengthOffset = imageOffset + ENTRY_LENGTH_OFFSET;
    return [
        (0, utils_1.toUTF8String)(input, imageOffset, imageLengthOffset),
        (0, utils_1.readUInt32BE)(input, imageLengthOffset),
    ];
}
function getImageSize(type) {
    const size = ICON_TYPE_SIZE[type];
    return { width: size, height: size, type };
}
exports.ICNS = {
    validate: (input) => (0, utils_1.toUTF8String)(input, 0, 4) === 'icns',
    calculate(input) {
        const inputLength = input.length;
        const fileLength = (0, utils_1.readUInt32BE)(input, FILE_LENGTH_OFFSET);
        let imageOffset = SIZE_HEADER;
        let imageHeader = readImageHeader(input, imageOffset);
        let imageSize = getImageSize(imageHeader[0]);
        imageOffset += imageHeader[1];
        if (imageOffset === fileLength)
            return imageSize;
        const result = {
            height: imageSize.height,
            images: [imageSize],
            width: imageSize.width,
        };
        while (imageOffset < fileLength && imageOffset < inputLength) {
            imageHeader = readImageHeader(input, imageOffset);
            imageSize = getImageSize(imageHeader[0]);
            imageOffset += imageHeader[1];
            result.images.push(imageSize);
        }
        return result;
    },
};


/***/ }),
/* 19 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.J2C = void 0;
const utils_1 = __webpack_require__(12);
exports.J2C = {
    // TODO: this doesn't seem right. SIZ marker doesn't have to be right after the SOC
    validate: (input) => (0, utils_1.toHexString)(input, 0, 4) === 'ff4fff51',
    calculate: (input) => ({
        height: (0, utils_1.readUInt32BE)(input, 12),
        width: (0, utils_1.readUInt32BE)(input, 8),
    }),
};


/***/ }),
/* 20 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.JP2 = void 0;
const utils_1 = __webpack_require__(12);
exports.JP2 = {
    validate(input) {
        if ((0, utils_1.readUInt32BE)(input, 4) !== 0x6a502020 || (0, utils_1.readUInt32BE)(input, 0) < 1)
            return false;
        const ftypBox = (0, utils_1.findBox)(input, 'ftyp', 0);
        if (!ftypBox)
            return false;
        return (0, utils_1.readUInt32BE)(input, ftypBox.offset + 4) === 0x66747970;
    },
    calculate(input) {
        const jp2hBox = (0, utils_1.findBox)(input, 'jp2h', 0);
        const ihdrBox = jp2hBox && (0, utils_1.findBox)(input, 'ihdr', jp2hBox.offset + 8);
        if (ihdrBox) {
            return {
                height: (0, utils_1.readUInt32BE)(input, ihdrBox.offset + 8),
                width: (0, utils_1.readUInt32BE)(input, ihdrBox.offset + 12),
            };
        }
        throw new TypeError('Unsupported JPEG 2000 format');
    },
};


/***/ }),
/* 21 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

// NOTE: we only support baseline and progressive JPGs here
// due to the structure of the loader class, we only get a buffer
// with a maximum size of 4096 bytes. so if the SOF marker is outside
// if this range we can't detect the file size correctly.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.JPG = void 0;
const utils_1 = __webpack_require__(12);
const EXIF_MARKER = '45786966';
const APP1_DATA_SIZE_BYTES = 2;
const EXIF_HEADER_BYTES = 6;
const TIFF_BYTE_ALIGN_BYTES = 2;
const BIG_ENDIAN_BYTE_ALIGN = '4d4d';
const LITTLE_ENDIAN_BYTE_ALIGN = '4949';
// Each entry is exactly 12 bytes
const IDF_ENTRY_BYTES = 12;
const NUM_DIRECTORY_ENTRIES_BYTES = 2;
function isEXIF(input) {
    return (0, utils_1.toHexString)(input, 2, 6) === EXIF_MARKER;
}
function extractSize(input, index) {
    return {
        height: (0, utils_1.readUInt16BE)(input, index),
        width: (0, utils_1.readUInt16BE)(input, index + 2),
    };
}
function extractOrientation(exifBlock, isBigEndian) {
    // TODO: assert that this contains 0x002A
    // let STATIC_MOTOROLA_TIFF_HEADER_BYTES = 2
    // let TIFF_IMAGE_FILE_DIRECTORY_BYTES = 4
    // TODO: derive from TIFF_IMAGE_FILE_DIRECTORY_BYTES
    const idfOffset = 8;
    // IDF osset works from right after the header bytes
    // (so the offset includes the tiff byte align)
    const offset = EXIF_HEADER_BYTES + idfOffset;
    const idfDirectoryEntries = (0, utils_1.readUInt)(exifBlock, 16, offset, isBigEndian);
    for (let directoryEntryNumber = 0; directoryEntryNumber < idfDirectoryEntries; directoryEntryNumber++) {
        const start = offset +
            NUM_DIRECTORY_ENTRIES_BYTES +
            directoryEntryNumber * IDF_ENTRY_BYTES;
        const end = start + IDF_ENTRY_BYTES;
        // Skip on corrupt EXIF blocks
        if (start > exifBlock.length) {
            return;
        }
        const block = exifBlock.slice(start, end);
        const tagNumber = (0, utils_1.readUInt)(block, 16, 0, isBigEndian);
        // 0x0112 (decimal: 274) is the `orientation` tag ID
        if (tagNumber === 274) {
            const dataFormat = (0, utils_1.readUInt)(block, 16, 2, isBigEndian);
            if (dataFormat !== 3) {
                return;
            }
            // unsinged int has 2 bytes per component
            // if there would more than 4 bytes in total it's a pointer
            const numberOfComponents = (0, utils_1.readUInt)(block, 32, 4, isBigEndian);
            if (numberOfComponents !== 1) {
                return;
            }
            return (0, utils_1.readUInt)(block, 16, 8, isBigEndian);
        }
    }
}
function validateExifBlock(input, index) {
    // Skip APP1 Data Size
    const exifBlock = input.slice(APP1_DATA_SIZE_BYTES, index);
    // Consider byte alignment
    const byteAlign = (0, utils_1.toHexString)(exifBlock, EXIF_HEADER_BYTES, EXIF_HEADER_BYTES + TIFF_BYTE_ALIGN_BYTES);
    // Ignore Empty EXIF. Validate byte alignment
    const isBigEndian = byteAlign === BIG_ENDIAN_BYTE_ALIGN;
    const isLittleEndian = byteAlign === LITTLE_ENDIAN_BYTE_ALIGN;
    if (isBigEndian || isLittleEndian) {
        return extractOrientation(exifBlock, isBigEndian);
    }
}
function validateInput(input, index) {
    // index should be within buffer limits
    if (index > input.length) {
        throw new TypeError('Corrupt JPG, exceeded buffer limits');
    }
}
exports.JPG = {
    validate: (input) => (0, utils_1.toHexString)(input, 0, 2) === 'ffd8',
    calculate(input) {
        // Skip 4 chars, they are for signature
        input = input.slice(4);
        let orientation;
        let next;
        while (input.length) {
            // read length of the next block
            const i = (0, utils_1.readUInt16BE)(input, 0);
            // Every JPEG block must begin with a 0xFF
            if (input[i] !== 0xff) {
                input = input.slice(1);
                continue;
            }
            if (isEXIF(input)) {
                orientation = validateExifBlock(input, i);
            }
            // ensure correct format
            validateInput(input, i);
            // 0xFFC0 is baseline standard(SOF)
            // 0xFFC1 is baseline optimized(SOF)
            // 0xFFC2 is progressive(SOF2)
            next = input[i + 1];
            if (next === 0xc0 || next === 0xc1 || next === 0xc2) {
                const size = extractSize(input, i + 5);
                // TODO: is orientation=0 a valid answer here?
                if (!orientation) {
                    return size;
                }
                return {
                    height: size.height,
                    orientation,
                    width: size.width,
                };
            }
            // move to the next block
            input = input.slice(i + 2);
        }
        throw new TypeError('Invalid JPG, no size found');
    },
};


/***/ }),
/* 22 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.KTX = void 0;
const utils_1 = __webpack_require__(12);
exports.KTX = {
    validate: (input) => {
        const signature = (0, utils_1.toUTF8String)(input, 1, 7);
        return ['KTX 11', 'KTX 20'].includes(signature);
    },
    calculate: (input) => {
        const type = input[5] === 0x31 ? 'ktx' : 'ktx2';
        const offset = type === 'ktx' ? 36 : 20;
        return ({
            height: (0, utils_1.readUInt32LE)(input, offset + 4),
            width: (0, utils_1.readUInt32LE)(input, offset),
            type,
        });
    },
};


/***/ }),
/* 23 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PNG = void 0;
const utils_1 = __webpack_require__(12);
const pngSignature = 'PNG\r\n\x1a\n';
const pngImageHeaderChunkName = 'IHDR';
// Used to detect "fried" png's: http://www.jongware.com/pngdefry.html
const pngFriedChunkName = 'CgBI';
exports.PNG = {
    validate(input) {
        if (pngSignature === (0, utils_1.toUTF8String)(input, 1, 8)) {
            let chunkName = (0, utils_1.toUTF8String)(input, 12, 16);
            if (chunkName === pngFriedChunkName) {
                chunkName = (0, utils_1.toUTF8String)(input, 28, 32);
            }
            if (chunkName !== pngImageHeaderChunkName) {
                throw new TypeError('Invalid PNG');
            }
            return true;
        }
        return false;
    },
    calculate(input) {
        if ((0, utils_1.toUTF8String)(input, 12, 16) === pngFriedChunkName) {
            return {
                height: (0, utils_1.readUInt32BE)(input, 36),
                width: (0, utils_1.readUInt32BE)(input, 32),
            };
        }
        return {
            height: (0, utils_1.readUInt32BE)(input, 20),
            width: (0, utils_1.readUInt32BE)(input, 16),
        };
    },
};


/***/ }),
/* 24 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PNM = void 0;
const utils_1 = __webpack_require__(12);
const PNMTypes = {
    P1: 'pbm/ascii',
    P2: 'pgm/ascii',
    P3: 'ppm/ascii',
    P4: 'pbm',
    P5: 'pgm',
    P6: 'ppm',
    P7: 'pam',
    PF: 'pfm',
};
const handlers = {
    default: (lines) => {
        let dimensions = [];
        while (lines.length > 0) {
            const line = lines.shift();
            if (line[0] === '#') {
                continue;
            }
            dimensions = line.split(' ');
            break;
        }
        if (dimensions.length === 2) {
            return {
                height: parseInt(dimensions[1], 10),
                width: parseInt(dimensions[0], 10),
            };
        }
        else {
            throw new TypeError('Invalid PNM');
        }
    },
    pam: (lines) => {
        const size = {};
        while (lines.length > 0) {
            const line = lines.shift();
            if (line.length > 16 || line.charCodeAt(0) > 128) {
                continue;
            }
            const [key, value] = line.split(' ');
            if (key && value) {
                size[key.toLowerCase()] = parseInt(value, 10);
            }
            if (size.height && size.width) {
                break;
            }
        }
        if (size.height && size.width) {
            return {
                height: size.height,
                width: size.width,
            };
        }
        else {
            throw new TypeError('Invalid PAM');
        }
    },
};
exports.PNM = {
    validate: (input) => (0, utils_1.toUTF8String)(input, 0, 2) in PNMTypes,
    calculate(input) {
        const signature = (0, utils_1.toUTF8String)(input, 0, 2);
        const type = PNMTypes[signature];
        // TODO: this probably generates garbage. move to a stream based parser
        const lines = (0, utils_1.toUTF8String)(input, 3).split(/[\r\n]+/);
        const handler = handlers[type] || handlers.default;
        return handler(lines);
    },
};


/***/ }),
/* 25 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PSD = void 0;
const utils_1 = __webpack_require__(12);
exports.PSD = {
    validate: (input) => (0, utils_1.toUTF8String)(input, 0, 4) === '8BPS',
    calculate: (input) => ({
        height: (0, utils_1.readUInt32BE)(input, 14),
        width: (0, utils_1.readUInt32BE)(input, 18),
    }),
};


/***/ }),
/* 26 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SVG = void 0;
const utils_1 = __webpack_require__(12);
const svgReg = /<svg\s([^>"']|"[^"]*"|'[^']*')*>/;
const extractorRegExps = {
    height: /\sheight=(['"])([^%]+?)\1/,
    root: svgReg,
    viewbox: /\sviewBox=(['"])(.+?)\1/i,
    width: /\swidth=(['"])([^%]+?)\1/,
};
const INCH_CM = 2.54;
const units = {
    in: 96,
    cm: 96 / INCH_CM,
    em: 16,
    ex: 8,
    m: (96 / INCH_CM) * 100,
    mm: 96 / INCH_CM / 10,
    pc: 96 / 72 / 12,
    pt: 96 / 72,
    px: 1,
};
const unitsReg = new RegExp(`^([0-9.]+(?:e\\d+)?)(${Object.keys(units).join('|')})?$`);
function parseLength(len) {
    const m = unitsReg.exec(len);
    if (!m) {
        return undefined;
    }
    return Math.round(Number(m[1]) * (units[m[2]] || 1));
}
function parseViewbox(viewbox) {
    const bounds = viewbox.split(' ');
    return {
        height: parseLength(bounds[3]),
        width: parseLength(bounds[2]),
    };
}
function parseAttributes(root) {
    const width = root.match(extractorRegExps.width);
    const height = root.match(extractorRegExps.height);
    const viewbox = root.match(extractorRegExps.viewbox);
    return {
        height: height && parseLength(height[2]),
        viewbox: viewbox && parseViewbox(viewbox[2]),
        width: width && parseLength(width[2]),
    };
}
function calculateByDimensions(attrs) {
    return {
        height: attrs.height,
        width: attrs.width,
    };
}
function calculateByViewbox(attrs, viewbox) {
    const ratio = viewbox.width / viewbox.height;
    if (attrs.width) {
        return {
            height: Math.floor(attrs.width / ratio),
            width: attrs.width,
        };
    }
    if (attrs.height) {
        return {
            height: attrs.height,
            width: Math.floor(attrs.height * ratio),
        };
    }
    return {
        height: viewbox.height,
        width: viewbox.width,
    };
}
exports.SVG = {
    // Scan only the first kilo-byte to speed up the check on larger files
    validate: (input) => svgReg.test((0, utils_1.toUTF8String)(input, 0, 1000)),
    calculate(input) {
        const root = (0, utils_1.toUTF8String)(input).match(extractorRegExps.root);
        if (root) {
            const attrs = parseAttributes(root[0]);
            if (attrs.width && attrs.height) {
                return calculateByDimensions(attrs);
            }
            if (attrs.viewbox) {
                return calculateByViewbox(attrs, attrs.viewbox);
            }
        }
        throw new TypeError('Invalid SVG');
    },
};


/***/ }),
/* 27 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TGA = void 0;
const utils_1 = __webpack_require__(12);
exports.TGA = {
    validate(input) {
        return (0, utils_1.readUInt16LE)(input, 0) === 0 && (0, utils_1.readUInt16LE)(input, 4) === 0;
    },
    calculate(input) {
        return {
            height: (0, utils_1.readUInt16LE)(input, 14),
            width: (0, utils_1.readUInt16LE)(input, 12),
        };
    },
};


/***/ }),
/* 28 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TIFF = void 0;
// based on http://www.compix.com/fileformattif.htm
// TO-DO: support big-endian as well
const fs = __webpack_require__(3);
const utils_1 = __webpack_require__(12);
// Read IFD (image-file-directory) into a buffer
function readIFD(input, filepath, isBigEndian) {
    const ifdOffset = (0, utils_1.readUInt)(input, 32, 4, isBigEndian);
    // read only till the end of the file
    let bufferSize = 1024;
    const fileSize = fs.statSync(filepath).size;
    if (ifdOffset + bufferSize > fileSize) {
        bufferSize = fileSize - ifdOffset - 10;
    }
    // populate the buffer
    const endBuffer = new Uint8Array(bufferSize);
    const descriptor = fs.openSync(filepath, 'r');
    fs.readSync(descriptor, endBuffer, 0, bufferSize, ifdOffset);
    fs.closeSync(descriptor);
    return endBuffer.slice(2);
}
// TIFF values seem to be messed up on Big-Endian, this helps
function readValue(input, isBigEndian) {
    const low = (0, utils_1.readUInt)(input, 16, 8, isBigEndian);
    const high = (0, utils_1.readUInt)(input, 16, 10, isBigEndian);
    return (high << 16) + low;
}
// move to the next tag
function nextTag(input) {
    if (input.length > 24) {
        return input.slice(12);
    }
}
// Extract IFD tags from TIFF metadata
function extractTags(input, isBigEndian) {
    const tags = {};
    let temp = input;
    while (temp && temp.length) {
        const code = (0, utils_1.readUInt)(temp, 16, 0, isBigEndian);
        const type = (0, utils_1.readUInt)(temp, 16, 2, isBigEndian);
        const length = (0, utils_1.readUInt)(temp, 32, 4, isBigEndian);
        // 0 means end of IFD
        if (code === 0) {
            break;
        }
        else {
            // 256 is width, 257 is height
            // if (code === 256 || code === 257) {
            if (length === 1 && (type === 3 || type === 4)) {
                tags[code] = readValue(temp, isBigEndian);
            }
            // move to the next tag
            temp = nextTag(temp);
        }
    }
    return tags;
}
// Test if the TIFF is Big Endian or Little Endian
function determineEndianness(input) {
    const signature = (0, utils_1.toUTF8String)(input, 0, 2);
    if ('II' === signature) {
        return 'LE';
    }
    else if ('MM' === signature) {
        return 'BE';
    }
}
const signatures = [
    // '492049', // currently not supported
    '49492a00', // Little endian
    '4d4d002a', // Big Endian
    // '4d4d002a', // BigTIFF > 4GB. currently not supported
];
exports.TIFF = {
    validate: (input) => signatures.includes((0, utils_1.toHexString)(input, 0, 4)),
    calculate(input, filepath) {
        if (!filepath) {
            throw new TypeError('Tiff doesn\'t support buffer');
        }
        // Determine BE/LE
        const isBigEndian = determineEndianness(input) === 'BE';
        // read the IFD
        const ifdBuffer = readIFD(input, filepath, isBigEndian);
        // extract the tags from the IFD
        const tags = extractTags(ifdBuffer, isBigEndian);
        const width = tags[256];
        const height = tags[257];
        if (!width || !height) {
            throw new TypeError('Invalid Tiff. Missing tags');
        }
        return { height, width };
    },
};


/***/ }),
/* 29 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WEBP = void 0;
const utils_1 = __webpack_require__(12);
function calculateExtended(input) {
    return {
        height: 1 + (0, utils_1.readUInt24LE)(input, 7),
        width: 1 + (0, utils_1.readUInt24LE)(input, 4),
    };
}
function calculateLossless(input) {
    return {
        height: 1 +
            (((input[4] & 0xf) << 10) | (input[3] << 2) | ((input[2] & 0xc0) >> 6)),
        width: 1 + (((input[2] & 0x3f) << 8) | input[1]),
    };
}
function calculateLossy(input) {
    // `& 0x3fff` returns the last 14 bits
    // TO-DO: include webp scaling in the calculations
    return {
        height: (0, utils_1.readInt16LE)(input, 8) & 0x3fff,
        width: (0, utils_1.readInt16LE)(input, 6) & 0x3fff,
    };
}
exports.WEBP = {
    validate(input) {
        const riffHeader = 'RIFF' === (0, utils_1.toUTF8String)(input, 0, 4);
        const webpHeader = 'WEBP' === (0, utils_1.toUTF8String)(input, 8, 12);
        const vp8Header = 'VP8' === (0, utils_1.toUTF8String)(input, 12, 15);
        return riffHeader && webpHeader && vp8Header;
    },
    calculate(input) {
        const chunkHeader = (0, utils_1.toUTF8String)(input, 12, 16);
        input = input.slice(20, 30);
        // Extended webp stream signature
        if (chunkHeader === 'VP8X') {
            const extendedHeader = input[0];
            const validStart = (extendedHeader & 0xc0) === 0;
            const validEnd = (extendedHeader & 0x01) === 0;
            if (validStart && validEnd) {
                return calculateExtended(input);
            }
            else {
                // TODO: breaking change
                throw new TypeError('Invalid WebP');
            }
        }
        // Lossless webp stream signature
        if (chunkHeader === 'VP8 ' && input[0] !== 0x2f) {
            return calculateLossy(input);
        }
        // Lossy webp stream signature
        const signature = (0, utils_1.toHexString)(input, 3, 6);
        if (chunkHeader === 'VP8L' && signature !== '9d012a') {
            return calculateLossless(input);
        }
        throw new TypeError('Invalid WebP');
    },
};


/***/ }),
/* 30 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.detector = void 0;
const index_1 = __webpack_require__(10);
const keys = Object.keys(index_1.typeHandlers);
// This map helps avoid validating for every single image type
const firstBytes = {
    0x38: 'psd',
    0x42: 'bmp',
    0x44: 'dds',
    0x47: 'gif',
    0x49: 'tiff',
    0x4d: 'tiff',
    0x52: 'webp',
    0x69: 'icns',
    0x89: 'png',
    0xff: 'jpg',
};
function detector(input) {
    const byte = input[0];
    if (byte in firstBytes) {
        const type = firstBytes[byte];
        if (type && index_1.typeHandlers[type].validate(input)) {
            return type;
        }
    }
    const finder = (key) => index_1.typeHandlers[key].validate(input);
    return keys.find(finder);
}
exports.detector = detector;


/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map