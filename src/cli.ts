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
import * as FSExtra from 'fs-extra';
import * as Minimist from 'minimist';
import * as sf_client from './client';
import * as sf_helpers from './helpers';
import * as sf_host from './host';
import * as Table from 'table';

let ca: string;
let cert: string;
let del = false;
let download = false;
let host: string;
const IPS: string[] = [];
let key: string;
let list = false;
let passphrase: string;
let password: string;
let port: number;
let rejectUnauthorized;
let rootDir: string;
let showHelp = false;
let ssl = false;
let upload = false;
let user: string;

const CMD_ARGS = Minimist(process.argv.slice(2));

for (const A in CMD_ARGS) {
    const ARGS = sf_helpers.asArray(CMD_ARGS[A]);

    switch (sf_helpers.normalizeString(A)) {
        case '_':
            rootDir = Enumerable.from(ARGS)
                                .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined);
            break;

        case '?':
        case 'help':
            showHelp = Enumerable.from(ARGS)
                                 .any(a => sf_helpers.toBooleanSafe(a));
            break;

        case 'h':
        case 'host':
            host = Enumerable.from(ARGS)
                             .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined);
            break;

        case 'ips':
            Enumerable.from(ARGS).select(a => {
                return sf_helpers.toStringSafe(a);
            }).where(a => {
                return !sf_helpers.isEmptyString(a);
            }).pushTo(IPS);
            break;

        case 'ca':
            ca = Enumerable.from(ARGS)
                           .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined);
            break;

        case 'cert':
            cert = Enumerable.from(ARGS)
                             .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined);
            break;

        case 'del':
        case 'delete':
            del = Enumerable.from(ARGS)
                            .any(a => sf_helpers.toBooleanSafe(a));
            break;

        case 'dl':
        case 'download':
            download = Enumerable.from(ARGS)
                                 .any(a => sf_helpers.toBooleanSafe(a));
            break;

        case 'key':
            key = Enumerable.from(ARGS)
                            .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined);
            break;

        case 'list':
            list = Enumerable.from(ARGS)
                             .any(a => sf_helpers.toBooleanSafe(a));
            break;

        case 'p':
        case 'password':
            password = sf_helpers.toStringSafe(
                Enumerable.from(ARGS)
                          .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined)
            );
            break;

        case 'port':
            port = parseInt(
                sf_helpers.toStringSafe(
                    Enumerable.from(ARGS)
                              .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined)
                )
            );
            break;

        case 'passphrase':
            passphrase = sf_helpers.toStringSafe(
                Enumerable.from(ARGS)
                          .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined)
            );
            break;

        case 'ra':
        case 'reject-unauthorized':
            rejectUnauthorized = Enumerable.from(ARGS)
                                           .any(a => sf_helpers.toBooleanSafe(a));
            break;

        case 'ssl':
            ssl = Enumerable.from(ARGS)
                            .any(a => sf_helpers.toBooleanSafe(a));
            break;

        case 'u':
        case 'user':
            user = sf_helpers.toStringSafe(
                Enumerable.from(ARGS)
                          .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined)
            );
            break;

        case 'ul':
        case 'upload':
            upload = Enumerable.from(ARGS)
                               .any(a => sf_helpers.toBooleanSafe(a));
            break;
    }
}

if (showHelp) {
    sf_helpers.write_ln(`node-share-folder`);
    sf_helpers.write_ln(`Syntax:    [root directory] [options]`);
    sf_helpers.write_ln();
    sf_helpers.write_ln(`Examples:  share-folder .`);
    sf_helpers.write_ln(`           share-folder --cert=/ca/file --key=/key/file`);
    sf_helpers.write_ln(`           share-folder /path/to/folder --ips="192.168.0.0/24" --ips="192.168.5.0/24"`);
    sf_helpers.write_ln(`           share-folder --user=mkloubert --password=P@ssword123!`);
    sf_helpers.write_ln(`           share-folder --list /path/on/remote`);
    sf_helpers.write_ln(`           share-folder --upload /path/on/remote < /path/to/local/file`);
    sf_helpers.write_ln();
    sf_helpers.write_ln(`Options:`);
    sf_helpers.write_ln(` -?, --help                    Show this help screen.`);
    sf_helpers.write_ln(` --ca                          The path to SSL CA for secure HTTP mode.`);
    sf_helpers.write_ln(` --cert                        The path to SSL CERT for secure HTTP mode.`);
    sf_helpers.write_ln(` -del, --delete                Deletes a file or folder.`);
    sf_helpers.write_ln(` -dl, --download               Downloads a file and sends it to stdout.`);
    sf_helpers.write_ln(` -h, --host                    The address of the host to connect to.`);
    sf_helpers.write_ln(` --ips                         A list of one or more IPs (CIDR) to add to a whitelist of allowed remote clients.`);
    sf_helpers.write_ln(` --key                         The path to SSL KEY for secure HTTP mode.`);
    sf_helpers.write_ln(` --list                        List a remote directory.`);
    sf_helpers.write_ln(` -p, --password                The password for the authentification to use.`);
    sf_helpers.write_ln(` --port                        The TCP port to use. Default: 55555`);
    sf_helpers.write_ln(` --passphrase                  SSL passphrase.`);
    sf_helpers.write_ln(` -ra, --reject-unauthorized    Reject unauthorized SSL connections. Default: (false)`);
    sf_helpers.write_ln(` --ssl                         Use secure connection when connecting to a host.`);
    sf_helpers.write_ln(` -u, --user                    The username for the authentification to use.`);
    sf_helpers.write_ln(` -ul, --upload                 Uploads the data from stdin to a remote host.`);
    sf_helpers.write_ln();

    process.exit(1);
}

