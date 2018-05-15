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
import * as IP from 'ip';
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
    type: DirectoryEntryDirectory | DirectoryEntryFile;
}

/**
 * Directory entry type value for a directory.
 */
export type DirectoryEntryDirectory = 'd';
/**
 * Directory entry type value for a file.
 */
export type DirectoryEntryFile = 'f';

/**
 * Options for a host.
 */
export interface ShareFolderHostOptions {
    /**
     * A list of one or more accounts.
     */
    accounts?: Account | Account[];
    /**
     * One or more allowed IP addresses in CIDR format.
     */
    allowed?: string | string[];
    /**
     * The custom TCP port.
     */
    port?: number;
    /**
     * The custom name of the real for basic authentification.
     */
    realm?: string;
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

        const ALLOWED_IPS =
            Enumerable.from(
                sf_helpers.asArray(
                    this.options.allowed
                ).map(a => sf_helpers.normalizeString(a))
                 .filter(a => '' !== a)
                 .map(a => {
                          if (a.indexOf('/') < 0) {
                              if (IP.isV4Format(a)) {
                                  a += "/32";
                              } else {
                                  a += "/128";
                              }
                          }

                          return a;
                      })
            ).distinct()
             .toArray();

        const ACCOUNTS = sf_helpers.asArray(this.options.accounts).map(a => {
            a = sf_helpers.cloneObject(a);
            a.name = sf_helpers.normalizeString(a.name);
            a.password = sf_helpers.toStringSafe(a.password);

            return a;
        });

        let realm = sf_helpers.toStringSafe(this.options.realm).trim();
        if ('' === realm) {
            realm = 'node-share-folder';
        }

        // IP check
        APP.use((req, resp, next) => {
            let canConnect = ALLOWED_IPS.length < 1;
            if (!canConnect) {
                canConnect = IP.isLoopback(req.socket.remoteAddress);
            }
            if (!canConnect) {
                canConnect = Enumerable.from( ALLOWED_IPS )
                                       .any(a => IP.cidrSubnet(a)
                                                   .contains(req.socket.remoteAddress));
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
        APP.use((req, resp, next) => {
            resp.setHeader('X-Powered-By', 'node-share-folder (Express)');
            resp.setHeader('X-TM-MK', Moment.utc('1979-09-05 23:09', 'YYYY-MM-DD HH:mm').toISOString());

            next();
        });

        // Basic Auth
        APP.use((req, resp, next) => {
            if (ACCOUNTS.length > 0) {
                let matchingAccount: Account | false = false;

                const AUTHORIZATION = sf_helpers.toStringSafe(req.header('authorization')).trim();
                if (AUTHORIZATION.toLowerCase().startsWith('basic ')) {
                    const USERNAME_AND_PASSWORD = (
                        new Buffer(AUTHORIZATION.substr(6).trim(), 'base64')
                    ).toString('utf8');

                    let username: string;
                    let password: string;

                    const SEP = USERNAME_AND_PASSWORD.indexOf(':');
                    if (SEP > -1) {
                        username = USERNAME_AND_PASSWORD.substr(0, SEP);
                        password = USERNAME_AND_PASSWORD.substr(SEP + 1);
                    } else {
                        username = USERNAME_AND_PASSWORD;
                    }

                    username = sf_helpers.normalizeString(username);
                    password = sf_helpers.toStringSafe(password);

                    matchingAccount = Enumerable.from(ACCOUNTS).lastOrDefault(a => {
                        return a.name === username &&
                               a.password === password;
                    }, false);
                }

                if (false === matchingAccount) {
                    resp.setHeader('WWW-Authenticate', 'Basic realm=' + realm.trim());

                    return resp.status(401)
                               .send();
                }
            }

            return next();
        });

        APP.use((req, resp, next) => {
            if (FSExtra.existsSync(rootDir)) {
                if (FSExtra.lstatSync(rootDir).isDirectory()) {
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

            const STAT = await FSExtra.lstat(p);

            return TO_DIRECTORY_ENTRY(
                await FSExtra.lstat(p),
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
                    type: stat.isDirectory() ? 'd' : 'f',
                };
            } else {
                return <any>stat;
            }
        };

        // git directory list or
        // file content / info
        app.get('/:path?', async (req, resp) => {
            const REQUESTED_PATH = sf_helpers.normalizePath(req.params.path);

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

            const SELF_STAT = await FSExtra.lstat( FILE_OR_FOLDER );

            if (SELF_STAT.isDirectory()) {
                resp.setHeader(HEADER_TYPE, 'd');

                const RESULT: DirectoryEntry[] = [];

                const LIST = await FSExtra.readdir( FILE_OR_FOLDER );
                for (const NAME of LIST) {
                    const FULL_PATH = Path.resolve(
                        Path.join(FILE_OR_FOLDER, NAME)
                    );

                    const STAT = await FSExtra.lstat( FULL_PATH );

                    RESULT.push({
                        ctime: sf_helpers.asUTC(STAT.ctime).toISOString(),
                        mtime: sf_helpers.asUTC(STAT.mtime).toISOString(),
                        name: NAME,
                        size: STAT.size,
                        type: STAT.isDirectory() ? 'd' : 'f',
                    });
                }

                if (RESULT.length > 0) {
                    return SEND_JSON(resp, Enumerable.from(RESULT).orderBy(e => {
                        return 'd' === e.type ? 0 : 1;
                    }).thenBy(e => {
                        return sf_helpers.normalizeString(e.name);
                    }).toArray());
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
        app.post('/:path?', async (req, resp) => {
            const REQUESTED_PATH = sf_helpers.normalizePath(req.params.path);
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
        app.put('/:path?', async (req, resp) => {
            const REQUESTED_PATH = sf_helpers.normalizePath(req.params.path);
            if (IS_OUTSIDE(REQUESTED_PATH) || ('/' === REQUESTED_PATH)) {
                return resp.status(400)
                           .send();
            }

            const FILE = SANATIZE_PATH(
                Path.join(rootDir, REQUESTED_PATH)
            );

            await FSExtra.writeFile(FILE,
                                    await sf_helpers.readAll(req));

            return SEND_JSON(resp,
                             await GET_DIRECTORY_ENTRY(FILE));
        });

        // delete file or folder
        app.delete('/:path?', async (req, resp) => {
            const REQUESTED_PATH = sf_helpers.normalizePath(req.params.path);
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

            const STAT = await FSExtra.lstat(FILE_OR_FOLDER);

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
