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
export declare type DirectoryEntryDirectory = 'd';
/**
 * Directory entry type value for a file.
 */
export declare type DirectoryEntryFile = 'f';
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