if (sf_helpers.isEmptyString(rootDir)) {
    rootDir = '.';
}
if (isNaN(port)) {
    port = undefined;
}

if (sf_helpers.isEmptyString(ca)) {
    ca = undefined;
}
if (sf_helpers.isEmptyString(cert)) {
    cert = undefined;
}
if (sf_helpers.isEmptyString(key)) {
    key = undefined;
}
if (sf_helpers.isEmptyString(passphrase)) {
    passphrase = undefined;
}
if (sf_helpers.isEmptyString(user)) {
    user = undefined;
}
if (sf_helpers.isEmptyString(password)) {
    password = undefined;
}

const IS_CLIENT_MODE = sf_helpers.toBooleanSafe(list) ||
                       sf_helpers.toBooleanSafe(upload) ||
                       sf_helpers.toBooleanSafe(download) ||
                       sf_helpers.toBooleanSafe(del);

(async () => {
    if (IS_CLIENT_MODE) {
        const CLIENT = new sf_client.ShareFolderClient({
            host: host,
            password: password,
            port: port,
            ssl: ssl,
            user: user,
        });

        if (list) {
            const DIR = sf_helpers.normalizePath(rootDir);

            const ENTRIES = await CLIENT.list(DIR);

            sf_helpers.write_err_ln(`Result of '${ DIR }':`);
            if (ENTRIES.length > 0) {
                const TABEL_DATA: any[] = [];
                const TABLE_CFG: Table.TableUserConfig = {
                    columns: {
                        0: {
                            paddingLeft: 2,
                            alignment: 'left',
                            paddingRight: 2,
                        },
                        1: {
                            paddingLeft: 2,
                            alignment: 'center',
                            paddingRight: 2,
                        },
                        2: {
                            paddingLeft: 2,
                            alignment: 'right',
                            paddingRight: 2,
                        }
                    },
                };

                TABEL_DATA.push([
                    'Name', 'Type', 'Size'
                ]);

                for (const E of ENTRIES) {
                    TABEL_DATA.push([
                        E.name, E.type, E.size
                    ]);
                }

                sf_helpers.write(
                    Table.table(TABEL_DATA, TABLE_CFG)
                );
            } else {
                sf_helpers.write_err_ln('The directory is empty.');
            }
        } else if (upload) {
            const DATA_TO_UPLOAD = await FSExtra.readFile(0);

            const FILE_PATH = sf_helpers.normalizePath(rootDir);

            const FILE_STAT = await CLIENT.upload(FILE_PATH, DATA_TO_UPLOAD);

            sf_helpers.write_err_ln(`File has been uploaded to '${ FILE_PATH }'.`);
        } else if (download) {
            const FILE_PATH = sf_helpers.normalizePath(rootDir);

            process.stdout.write(
                await CLIENT.download(FILE_PATH)
            );

            sf_helpers.write_err_ln(`File has been downloaded from '${ FILE_PATH }' .`);
        } else if (del) {
            const FILE_PATH = sf_helpers.normalizePath(rootDir);

            const DELETED_ITEM = await CLIENT.remove(
                FILE_PATH
            );

            sf_helpers.write_err_ln(`${sf_host.DirectoryEntryType.Directory === DELETED_ITEM.type ? 'Directory' : 'File'} '${ FILE_PATH }' has been removed.`);
        }
    } else {
        let ssl: sf_host.ShareFolderHostSSLOptions;
        if (!_.isNil(ca) || !_.isNil(cert) || !_.isNil(key)) {
            ssl = {
                ca: ca,
                cert: cert,
                key: key,
                passphrase: passphrase,
                rejectUnauthorized: sf_helpers.toBooleanSafe(rejectUnauthorized),
            };
        }

        const ACCOUNTS: sf_host.Account[] = [];
        if (!_.isNil(user) || !_.isNil(password)) {
            ACCOUNTS.push({
                name: user,
                password: password,
            });
        }

        const HOST = new sf_host.ShareFolderHost({
            accounts: ACCOUNTS,
            allowed: IPS,
            port: port,
            root: rootDir,
            ssl: ssl,
        });

        await HOST.start();

        sf_helpers.write_ln(
            `Server now runs on port ${ HOST.port } ...`
        );
    }
})();