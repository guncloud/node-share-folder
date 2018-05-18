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

import * as _ from 'lodash';
import * as HTTP from 'http';
import * as HTTPs from 'https';
import * as Enumerable from 'node-enumerable';
import * as Events from 'events';
import * as Express from 'express';
import * as FS from 'fs';
import * as FSExtra from 'fs-extra';
import * as MimeTypes from 'mime-types';
import * as Moment from 'moment';
import * as MomentTZ from 'moment-timezone';
import * as Path from 'path';
import * as SanitizeFilename from 'sanitize-filename';
import * as sf_helpers from './helpers';

/**
 * An account entry.
 */
export interface Account {
    /**
     * The (user) name.
     */
    name: string;
    /**
     * The password.
     */
    password: string;
}

/**
 * Validates an account.
 *
 * @param {string} username The username.
 * @param {string} password The password.
 *
 * @return {AccountValidatorResult|PromiseLike<AccountValidatorResult>} The result that indicates, if account is valid or not.
 */
export type AccountValidator = (username: string, password: string) => AccountValidatorResult | PromiseLike<AccountValidatorResult>;

/**
 * The possible results of an account validator.
 */
export type AccountValidatorResult = boolean | void | undefined | null;

/**
 * A directory entry.
 */
export interface DirectoryEntry {
    /**
     * Change time as ISO string.
     */
    ctime: string;
    /**
     * Modification time as ISO string.
     */
    mtime: string;
    /**
     * The name of the entry.
     */
    name: string;
    /**
     * The size in bytes.
     */
    size: number;
    /**
     * The type.
     */
    type: DirectoryEntryType;
}

/**
 * List of types for directory entries.
 */
export enum DirectoryEntryType {
    /**
     * Unknown
     */
    Unknown = 0,

    /**
     * Directory / folder
     */
    Directory = 1,

    /**
     * File
     */
    File = 2,
}

/**
 * Validates a request.
 *
 * @param {string} username The username.
 * @param {string} password The password.
 *
 * @return {RequestValidatorResult|PromiseLike<RequestValidatorResult>} The result that indicates, if request is valid or not.
 */
export type RequestValidator = (request: Express.Request) => RequestValidatorResult | PromiseLike<RequestValidatorResult>;

/**
 * The possible results of an request validator.
 */
export type RequestValidatorResult = boolean | void | undefined | null;

/**
 * Options for a host.
 */
export interface ShareFolderHostOptions {
    /**
     * A function to validate an account.
     */
    accountValidator?: AccountValidator;
    /**
     * Indicates if clients can do write operations or not.
     */
    canWrite?: boolean;
    /**
     * The custom TCP port.
     */
    port?: number;
    /**
     * The custom name of the real for basic authentification.
     */
    realm?: string;
    /**
     * A function that validates a request.
     */
    requestValidator?: RequestValidator;
    /**
     * The custom root directory.
     */
    root?: string;
    /**
     * SSL settings.
     */
    ssl?: ShareFolderHostSSLOptions;
}

/**
 * SSL settings.
 */
export interface ShareFolderHostSSLOptions {
    /**
     * The path to the ca file.
     */
    ca?: string;
    /**
     * The path to the file of the certificate.
     */
    cert?: string;
    /**
     * The path to the key file.
     */
    key?: string;
    /**
     * The required password for the key file.
     */
    passphrase?: string;
    /**
     * Request unauthorized or not.
     */
    rejectUnauthorized?: boolean;
}

/**
 * The default TCP port for a host.
 */
export const DEFAULT_PORT = 55555;
/**
 * HTTP header with a folder item type.
 */
export const HEADER_TYPE = 'x-share-folder-type';

/**
 * A host for sharing a folder.
 */
export class ShareFolderHost extends Events.EventEmitter {
    private _server: HTTP.Server | HTTPs.Server;

    /**
     * Initializes a new instance of that class.
     *
     * @param {ShareFolderHostOptions} options The options for the host.
     */
    public constructor(public readonly options: ShareFolderHostOptions) {
        super();
    }

