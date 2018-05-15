/// <reference types="moment" />
/// <reference types="moment-timezone" />
/// <reference types="node" />
import * as Moment from 'moment';
import * as Stream from 'stream';
/**
 * Describes a simple 'completed' action.
 *
 * @param {any} err The occurred error.
 * @param {TResult} [result] The result.
 */
export declare type SimpleCompletedAction<TResult> = (err: any, result?: TResult) => void;
/**
 * Returns a value as array.
 *
 * @param {T|T[]} val The value.
 * @param {boolean} [removeEmpty] Remove items that are (null) / (undefined) or not.
 *
 * @return {T[]} The value as (new) array.
 */
export declare function asArray<T>(val: T | T[], removeEmpty?: boolean): T[];
/**
 * Returns a value as UTC Moment instance.
 *
 * @param {any} val The input value.
 *
 * @return {Moment.Moment} The output value.
 */
export declare function asUTC(val: any): Moment.Moment;
/**
 * Clones an object / value deep.
 *
 * @param {T} val The value / object to clone.
 *
 * @return {T} The cloned value / object.
 */
export declare function cloneObject<T>(val: T): T;
/**
 * Creates a simple 'completed' callback for a promise.
 *
 * @param {Function} resolve The 'succeeded' callback.
 * @param {Function} reject The 'error' callback.
 *
 * @return {SimpleCompletedAction<TResult>} The created action.
 */
export declare function createCompletedAction<TResult = any>(resolve: (value?: TResult | PromiseLike<TResult>) => void, reject?: (reason: any) => void): SimpleCompletedAction<TResult>;
/**
 * Checks if the string representation of a value is empty
 * or contains whitespaces only.
 *
 * @param {any} val The value to check.
 *
 * @return {boolean} Is empty or not.
 */
export declare function isEmptyString(val: any): boolean;
/**
 * Normalizes a path.
 *
 * @param {string} p The path to normalize.
 *
 * @return {string} The normalized path.
 */
export declare function normalizePath(p: string): string;
/**
 * Normalizes a value as string so that is comparable.
 *
 * @param {any} val The value to convert.
 *
 * @return {string} The normalized value.
 */
export declare function normalizeString(val: any): string;
/**
 * Reads the content of a stream.
 *
 * @param {Stream.Readable} stream The stream.
 * @param {string} [enc] The custom (string) encoding to use.
 *
 * @returns {Promise<Buffer>} The promise with the content.
 */
export declare function readAll(stream: Stream.Readable, enc?: string): Promise<Buffer>;
/**
 * Returns a value as boolean, which is not (null) and (undefined).
 *
 * @param {any} val The value to convert.
 * @param {boolean} [defaultVal] The custom default value if 'val' is (null) or (undefined).
 *
 * @return {boolean} 'val' as boolean.
 */
export declare function toBooleanSafe(val: any, defaultVal?: boolean): boolean;
/**
 * Returns a value as string, which is not (null) and (undefined).
 *
 * @param {any} val The value to convert.
 * @param {string} [defaultVal] The custom default value if 'val' is (null) or (undefined).
 *
 * @return {string} 'val' as string.
 */
export declare function toStringSafe(val: any, defaultVal?: string): string;
/**
 * Tries to remove a listener from an event emitter.
 *
 * @param {NodeJS.EventEmitter} obj The emitter.
 * @param {string|symbol} ev The event.
 * @param {Function} listener The listener.
 *
 * @return {boolean} Operation was successfull or not.
 */
export declare function tryRemoveListener(obj: NodeJS.EventEmitter, ev: string | symbol, listener: Function): boolean;
/**
 * Writes a message to a stream.
 *
 * @param {any} msg The message to write.
 * @param {NodeJS.WritableStream} [stream] The custom output stream. Default: stdout
 */
export declare function write(msg: any, stream?: NodeJS.WritableStream): void;
/**
 * Writes a message to stderr.
 *
 * @param {any} msg The message to write.
 */
export declare function write_err(msg: any): void;
/**
 * Writes an optional message to stderr and appends a new line.
 *
 * @param {any} [msg] The message to write.
 */
export declare function write_err_ln(msg?: any): void;
/**
 * Writes an optional message to a stream and appends a new line.
 *
 * @param {any} [msg] The message to write.
 * @param {NodeJS.WritableStream} [stream] The custom output stream. Default: stdout
 */
export declare function write_ln(msg?: any, stream?: NodeJS.WritableStream): void;
