"use strict";
/**
 * This file is part of the node-share-folder distribution.
 * Copyright (c) Marcel Joachim Kloubert.
 *
 * node-share-folder is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, version 3.
 *
 * node-share-folder is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const Moment = require("moment");
const OS = require("os");
const Path = require("path");
/**
 * Returns a value as array.
 *
 * @param {T|T[]} val The value.
 * @param {boolean} [removeEmpty] Remove items that are (null) / (undefined) or not.
 *
 * @return {T[]} The value as (new) array.
 */
function asArray(val, removeEmpty = true) {
    removeEmpty = toBooleanSafe(removeEmpty, true);
    return (_.isArray(val) ? val : [val]).filter(i => {
        if (removeEmpty) {
            return !_.isNil(i);
        }
        return true;
    });
}
exports.asArray = asArray;
/**
 * Returns a value as UTC Moment instance.
 *
 * @param {any} val The input value.
 *
 * @return {Moment.Moment} The output value.
 */
function asUTC(val) {
    let utcTime;
    if (!_.isNil(val)) {
        if (Moment.isMoment(val)) {
            utcTime = val;
        }
        else if (Moment.isDate(val)) {
            utcTime = Moment(val);
        }
        else {
            utcTime = Moment(toStringSafe(val));
        }
    }
    if (utcTime) {
        if (!utcTime.isUTC()) {
            utcTime = utcTime.utc();
        }
    }
    return utcTime;
}
exports.asUTC = asUTC;
/**
 * Clones an object / value deep.
 *
 * @param {T} val The value / object to clone.
 *
 * @return {T} The cloned value / object.
 */
function cloneObject(val) {
    if (!val) {
        return val;
    }
    return JSON.parse(JSON.stringify(val));
}
exports.cloneObject = cloneObject;
/**
 * Creates a simple 'completed' callback for a promise.
 *
 * @param {Function} resolve The 'succeeded' callback.
 * @param {Function} reject The 'error' callback.
 *
 * @return {SimpleCompletedAction<TResult>} The created action.
 */
function createCompletedAction(resolve, reject) {
    let completedInvoked = false;
    return (err, result) => {
        if (completedInvoked) {
            return;
        }
        completedInvoked = true;
        if (err) {
            if (reject) {
                reject(err);
            }
        }
        else {
            if (resolve) {
                resolve(result);
            }
        }
    };
}
exports.createCompletedAction = createCompletedAction;
/**
 * Checks if the string representation of a value is empty
 * or contains whitespaces only.
 *
 * @param {any} val The value to check.
 *
 * @return {boolean} Is empty or not.
 */
function isEmptyString(val) {
    return '' === toStringSafe(val).trim();
}
exports.isEmptyString = isEmptyString;
/**
 * Normalizes a path.
 *
 * @param {string} p The path to normalize.
 *
 * @return {string} The normalized path.
 */
function normalizePath(p) {
    p = toStringSafe(p);
    p = p.split(Path.sep)
        .join('/');
    while (p.trim().startsWith('/')) {
        p = p.substr(p.indexOf('/') + 1);
    }
    while (p.trim().endsWith('/')) {
        p = p.substr(0, p.lastIndexOf('/'));
    }
    if (!p.trim().startsWith('/')) {
        p = '/' + p;
    }
    return p;
}
exports.normalizePath = normalizePath;
/**
 * Normalizes a value as string so that is comparable.
 *
 * @param {any} val The value to convert.
 *
 * @return {string} The normalized value.
 */
function normalizeString(val) {
    return toStringSafe(val).toLowerCase().trim();
}
exports.normalizeString = normalizeString;
/**
 * Reads the content of a stream.
 *
 * @param {Stream.Readable} stream The stream.
 * @param {string} [enc] The custom (string) encoding to use.
 *
 * @returns {Promise<Buffer>} The promise with the content.
 */