    private async createInstance(): Promise<Express.Express> {
        const APP = Express();

        let rootDir = sf_helpers.toStringSafe(this.options.root);
        {
            if ('' === rootDir.trim()) {
                rootDir = process.cwd();
            }

            if (!Path.isAbsolute(rootDir)) {
                rootDir = Path.resolve(
                    process.cwd(), rootDir
                );
            }
        }
        rootDir = Path.resolve(rootDir);

        let realm = sf_helpers.toStringSafe(this.options.realm).trim();
        if ('' === realm) {
            realm = 'node-share-folder';
        }

        // IP check
        APP.use(async (req, resp, next) => {
            let canConnect = true;

            const REQUEST_VALIDATOR = this.options.requestValidator;
            if (REQUEST_VALIDATOR) {
                canConnect = sf_helpers.toBooleanSafe(
                    await Promise.resolve(
                        REQUEST_VALIDATOR( req )
                    )
                );
            }

            if (canConnect) {
                next();
                return;
            }

            try {
                req.socket.end();
            } catch { }
        });

        // headers
        APP.use(function (req, resp, next) {
            req['__vars'] = {};

            resp.setHeader('X-Powered-By', 'node-share-folder (Express)');
            resp.setHeader('X-TM-MK', Moment.utc('1979-09-05 23:09', 'YYYY-MM-DD HH:mm').toISOString());

            next();
        });

        // Basic Auth
        APP.use(async (req, resp, next) => {
            const ACCOUNT_VALIDATOR = this.options.accountValidator;
            if (ACCOUNT_VALIDATOR) {
                let matchingAccount: Account | false = false;
                
                let username: string;
                let password: string;

                const AUTHORIZATION = sf_helpers.toStringSafe(req.header('authorization')).trim();
                if (AUTHORIZATION.toLowerCase().startsWith('basic ')) {
                    const USERNAME_AND_PASSWORD = (
                        new Buffer(AUTHORIZATION.substr(6).trim(), 'base64')
                    ).toString('utf8');

                    const SEP = USERNAME_AND_PASSWORD.indexOf(':');
                    if (SEP > -1) {
                        username = USERNAME_AND_PASSWORD.substr(0, SEP);
                        password = USERNAME_AND_PASSWORD.substr(SEP + 1);
                    } else {
                        username = USERNAME_AND_PASSWORD;
                    }

                    username = sf_helpers.normalizeString(username);
                    password = sf_helpers.toStringSafe(password);
                }

                const IS_VALID = sf_helpers.toBooleanSafe(
                    await Promise.resolve(
                        ACCOUNT_VALIDATOR(username, password)
                    )
                );

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
        });

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

        APP.use(async (req, resp, next) => {
            if (await FS.exists(rootDir)) {
                if ((await FSExtra.stat(rootDir)).isDirectory()) {
                    return next();
                }
            }

            return resp.status(503)
                       .send();
        });

        await this.setupEndpoints(APP, rootDir);

        return APP;
    }

    /**
     * Gets if the host is currently running or not.
     */
    public get isRunning() {
        return !_.isNil(this._server);
    }

    /**
     * Gets the TCP port for the host.
     */
    public get port() {
        let p = parseInt(
            sf_helpers.toStringSafe(this.options.port).trim()
        );
        if (isNaN(p)) {
            p = DEFAULT_PORT;
        }

        return p;
    }

    private async setupEndpoints(app: Express.Express, rootDir: string) {
        const EXISTS = (p: string): Promise<boolean> => {
            p = sf_helpers.toStringSafe(p);

            return new Promise<boolean>((resolve, reject) => {
                const COMPLETED = sf_helpers.createCompletedAction(resolve, reject);

                try {
                    FSExtra.exists(p, (exists) => {
                        COMPLETED(null, exists);
                    });
                } catch (e) {
                    COMPLETED(e);
                }
            });
        };

        const GET_DIRECTORY_ENTRY = async function (p: string, n?: string): Promise<DirectoryEntry> {
            p = sf_helpers.toStringSafe(p);

            return TO_DIRECTORY_ENTRY(
                await FSExtra.stat(p),
                arguments.length < 2 ? Path.basename(p)
                                     : sf_helpers.toStringSafe(n),
            );
        };

        const IS_OUTSIDE = (requestedPath: string) => {
            requestedPath = sf_helpers.normalizePath(requestedPath);

            const FILE_OR_FOLDER = Path.resolve(
                Path.join(rootDir, requestedPath)
            );

            return (rootDir !== FILE_OR_FOLDER) &&
                   !FILE_OR_FOLDER.startsWith(rootDir + Path.sep);
        };

        const SANATIZE_PATH = (p: string) => {
            return Path.resolve(
                Path.join(
                    Path.dirname(p),
                    SanitizeFilename(Path.basename(p)),
                )
            );
        };

        const SEND_JSON = (resp: Express.Response, data: any) => {
            resp.setHeader('Content-Type', 'application/json; charset=utf8');

            return resp.status(200).send(new Buffer(
                JSON.stringify(data), 'utf8'
            ));
        };

        const TO_DIRECTORY_ENTRY = function (stat: FS.Stats, n?: string): DirectoryEntry {
            if (!_.isNil(stat)) {
                return {
                    ctime: sf_helpers.asUTC(stat.ctime).toISOString(),
                    mtime: sf_helpers.asUTC(stat.mtime).toISOString(),
                    name: n,
                    size: stat.size,
                    type: stat.isDirectory() ? DirectoryEntryType.Directory
                                             : DirectoryEntryType.File,
                };
            } else {
                return <any>stat;
            }
        };

        // get directory list or
        // file content / info
        app.get('/*', async (req, resp) => {
            const REQUESTED_PATH = sf_helpers.normalizePath(req.path);
            if (IS_OUTSIDE(REQUESTED_PATH)) {
                return resp.status(400)
                           .send();
            }

            const FILE_OR_FOLDER = SANATIZE_PATH(
                Path.join(rootDir, REQUESTED_PATH)
            );

            if (!(await EXISTS(FILE_OR_FOLDER))) {
                return resp.status(404)
                           .send();
            }

            if ('1' === sf_helpers.normalizeString(req.query['info'])) {
                return SEND_JSON(
                    resp,
                    await GET_DIRECTORY_ENTRY(
                        FILE_OR_FOLDER,
                        '/' === REQUESTED_PATH ? undefined
                                               : Path.basename(FILE_OR_FOLDER)
                    )
                );
            }

            const SELF_STAT = await FSExtra.stat( FILE_OR_FOLDER );

            if (SELF_STAT.isDirectory()) {
                resp.setHeader(HEADER_TYPE, 'd');

                const RESULT: DirectoryEntry[] = [];

                const LIST = await FSExtra.readdir( FILE_OR_FOLDER );
                for (const NAME of LIST) {
                    const FULL_PATH = Path.resolve(
                        Path.join(FILE_OR_FOLDER, NAME)
                    );

                    RESULT.push(
                        TO_DIRECTORY_ENTRY(await FSExtra.stat( FULL_PATH ),
                                           NAME)
                    );
                }

                if (RESULT.length > 0) {
                    return SEND_JSON(resp,
                                     RESULT);
                }

                return resp.status(204)
                           .send();
            } else {
                resp.setHeader(HEADER_TYPE, 'f');

                const CONTENT_TYPE = MimeTypes.lookup(FILE_OR_FOLDER);
                if (false !== CONTENT_TYPE) {
                    resp.setHeader('Content-Type',
                                   sf_helpers.normalizeString(CONTENT_TYPE));
                }

                const DATA = await FSExtra.readFile( FILE_OR_FOLDER );
                if (DATA.length > 0) {
                    return resp.status(200)
                               .send(DATA);
                }

                return resp.status(204)
                           .send();
            }
        });

        // create directory
        app.post('/*', async (req, resp) => {
            const REQUESTED_PATH = sf_helpers.normalizePath(req.path);
            if (IS_OUTSIDE(REQUESTED_PATH) || ('/' === REQUESTED_PATH)) {
                return resp.status(400)
                           .send();
            }

            const NEW_FOLDER = SANATIZE_PATH(
                Path.join(rootDir, REQUESTED_PATH)
            );

            if (await EXISTS(NEW_FOLDER)) {
                return resp.status(409)
                           .send();
            }

            await FSExtra.mkdirs( NEW_FOLDER );

            return SEND_JSON(resp,
                             await GET_DIRECTORY_ENTRY(NEW_FOLDER));
        });

        // write (new) file
        app.put('/*', async (req, resp) => {
            const REQUESTED_PATH = sf_helpers.normalizePath(req.path);
            if (IS_OUTSIDE(REQUESTED_PATH) || ('/' === REQUESTED_PATH)) {
                return resp.status(400)
                           .send();
            }

            const FILE = SANATIZE_PATH(
                Path.join(rootDir, REQUESTED_PATH)
            );

            if (await EXISTS(FILE)) {
                if ((await FSExtra.stat(FILE)).isDirectory()) {
                    return resp.status(409)
                               .send();
                }
            }

            const DIR = Path.dirname(FILE);
            if (!(await EXISTS(DIR))) {
                await FSExtra.mkdirs(DIR);
            }

            await FSExtra.writeFile(FILE,
                                    await sf_helpers.readAll(req));

            return SEND_JSON(resp,
                             await GET_DIRECTORY_ENTRY(FILE));
        });

        // delete file or folder
        app.delete('/*', async (req, resp) => {
            const REQUESTED_PATH = sf_helpers.normalizePath(req.path);
            if (IS_OUTSIDE(REQUESTED_PATH) || ('/' === REQUESTED_PATH)) {
                return resp.status(400)
                           .send();
            }

            const FILE_OR_FOLDER = SANATIZE_PATH(
                Path.join(rootDir, REQUESTED_PATH)
            );

            if (!(await EXISTS(FILE_OR_FOLDER))) {
                return resp.status(404)
                           .send();
            }

            const STAT = await FSExtra.stat(FILE_OR_FOLDER);

            if (STAT.isDirectory()) {
                await FSExtra.remove(FILE_OR_FOLDER);
            } else {
                await FSExtra.unlink(FILE_OR_FOLDER);
            }

            return SEND_JSON(
                resp,
                await TO_DIRECTORY_ENTRY(
                    STAT,
                    Path.basename(FILE_OR_FOLDER)
                )
            );
        });
    }

    /**
     * Starts the host.
     *
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    public start() {
        return new Promise<boolean>(async (resolve, reject) => {
            const COMPLETED = sf_helpers.createCompletedAction(resolve, reject);

            try {
                if (this.isRunning) {
                    COMPLETED(null, false);
                    return;
                }

                const APP = await this.createInstance();

                let serverFactory: () => Promise<HTTP.Server | HTTPs.Server>;

                const SSL = this.options.ssl;
                if (_.isNil(SSL)) {
                    serverFactory = async () => {
                        return HTTP.createServer(APP);
                    };
                } else {
                    serverFactory = async () => {
                        const LOAD_DATA = async (file: string) => {
                            file = sf_helpers.toStringSafe(file);
                            if (sf_helpers.isEmptyString(file)) {
                                return;
                            }

                            if (!Path.isAbsolute(file)) {
                                file = Path.join(
                                    process.cwd(), file
                                );
                            }
                            file = Path.resolve(file);

                            return await FSExtra.readFile(file);
                        };

                        let passphrase = sf_helpers.toStringSafe(SSL.passphrase);
                        if ('' === passphrase) {
                            passphrase = undefined;
                        }

                        return HTTPs.createServer({
                            ca: await LOAD_DATA(SSL.ca),
                            cert: await LOAD_DATA(SSL.cert),
                            key: await LOAD_DATA(SSL.key),
                            passphrase: passphrase,
                            rejectUnauthorized: sf_helpers.toBooleanSafe(
                                SSL.rejectUnauthorized, false
                            ),
                        }, APP);
                    };
                }

                const NEW_SERVER = await serverFactory();

                NEW_SERVER.once('error', (err) => {
                    COMPLETED(err);
                });

                NEW_SERVER.listen(this.port, () => {
                    this._server = NEW_SERVER;

                    COMPLETED(null, true);
                });
            } catch (e) {
                COMPLETED(e);
            }
        });
    }

    /**
     * Stops the host.
     *
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    public stop() {
        return new Promise<boolean>((resolve, reject) => {
            const COMPLETED = sf_helpers.createCompletedAction(resolve, reject);

            try {
                const OLD_SERVER = this._server;

                if (_.isNil(OLD_SERVER)) {
                    COMPLETED(null, false);
                } else {
                    OLD_SERVER.close(() => {
                        this._server = null;

                        COMPLETED(null, true);
                    });
                }
            } catch (e) {
                COMPLETED(e);
            }
        });
    }
}
