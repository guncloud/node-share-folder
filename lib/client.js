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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const Enumerable = require("node-enumerable");
const HTTPs = require("https");
const IsStream = require("is-stream");
const NormalizeHeaderCase = require("header-case-normalizer");
const sf_helpers = require("./helpers");
const sf_host = require("./host");
/**
 * A client for accessing a share folder instance.
 */
class ShareFolderClient {
    /**
     * Initializes a new instance of that class.
     *
     * @param {ShareFolderClientOptions} opts Custom options.
     */
    constructor(opts) {
        if (_.isNil(opts)) {
            opts = {};
        }
        this.host = sf_helpers.normalizeString(opts.host);
        if ('' === this.host) {
            this.host = '127.0.0.1';
        }
        this.port = parseInt(sf_helpers.toStringSafe(opts.port).trim());
        if (isNaN(this.port)) {
            this.port = sf_host.DEFAULT_PORT;
        }
        this.ssl = sf_helpers.toBooleanSafe(opts.ssl);
        if (!sf_helpers.isEmptyString(opts.user) || !sf_helpers.isEmptyString(opts.password)) {
            this.account = {
                name: sf_helpers.toStringSafe(opts.user),
                password: sf_helpers.toStringSafe(opts.password),
            };
        }
    }
    delete(path, data, headers) {
        return this.request(path, 'DELETE', data, headers);
    }
    /**
     * Downloads a file.
     *
     * @param {string} path The path to the remote file.
     * @param {NodeJS.WritableStream} [stream] The optional destination stream to write to.
     *
     * @return {Promise<Buffer | undefined>} The promise with the downloaded data (if 'stream' is not defined).
     */
    download(path, stream) {
        return __awaiter(this, arguments, void 0, function* () {
            const RESULT = yield this.get(sf_helpers.normalizePath(path));
            if ([200, 204].indexOf(RESULT.code) < 0) {
                throw new Error(`Unexpected response '${sf_helpers.toStringSafe(RESULT.code)}'!`);
            }
            if ('f' !== sf_helpers.normalizeString(RESULT.headers[sf_host.HEADER_TYPE])) {
                throw new Error('No file!');
            }
            if (204 === RESULT.code) {
                return Buffer.alloc(0);
            }
            if (arguments.length < 2) {
                return sf_helpers.readAll(RESULT.response);
            }
            RESULT.response
                .pipe(stream);
        });
    }
    get(path, headers) {
        return this.request(path, 'GET', null, headers);
    }
    /**
     * Lists a directory.
     *
     * @param {string} [path] The custom path of the directory to list.
     *
     * @return {sf_host.DirectoryEntry[]} The list of entries.
     */
    list(path = '/') {
        return __awaiter(this, void 0, void 0, function* () {
            const RESULT = yield this.get(sf_helpers.normalizePath(path));
            if ('d' !== sf_helpers.normalizeString(RESULT.headers[sf_host.HEADER_TYPE])) {
                throw new Error('No directory!');
            }
            if ([200, 204].indexOf(RESULT.code) < 0) {
                throw new Error(`Unexpected response '${sf_helpers.toStringSafe(RESULT.code)}'!`);
            }
            const ENTRIES = [];
            if (200 === RESULT.code) {
                sf_helpers.asArray(JSON.parse((yield sf_helpers.readAll(RESULT.response)).toString('utf8'))).forEach(e => {
                    ENTRIES.push(e);
                });
            }
            return Enumerable.from(ENTRIES).orderBy(e => {
                return sf_host.DirectoryEntryType.Directory === e.type ? 0 : 1;
            }).thenBy(e => {
                return sf_helpers.normalizeString(e.name);
            }).toArray();
        });
    }
    post(path, data, headers) {
        return this.request(path, 'POST', data, headers);
    }
    put(path, data, headers) {
        return this.request(path, 'PUT', data, headers);
    }
    /**
     * Removes a file or folder.
     *
     * @param {string} path The path to the file or folder.
     *
     * @return {Promise<sf_host.DirectoryEntry>} The promise with the entry of the removed item.
     */
    remove(path) {
        return __awaiter(this, void 0, void 0, function* () {
            const RESULT = yield this.delete(sf_helpers.normalizePath(path));
            if (200 !== RESULT.code) {
                throw new Error(`Unexpected response '${sf_helpers.toStringSafe(RESULT.code)}'!`);
            }
            return JSON.parse((yield sf_helpers.readAll(RESULT.response)).toString('utf8'));
        });
    }
    request(path, method, data, headers) {
        method = sf_helpers.toStringSafe(method).toUpperCase().trim();
        if ('' === method) {
            method = 'GET';
        }
        path = sf_helpers.normalizePath(path);
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const COMPLETED = sf_helpers.createCompletedAction(resolve, reject);
            let newRequest;
            let opts;
            const CALLBACK = (resp) => __awaiter(this, void 0, void 0, function* () {
                if (400 === resp.statusCode) {
                    COMPLETED(new Error('Invalid path!'));
                }
                else if (401 === resp.statusCode) {
                    COMPLETED(new Error('Unauthorized!'));
                }
                else if (403 === resp.statusCode) {
                    COMPLETED(new Error('Forbidden!'));
                }
                else if (404 === resp.statusCode) {
                    COMPLETED(new Error('Not found!'));
                }
                else {
                    COMPLETED(null, {
                        code: resp.statusCode,
                        headers: resp.headers || {},
                        options: opts,
                        request: newRequest,
                        response: resp,
                    });
                }
            });
            const CALLBACK_SYNC = (resp) => {
                CALLBACK(resp).then(() => {
                }, (err) => {
                    COMPLETED(err);
                });
            };
            try {
                let requestFactory;
                opts = {
                    headers: {},
                    hostname: this.host,
                    method: method,
                    path: path,
                    port: this.port,
                };
                if (this.account) {
                    opts.headers['Authorization'] = `Basic ${new Buffer(this.account.name + ':' + this.account.password, 'ascii').toString('base64')}`;
                }
                if (!_.isNil(headers)) {
                    for (const H in headers) {
                        const NAME = sf_helpers.toStringSafe(H).trim();
                        if ('' === NAME) {
                            continue;
                        }
                        const VALUE = sf_helpers.toStringSafe(headers[H]);
                        if ('' === VALUE) {
                            continue;
                        }
                        opts.headers[NormalizeHeaderCase(NAME)] = VALUE;
                    }
                }
                if (this.ssl) {
                    requestFactory = () => __awaiter(this, void 0, void 0, function* () {
                        const HTTPs_OPTS = opts;
                        HTTPs_OPTS.protocol = 'https:';
                        HTTPs_OPTS.rejectUnauthorized = false;
                        return HTTPs.request(HTTPs_OPTS, CALLBACK_SYNC);
                    });
                }
                else {
                    requestFactory = () => __awaiter(this, void 0, void 0, function* () {
                        const HTTP_OPTS = opts;
                        HTTP_OPTS.protocol = 'http:';
                        return HTTPs.request(HTTP_OPTS, CALLBACK_SYNC);
                    });
                }
                newRequest = yield requestFactory();
                if (!_.isNil(data)) {
                    if (IsStream.readable(data)) {
                        data.pipe(newRequest);
                    }
                    else {
                        newRequest.write(data);
                    }
                }
                newRequest.end();
            }
            catch (e) {
                COMPLETED(e);
            }
        }));
    }
    /**
     * Uploads a file.
     *
     * @param {string} path The path to the remote file.
     * @param {any} data The data (can be a stream) to upload.
     *
     * @return {sf_host.DirectoryEntry} The directory entry of the file.
     */
    upload(path, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const RESULT = yield this.put(sf_helpers.normalizePath(path), data);
            if (200 !== RESULT.code) {
                if (409 === RESULT.code) {
                    throw new Error('Path is a directory!');
                }
                throw new Error(`Unexpected response '${sf_helpers.toStringSafe(RESULT.code)}'!`);
            }
            return JSON.parse((yield sf_helpers.readAll(RESULT.response)).toString('utf8'));
        });
    }
}
exports.ShareFolderClient = ShareFolderClient;
//# sourceMappingURL=client.js.map