/// <reference types="node" />
import * as Events from 'events';
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
 * @return {AccountValidatorResult|PromiseLike<AccountValidatorResult>} The result that insicates if account is valid or not.
 */
export declare type AccountValidator = (username: string, password: string) => AccountValidatorResult | PromiseLike<AccountValidatorResult>;
/**
 * The possible results of an account validator.
 */
export declare type AccountValidatorResult = boolean | void | undefined | null;
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
export declare enum DirectoryEntryType {
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
 * Options for a host.
 */
export interface ShareFolderHostOptions {
    /**
     * A function to validate an account.
     */
    accountValidator?: AccountValidator;
    /**
     * One or more allowed IP addresses in CIDR format.
     */
    allowed?: string | string[];
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
export declare const DEFAULT_PORT = 55555;
/**
 * HTTP header with a folder item type.
 */
export declare const HEADER_TYPE = "x-share-folder-type";
/**
 * A host for sharing a folder.
 */
export declare class ShareFolderHost extends Events.EventEmitter {
    readonly options: ShareFolderHostOptions;
    private _server;
    /**
     * Initializes a new instance of that class.
     *
     * @param {ShareFolderHostOptions} options The options for the host.
     */
    constructor(options: ShareFolderHostOptions);
    private createInstance();
    /**
     * Gets if the host is currently running or not.
     */
    readonly isRunning: boolean;
    /**
     * Gets the TCP port for the host.
     */
    readonly port: number;
    private setupEndpoints(app, rootDir);
    /**
     * Starts the host.
     *
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    start(): Promise<boolean>;
    /**
     * Stops the host.
     *
     * @return {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    stop(): Promise<boolean>;
}
