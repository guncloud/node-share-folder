/// <reference types="node" />
import * as HTTP from 'http';
import * as HTTPs from 'https';
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
export declare class ShareFolderClient {
    /**
     * Initializes a new instance of that class.
     *
     * @param {ShareFolderClientOptions} opts Custom options.
     */
    constructor(opts?: ShareFolderClientOptions);
    /**
     * The account to use.
     */
    readonly account: sf_host.Account;
    private delete(path, data?, headers?);
    /**
     * Downloads a file.
     *
     * @param {string} path The path to the remote file.
     * @param {NodeJS.WritableStream} [stream] The optional destination stream to write to.
     *
     * @return {Promise<Buffer | undefined>} The promise with the downloaded data (if 'stream' is not defined).
     */
    download(path: string, stream?: NodeJS.WritableStream): Promise<Buffer | undefined>;
    private get(path, headers?);
    /**
     * Gets the address of the host.
     */
    readonly host: string;
    /**
     * Lists a directory.
     *
     * @param {string} [path] The custom path of the directory to list.
     *
     * @return {sf_host.DirectoryEntry[]} The list of entries.
     */
    list(path?: string): Promise<sf_host.DirectoryEntry[]>;
    /**
     * Gets the TCP port of the host.
     */
    readonly port: number;
    private post(path, data?, headers?);
    private put(path, data?, headers?);
    /**
     * Removes a file or folder.
     *
     * @param {string} path The path to the file or folder.
     *
     * @return {Promise<sf_host.DirectoryEntry>} The promise with the entry of the removed item.
     */
    remove(path: string): Promise<sf_host.DirectoryEntry>;
    private request(path, method, data?, headers?);
    /**
     * Gets if SSL should be used or not.
     */
    readonly ssl: boolean;
    /**
     * Uploads a file.
     *
     * @param {string} path The path to the remote file.
     * @param {any} data The data (can be a stream) to upload.
     *
     * @return {sf_host.DirectoryEntry} The directory entry of the file.
     */
    upload(path: string, data: any): Promise<sf_host.DirectoryEntry>;
}
