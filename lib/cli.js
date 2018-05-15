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
const Minimist = require("minimist");
const sf_helpers = require("./helpers");
const sf_host = require("./host");
let ca;
let cert;
const IPS = [];
let key;
let passphrase;
let password;
let port;
let rejectUnauthorized;
let rootDir;
let showHelp = false;
let user;
const CMD_ARGS = Minimist(process.argv.slice(2));
for (const A in CMD_ARGS) {
    const ARGS = sf_helpers.asArray(CMD_ARGS[A]);
    switch (sf_helpers.normalizeString(A)) {
        case '_':
            rootDir = Enumerable.from(ARGS)
                .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined);
            break;
        case '?':
        case 'h':
        case 'help':
            showHelp = true;
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
        case 'key':
            key = Enumerable.from(ARGS)
                .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined);
            break;
        case 'p':
        case 'password':
            password = sf_helpers.toStringSafe(Enumerable.from(ARGS)
                .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined));
            break;
        case 'port':
            port = parseInt(sf_helpers.toStringSafe(Enumerable.from(ARGS)
                .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined)));
            break;
        case 'passphrase':
            passphrase = sf_helpers.toStringSafe(Enumerable.from(ARGS)
                .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined));
            break;
        case 'ra':
        case 'reject-unauthorized':
            rejectUnauthorized = Enumerable.from(ARGS)
                .any(a => sf_helpers.toBooleanSafe(a));
            break;
        case 'u':
        case 'user':
            user = sf_helpers.toStringSafe(Enumerable.from(ARGS)
                .lastOrDefault(a => !sf_helpers.isEmptyString(a), undefined));
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
    sf_helpers.write_ln();
    sf_helpers.write_ln(`Options:`);
    sf_helpers.write_ln(` -?, --help                    Show this help screen.`);
    sf_helpers.write_ln(` --ca                          The path to SSL CA for secure HTTP mode.`);
    sf_helpers.write_ln(` --cert                        The path to SSL CERT for secure HTTP mode.`);
    sf_helpers.write_ln(` --ips                         A list of one or more IPs (CIDR) to add to a whitelist of allowed remote clients.`);
    sf_helpers.write_ln(` --key                         The path to SSL KEY for secure HTTP mode.`);
    sf_helpers.write_ln(` -p, --password                The password for the authentification to use.`);
    sf_helpers.write_ln(` --port                        The TCP port to use. Default: 55555`);
    sf_helpers.write_ln(` --passphrase                  SSL passphrase.`);
    sf_helpers.write_ln(` -ra, --reject-unauthorized    Reject unauthorized SSL connections. Default: (false)`);
    sf_helpers.write_ln(` -u, --user                    The username for the authentification to use.`);
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
(() => __awaiter(this, void 0, void 0, function* () {
    let ssl;
    if (!_.isNil(ca) || !_.isNil(cert) || !_.isNil(key)) {
        ssl = {
            ca: ca,
            cert: cert,
            key: key,
            passphrase: passphrase,
            rejectUnauthorized: sf_helpers.toBooleanSafe(rejectUnauthorized),
        };
    }
    const ACCOUNTS = [];
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
    yield HOST.start();
    sf_helpers.write_ln(`Server now runs on port ${HOST.port} ...`);
}))();
//# sourceMappingURL=cli.js.map