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
import * as Enumerable from 'node-enumerable';
import * as HTTP from 'http';
import * as HTTPs from 'https';
const NormalizeHeaderCase = require("header-case-normalizer");
import * as sf_helpers from './helpers';
import * as sf_host from './host';

/**
 * Options for a client.
 */
export interface ShareFolderClientOptions {
    /**
     * The host address.
     */
    host?: string;
    /**
     * The password.
     */
    password?: string;
    /**
     * The TCP port.
     */
    port?: number;
    /**
     * Use SSL or not.
     */
    ssl?: boolean;
    /**
     * The username.
     */
    user?: string;
}

/**
 * A result of a client request.
 */
export interface ShareFolderClientResult {
    /**
     * The response code.
     */
    code: number;
    /**
     * The response headers.
     */
    headers: any;
    /**
     * The request options.
     */
    options: HTTP.RequestOptions | HTTPs.RequestOptions;
    /**
     * The request context.
     */
    request: HTTP.ClientRequest;
    /**
     * The response context.
     */
    response: HTTP.IncomingMessage;
}

/**
 * A client for accessing a share folder instance.
 */
export class ShareFolderClient {
    /**
     * Initializes a new instance of that class.
     *
     * @param {ShareFolderClientOptions} opts Custom options.
     */
    public constructor(opts?: ShareFolderClientOptions) {
        if (_.isNil(opts)) {
            opts = <any>{};
        }

        this.host = sf_helpers.normalizeString(opts.host);
        if ('' === this.host) {
            this.host = '127.0.0.1';
        }

        this.port = parseInt(
            sf_helpers.toStringSafe(opts.port).trim()
        );
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

    /**
     * The account to use.
     */
    public readonly account: sf_host.Account;

    private delete(path: string, body?: Buffer, headers?: any) {
        return this.request(path, 'DELETE',
                            body, headers);
    }

    /**
     * Downloads a file.
     *
     * @param {string} path The path to the remote file.
     *
     * @return {Buffer} The directory entry of the file.
     */
    public async download(path: string, stream?: NodeJS.WritableStream): Promise<Buffer> {
        const RESULT = await this.get(
            sf_helpers.normalizePath(path)
        );

        if ([200, 204].indexOf(RESULT.code) < 0) {
            throw new Error(`Unexpected response '${ sf_helpers.toStringSafe(RESULT.code) }'!`);
        }

        if ('f' !== sf_helpers.normalizeString(RESULT.headers[ sf_host.HEADER_TYPE ])) {
            throw new Error('No file!');
        }

        if (204 === RESULT.code) {
            return Buffer.alloc(0);
        }

        if (arguments.length < 1) {
            return sf_helpers.readAll( RESULT.response );
        }
    }

    private get(path: string, headers?: any) {
        return this.request(path, 'GET',
                            null, headers);
    }

    /**
     * Gets the address of the host.
     */
    public readonly host: string;

    /**
     * Lists a directory.
     *
     * @param {string} [path] The custom path of the directory to list.
     *
     * @return {sf_host.DirectoryEntry[]} The list of entries.
     */
    public async list(path = '/'): Promise<sf_host.DirectoryEntry[]> {
        const RESULT = await this.get(sf_helpers.normalizePath(path));

        if ('d' !== sf_helpers.normalizeString(RESULT.headers[sf_host.HEADER_TYPE])) {
            throw new Error('No directory!');
        }

        if ([200, 204].indexOf(RESULT.code) < 0) {
            throw new Error(`Unexpected response '${ sf_helpers.toStringSafe(RESULT.code) }'!`);
        }

        const ENTRIES: sf_host.DirectoryEntry[] = [];

        if (200 === RESULT.code) {
            sf_helpers.asArray(
                JSON.parse(
                    (await sf_helpers.readAll(RESULT.response)).toString('utf8')
                )
            ).forEach(e => {
                ENTRIES.push(e);
            });
        }

        return Enumerable.from(ENTRIES).orderBy(e => {
            return sf_host.DirectoryEntryType.Directory === e.type ? 0 : 1;
        }).thenBy(e => {
            return sf_helpers.normalizeString(e.name);
        }).toArray();
    }

    /**
     * Gets the TCP port of the host.
     */
    public readonly port: number;

    private post(path: string, body?: Buffer, headers?: any) {
        return this.request(path, 'POST',
                            body, headers);
    }

    private put(path: string, body?: Buffer, headers?: any) {
        return this.request(path, 'PUT',
                            body, headers);
    }

    /**
     * Removes a file or folder.
     *
     * @param {string} path The path to the file or folder.
     *
     * @return {Promise<sf_host.DirectoryEntry>} The promise with the entry of the removed item.
     */
    public async remove(path: string): Promise<sf_host.DirectoryEntry> {
        const RESULT = await this.delete(
            sf_helpers.normalizePath(path)
        );

        if (200 !== RESULT.code) {
            throw new Error(`Unexpected response '${ sf_helpers.toStringSafe(RESULT.code) }'!`);
        }

        return JSON.parse(
            (await sf_helpers.readAll(RESULT.response)).toString('utf8')
        );
    }

    private request(path: string, method: string, body?: Buffer, headers?: any) {
        method = sf_helpers.toStringSafe(method).toUpperCase().trim();
        if ('' === method) {
            method = 'GET';
        }

        path = sf_helpers.normalizePath(path);

        return new Promise<ShareFolderClientResult>(async (resolve, reject) => {
            const COMPLETED = sf_helpers.createCompletedAction(resolve, reject);

            let newRequest: HTTP.ClientRequest;
            let opts: HTTP.RequestOptions | HTTPs.RequestOptions;

            const CALLBACK = async (resp: HTTP.IncomingMessage) => {
                if (400 === resp.statusCode) {
                    COMPLETED(new Error('Invalid path!'));
                } else if (401 === resp.statusCode) {
                    COMPLETED(new Error('Unauthorized!'));
                } else if (404 === resp.statusCode) {
                    COMPLETED(new Error('Not found!'));
                } else {
                    COMPLETED(null, {
                        code: resp.statusCode,
                        headers: resp.headers || {},
                        options: opts,
                        request: newRequest,
                        response: resp,
                    });
                }
            };
            const CALLBACK_SYNC = (resp: HTTP.IncomingMessage) => {
                CALLBACK(resp).then(() => {
                }, (err) => {
                    COMPLETED(err);
                });
            };

            try {
                let requestFactory: () => Promise<HTTP.ClientRequest>;

                opts = {
                    headers: {},
                    hostname: this.host,
                    method: method,
                    path: path,
                    port: this.port,
                };

                if (this.account) {
                    opts.headers['Authorization'] = `Basic ${ new Buffer(this.account.name + ':' + this.account.password, 'ascii').toString('base64') }`;
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

                        opts.headers[ NormalizeHeaderCase(NAME) ] = VALUE;
                    }
                }

                if (this.ssl) {
                    requestFactory = async () => {
                        const HTTPs_OPTS = <HTTPs.RequestOptions>opts;
                        HTTPs_OPTS.protocol = 'https:';
                        HTTPs_OPTS.rejectUnauthorized = false;

                        return HTTPs.request(
                            HTTPs_OPTS, CALLBACK_SYNC
                        );
                    };
                } else {
                    requestFactory = async () => {
                        const HTTP_OPTS = <HTTP.RequestOptions>opts;
                        HTTP_OPTS.protocol = 'http:';

                        return HTTPs.request(
                            HTTP_OPTS, CALLBACK_SYNC
                        );
                    };
                }

                newRequest = await requestFactory();

                if (body && body.length > 0) {
                    newRequest.write(body);
                }

                newRequest.end();
            } catch (e) {
                COMPLETED(e);
            }
        });
    }

    /**
     * Gets if SSL should be used or not.
     */
    public readonly ssl: boolean;

    /**
     * Uploads a file.
     *
     * @param {string} path The path to the remote file.
     * @param {Buffer} data The data to upload.
     *
     * @return {sf_host.DirectoryEntry} The directory entry of the file.
     */
    public async upload(path: string, data: Buffer): Promise<sf_host.DirectoryEntry> {
        const RESULT = await this.put(
            sf_helpers.normalizePath(path),
            data
        );

        if (200 !== RESULT.code) {
            if (409 === RESULT.code) {
                throw new Error('Path is a directory!');
            }

            throw new Error(`Unexpected response '${ sf_helpers.toStringSafe(RESULT.code) }'!`);
        }

        return JSON.parse(
            (await sf_helpers.readAll(RESULT.response)).toString('utf8')
        );
    }
}
