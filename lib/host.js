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
const HTTP = require("http");
const HTTPs = require("https");
const Events = require("events");
const Express = require("express");
const FS = require("fs");
const FSExtra = require("fs-extra");
const MimeTypes = require("mime-types");
const Moment = require("moment");
const Path = require("path");
const SanitizeFilename = require("sanitize-filename");
const sf_helpers = require("./helpers");
/**
 * List of types for directory entries.
 */
var DirectoryEntryType;
(function (DirectoryEntryType) {
    /**
     * Unknown
     */
    DirectoryEntryType[DirectoryEntryType["Unknown"] = 0] = "Unknown";
    /**
     * Directory / folder
     */
    DirectoryEntryType[DirectoryEntryType["Directory"] = 1] = "Directory";
    /**
     * File
     */
    DirectoryEntryType[DirectoryEntryType["File"] = 2] = "File";
})(DirectoryEntryType = exports.DirectoryEntryType || (exports.DirectoryEntryType = {}));
/**
 * The default TCP port for a host.
 */
exports.DEFAULT_PORT = 55555;
/**
 * HTTP header with a folder item type.
 */
exports.HEADER_TYPE = 'x-share-folder-type';
/**
 * A host for sharing a folder.
 */
class ShareFolderHost extends Events.EventEmitter {
    /**
     * Initializes a new instance of that class.
     *
     * @param {ShareFolderHostOptions} options The options for the host.
     */
    constructor(options) {
        super();
        this.options = options;
    }
    createInstance() {
        return __awaiter(this, void 0, void 0, function* () {
            const APP = Express();
            let rootDir = sf_helpers.toStringSafe(this.options.root);
            {
                if ('' === rootDir.trim()) {
                    rootDir = process.cwd();
                }
                if (!Path.isAbsolute(rootDir)) {
                    rootDir = Path.resolve(process.cwd(), rootDir);
                }
            }
            rootDir = Path.resolve(rootDir);
            let realm = sf_helpers.toStringSafe(this.options.realm).trim();
            if ('' === realm) {
                realm = 'node-share-folder';
            }
            // IP check
            APP.use((req, resp, next) => __awaiter(this, void 0, void 0, function* () {
                let canConnect = true;
                const REQUEST_VALIDATOR = this.options.requestValidator;
                if (REQUEST_VALIDATOR) {
                    canConnect = sf_helpers.toBooleanSafe(yield Promise.resolve(REQUEST_VALIDATOR(req)));
                }
                if (canConnect) {
                    next();
                    return;
                }
                try {
                    req.socket.end();
                }
                catch (_a) { }
            }));
            // headers
            APP.use(function (req, resp, next) {
                req['__vars'] = {};
                resp.setHeader('X-Powered-By', 'node-share-folder (Express)');
                resp.setHeader('X-TM-MK', Moment.utc('1979-09-05 23:09', 'YYYY-MM-DD HH:mm').toISOString());
                next();
            });
            // Basic Auth
            APP.use((req, resp, next) => __awaiter(this, void 0, void 0, function* () {
                const ACCOUNT_VALIDATOR = this.options.accountValidator;
                if (ACCOUNT_VALIDATOR) {
                    let matchingAccount = false;
                    let username;
                    let password;
                    const AUTHORIZATION = sf_helpers.toStringSafe(req.header('authorization')).trim();
                    if (AUTHORIZATION.toLowerCase().startsWith('basic ')) {
                        const USERNAME_AND_PASSWORD = (new Buffer(AUTHORIZATION.substr(6).trim(), 'base64')).toString('utf8');
                        const SEP = USERNAME_AND_PASSWORD.indexOf(':');
                        if (SEP > -1) {
                            username = USERNAME_AND_PASSWORD.substr(0, SEP);
                            password = USERNAME_AND_PASSWORD.substr(SEP + 1);
                        }
                        else {
                            username = USERNAME_AND_PASSWORD;
                        }
                        username = sf_helpers.normalizeString(username);
                        password = sf_helpers.toStringSafe(password);
                    }
                    const IS_VALID = sf_helpers.toBooleanSafe(yield Promise.resolve(ACCOUNT_VALIDATOR(username, password)));
                    if (IS_VALID) {
                        matchingAccount = {
                            name: username,
                            password: password,
                        };
                    }
                    if (false === matchingAccount) {
                        resp.setHeader('WWW-Authenticate', 'Basic realm=' + realm.trim());
                        return resp.status(401)
                            .send();
                    }
                    req['__vars']['account'] = matchingAccount;
                }
                return next();
            }));
            // check read-only mode
            APP.use((req, resp, next) => {
                if (!sf_helpers.toBooleanSafe(this.options.canWrite)) {
                    switch (sf_helpers.normalizeString(req.method)) {
                        case 'delete':
                        case 'patch':
                        case 'post':
                        case 'put':
                            return resp.status(403)
                                .send();
                    }
                }
                next();
            });
            APP.use((req, resp, next) => __awaiter(this, void 0, void 0, function* () {
                if (yield FS.exists(rootDir)) {
                    if ((yield FSExtra.stat(rootDir)).isDirectory()) {
                        return next();
                    }
                }
                return resp.status(503)
                    .send();
            }));
            yield this.setupEndpoints(APP, rootDir);
            return APP;
        });
    }
    /**
     * Gets if the host is currently running or not.
     */
    get isRunning() {
        return !_.isNil(this._server);
    }
    /**
     * Gets the TCP port for the host.
     */
    get port() {
        let p = parseInt(sf_helpers.toStringSafe(this.options.port).trim());
        if (isNaN(p)) {
            p = exports.DEFAULT_PORT;
        }
        return p;
    }
    setupEndpoints(app, rootDir) {
        return __awaiter(this, void 0, void 0, function* () {
            const EXISTS = (p) => {
                p = sf_helpers.toStringSafe(p);
                return new Promise((resolve, reject) => {
                    const COMPLETED = sf_helpers.createCompletedAction(resolve, reject);
                    try {
                        FSExtra.exists(p, (exists) => {
                            COMPLETED(null, exists);
                        });
                    }
                    catch (e) {
                        COMPLETED(e);
                    }
                });
            };
            const GET_DIRECTORY_ENTRY = function (p, n) {
                return __awaiter(this, arguments, void 0, function* () {
                    p = sf_helpers.toStringSafe(p);
                    return TO_DIRECTORY_ENTRY(yield FSExtra.stat(p), arguments.length < 2 ? Path.basename(p)
                        : sf_helpers.toStringSafe(n));
                });
            };
            const IS_OUTSIDE = (requestedPath) => {
                requestedPath = sf_helpers.normalizePath(requestedPath);
                const FILE_OR_FOLDER = Path.resolve(Path.join(rootDir, requestedPath));
                return (rootDir !== FILE_OR_FOLDER) &&
                    !FILE_OR_FOLDER.startsWith(rootDir + Path.sep);
            };
            const SANATIZE_PATH = (p) => {
                return Path.resolve(Path.join(Path.dirname(p), SanitizeFilename(Path.basename(p))));
            };
            const SEND_JSON = (resp, data) => {
                resp.setHeader('Content-Type', 'application/json; charset=utf8');
                return resp.status(200).send(new Buffer(JSON.stringify(data), 'utf8'));
            };
            const TO_DIRECTORY_ENTRY = function (stat, n) {
                if (!_.isNil(stat)) {
                    return {
                        ctime: sf_helpers.asUTC(stat.ctime).toISOString(),
                        mtime: sf_helpers.asUTC(stat.mtime).toISOString(),
                        name: n,
                        size: stat.size,
                        type: stat.isDirectory() ? DirectoryEntryType.Directory
                            : DirectoryEntryType.File,
                    };
                }
                else {
                    return stat;
                }
            };
            // get directory list or
            // file content / info
            app.get('/*', (req, resp) => __awaiter(this, void 0, void 0, function* () {
                const REQUESTED_PATH = sf_helpers.normalizePath(req.path);
                if (IS_OUTSIDE(REQUESTED_PATH)) {
                    return resp.status(400)
                        .send();
                }
                const FILE_OR_FOLDER = SANATIZE_PATH(Path.join(rootDir, REQUESTED_PATH));
                if (!(yield EXISTS(FILE_OR_FOLDER))) {
                    return resp.status(404)
                        .send();
                }
                if ('1' === sf_helpers.normalizeString(req.query['info'])) {
                    return SEND_JSON(resp, yield GET_DIRECTORY_ENTRY(FILE_OR_FOLDER, '/' === REQUESTED_PATH ? undefined
                        : Path.basename(FILE_OR_FOLDER)));
                }
                const SELF_STAT = yield FSExtra.stat(FILE_OR_FOLDER);
                if (SELF_STAT.isDirectory()) {
                    resp.setHeader(exports.HEADER_TYPE, 'd');
                    const RESULT = [];
                    const LIST = yield FSExtra.readdir(FILE_OR_FOLDER);
                    for (const NAME of LIST) {
                        const FULL_PATH = Path.resolve(Path.join(FILE_OR_FOLDER, NAME));
                        RESULT.push(TO_DIRECTORY_ENTRY(yield FSExtra.stat(FULL_PATH), NAME));
                    }
                    if (RESULT.length > 0) {
                        return SEND_JSON(resp, RESULT);
                    }
                    return resp.status(204)
                        .send();
                }
                else {
                    resp.setHeader(exports.HEADER_TYPE, 'f');
                    const CONTENT_TYPE = MimeTypes.lookup(FILE_OR_FOLDER);
                    if (false !== CONTENT_TYPE) {
                        resp.setHeader('Content-Type', sf_helpers.normalizeString(CONTENT_TYPE));
                    }
                    const DATA = yield FSExtra.readFile(FILE_OR_FOLDER);
                    if (DATA.length > 0) {
                        return resp.status(200)
                            .send(DATA);
                    }
                    return resp.status(204)
                        .send();
                }
            }));
            // create directory
            app.post('/*', (req, resp) => __awaiter(this, void 0, void 0, function* () {
                const REQUESTED_PATH = sf_helpers.normalizePath(req.path);
                if (IS_OUTSIDE(REQUESTED_PATH) || ('/' === REQUESTED_PATH)) {
                    return resp.status(400)
                        .send();
                }
                const NEW_FOLDER = SANATIZE_PATH(Path.join(rootDir, REQUESTED_PATH));
                if (yield EXISTS(NEW_FOLDER)) {
                    return resp.status(409)
                        .send();
                }
                yield FSExtra.mkdirs(NEW_FOLDER);
                return SEND_JSON(resp, yield GET_DIRECTORY_ENTRY(NEW_FOLDER));
            }));
            // write (new) file
            app.put('/*', (req, resp) => __awaiter(this, void 0, void 0, function* () {
                const REQUESTED_PATH = sf_helpers.normalizePath(req.path);
                if (IS_OUTSIDE(REQUESTED_PATH) || ('/' === REQUESTED_PATH)) {
                    return resp.status(400)
                        .send();
                }
                const FILE = SANATIZE_PATH(Path.join(rootDir, REQUESTED_PATH));
                if (yield EXISTS(FILE)) {
                    if ((yield FSExtra.stat(FILE)).isDirectory()) {
                        return resp.status(409)
                            .send();
                    }
                }
                const DIR = Path.dirname(FILE);
                if (!(yield EXISTS(DIR))) {
                    yield FSExtra.mkdirs(DIR);
                }
                yield FSExtra.writeFile(FILE, yield sf_helpers.readAll(req));
                return SEND_JSON(resp, yield GET_DIRECTORY_ENTRY(FILE));
            }));
            // delete file or folder
            app.delete('/*', (req, resp) => __awaiter(this, void 0, void 0, function* () {
                const REQUESTED_PATH = sf_helpers.normalizePath(req.path);
                if (IS_OUTSIDE(REQUESTED_PATH) || ('/' === REQUESTED_PATH)) {
                    return resp.status(400)
                        .send();
                }
                const FILE_OR_FOLDER = SANATIZE_PATH(Path.join(rootDir, REQUESTED_PATH));
                if (!(yield EXISTS(FILE_OR_FOLDER))) {
                    return resp.status(404)
                        .send();
                }
                const STAT = yield FSExtra.stat(FILE_OR_FOLDER);
                if (STAT.isDirectory()) {
                    yield FSExtra.remove(FILE_OR_FOLDER);
                }
                else {
                    yield FSExtra.unlink(FILE_OR_FOLDER);
                }
                return SEND_JSON(resp, yield TO_DIRECTORY_ENTRY(STAT, Path.basename(FILE_OR_FOLDER)));
            }));
        });
    }
    /**
     * Starts the host.
     *
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    start() {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const COMPLETED = sf_helpers.createCompletedAction(resolve, reject);
            try {
                if (this.isRunning) {
                    COMPLETED(null, false);
                    return;
                }
                const APP = yield this.createInstance();
                let serverFactory;
                const SSL = this.options.ssl;
                if (_.isNil(SSL)) {
                    serverFactory = () => __awaiter(this, void 0, void 0, function* () {
                        return HTTP.createServer(APP);
                    });
                }
                else {
                    serverFactory = () => __awaiter(this, void 0, void 0, function* () {
                        const LOAD_DATA = (file) => __awaiter(this, void 0, void 0, function* () {
                            file = sf_helpers.toStringSafe(file);
                            if (sf_helpers.isEmptyString(file)) {
                                return;
                            }
                            if (!Path.isAbsolute(file)) {
                                file = Path.join(process.cwd(), file);
                            }
                            file = Path.resolve(file);
                            return yield FSExtra.readFile(file);
                        });
                        let passphrase = sf_helpers.toStringSafe(SSL.passphrase);
                        if ('' === passphrase) {
                            passphrase = undefined;
                        }
                        return HTTPs.createServer({
                            ca: yield LOAD_DATA(SSL.ca),
                            cert: yield LOAD_DATA(SSL.cert),
                            key: yield LOAD_DATA(SSL.key),
                            passphrase: passphrase,
                            rejectUnauthorized: sf_helpers.toBooleanSafe(SSL.rejectUnauthorized, false),
                        }, APP);
                    });
                }
                const NEW_SERVER = yield serverFactory();
                NEW_SERVER.once('error', (err) => {
                    COMPLETED(err);
                });
                NEW_SERVER.listen(this.port, () => {
                    this._server = NEW_SERVER;
                    COMPLETED(null, true);
                });
            }
            catch (e) {
                COMPLETED(e);
            }
        }));
    }
    /**
     * Stops the host.
     *
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    stop() {
        return new Promise((resolve, reject) => {
            const COMPLETED = sf_helpers.createCompletedAction(resolve, reject);
            try {
                const OLD_SERVER = this._server;
                if (_.isNil(OLD_SERVER)) {
                    COMPLETED(null, false);
                }
                else {
                    OLD_SERVER.close(() => {
                        this._server = null;
                        COMPLETED(null, true);
                    });
                }
            }
            catch (e) {
                COMPLETED(e);
            }
        });
    }
}
exports.ShareFolderHost = ShareFolderHost;
//# sourceMappingURL=host.js.map