function readAll(stream, enc) {
    enc = normalizeString(enc);
    if ('' === enc) {
        enc = undefined;
    }
    return new Promise((resolve, reject) => {
        let buff;
        let dataListener;
        let endListener;
        let errorListener;
        let completedInvoked = false;
        const COMPLETED = (err) => {
            if (completedInvoked) {
                return;
            }
            completedInvoked = true;
            tryRemoveListener(stream, 'data', dataListener);
            tryRemoveListener(stream, 'end', endListener);
            tryRemoveListener(stream, 'error', errorListener);
            if (err) {
                reject(err);
            }
            else {
                resolve(buff);
            }
        };
        if (_.isNil(stream)) {
            buff = stream;
            COMPLETED(null);
            return;
        }
        errorListener = (err) => {
            if (err) {
                COMPLETED(err);
            }
        };
        dataListener = (chunk) => {
            try {
                if (!chunk || chunk.length < 1) {
                    return;
                }
                if (_.isString(chunk)) {
                    chunk = new Buffer(chunk, enc);
                }
                buff = Buffer.concat([buff, chunk]);
            }
            catch (e) {
                COMPLETED(e);
            }
        };
        endListener = () => {
            COMPLETED(null);
        };
        try {
            stream.on('error', errorListener);
            buff = Buffer.alloc(0);
            stream.once('end', endListener);
            stream.on('data', dataListener);
        }
        catch (e) {
            COMPLETED(e);
        }
    });
}
exports.readAll = readAll;
/**
 * Returns a value as boolean, which is not (null) and (undefined).
 *
 * @param {any} val The value to convert.
 * @param {boolean} [defaultVal] The custom default value if 'val' is (null) or (undefined).
 *
 * @return {boolean} 'val' as boolean.
 */
function toBooleanSafe(val, defaultVal = false) {
    if (_.isBoolean(val)) {
        return val;
    }
    if (_.isNil(val)) {
        return !!defaultVal;
    }
    return !!val;
}
exports.toBooleanSafe = toBooleanSafe;
/**
 * Returns a value as string, which is not (null) and (undefined).
 *
 * @param {any} val The value to convert.
 * @param {string} [defaultVal] The custom default value if 'val' is (null) or (undefined).
 *
 * @return {string} 'val' as string.
 */
function toStringSafe(val, defaultVal = '') {
    if (_.isString(val)) {
        return val;
    }
    if (_.isNil(val)) {
        return '' + defaultVal;
    }
    try {
        if (val instanceof Error) {
            return '' + val.message;
        }
        if (_.isFunction(val['toString'])) {
            return '' + val.toString();
        }
        if (_.isObject(val)) {
            return JSON.stringify(val);
        }
    }
    catch (_a) { }
    return '' + val;
}
exports.toStringSafe = toStringSafe;
/**
 * Tries to remove a listener from an event emitter.
 *
 * @param {NodeJS.EventEmitter} obj The emitter.
 * @param {string|symbol} ev The event.
 * @param {Function} listener The listener.
 *
 * @return {boolean} Operation was successfull or not.
 */
function tryRemoveListener(obj, ev, listener) {
    try {
        if (obj && obj.removeListener) {
            obj.removeListener(ev, listener);
        }
        return true;
    }
    catch (_a) {
        return false;
    }
}
exports.tryRemoveListener = tryRemoveListener;
/**
 * Writes a message to a stream.
 *
 * @param {any} msg The message to write.
 * @param {NodeJS.WritableStream} [stream] The custom output stream. Default: stdout
 */
function write(msg, stream) {
    if (arguments.length < 2) {
        stream = process.stdout;
    }
    if (!Buffer.isBuffer(msg)) {
        msg = toStringSafe(msg);
    }
    if (msg.length > 0) {
        stream.write(msg);
    }
}
exports.write = write;
/**
 * Writes a message to stderr.
 *
 * @param {any} msg The message to write.
 */
function write_err(msg) {
    write(msg, process.stderr);
}
exports.write_err = write_err;
/**
 * Writes an optional message to stderr and appends a new line.
 *
 * @param {any} [msg] The message to write.
 */
function write_err_ln(msg) {
    write_ln(msg, process.stderr);
}
exports.write_err_ln = write_err_ln;
/**
 * Writes an optional message to a stream and appends a new line.
 *
 * @param {any} [msg] The message to write.
 * @param {NodeJS.WritableStream} [stream] The custom output stream. Default: stdout
 */
function write_ln(msg, stream) {
    if (arguments.length < 2) {
        stream = process.stdout;
    }
    if (Buffer.isBuffer(msg)) {
        msg = Buffer.concat([
            msg,
            new Buffer(OS.EOL, 'binary')
        ]);
    }
    else {
        msg = toStringSafe(msg) + OS.EOL;
    }
    write(msg, stream);
}
exports.write_ln = write_ln;
//# sourceMappingURL=helpers.js.map