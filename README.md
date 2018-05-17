# node-share-folder

API and CLI application to run a REST host for sharing files and folders, written for [Node.js 7+](https://nodejs.org).

## Install

### As command line tool

```bash
npm install -g share-folder
```

### As module

```bash
npm install --save share-folder
```

## Usage

### Command line

Share current folder:

```bash
share-folder
```

Share custom folder:

```bash
share-folder /path/to/folder/to/share
```

Run in SSL mode:

```bash
share-folder --cert=/path/to/ca/file --key=/path/to/key/file
```

Define username and password:

```bash
share-folder --user=mkloubert --password=P@ssword123!
```

Upload a file:

```bash
share-folder --upload /path/to/file/on/remote.txt < ./file-to-upload.txt
```

Download a file:

```bash
share-folder --download /path/to/file/on/remote.txt > ./downloaded-file.txt
```

Remove a file or folder:

```bash
share-folder --delete /path/to/file/or/folder/on/remote
```

### Module

#### Run host

```typescript
import { ShareFolderHost } from 'share-folder';

const HOST = new ShareFolderHost({
    port: 44444,  // default: 55555
    root: '/path/to/root/folder',
});

await HOST.start();
```

#### Use client

```typescript
import * as fs from 'from';
import { ShareFolderClient } from 'share-folder';

const CLIENT = new ShareFolderClient({
    host: 'example.com',
    port: 44444,
});

// list directory
const LIST = await CLIENT.list('/path/to/directory/on/remote');
for (const ITEM of LIST) {
    // TODO
}

// upload a file
await CLIENT.upload('/path/to/file/on/remote.txt',
                    fs.readFileSync('/path/of/file/to/upload'));

// download file
fs.writeFileSync(
    '/path/to/downloaded/file.txt',
    await CLIENT.download('/path/to/file/on/remote.txt')
);

// delete file or folder
await CLIENT.remove('/path/to/file/or/folder/on/remote');
```

## API

### [DELETE] /path/to/file/or/folder/to/delete

Deletes a file or folder.

Example:

```http
DELETE /my-file-or-folder
```

Possible respose:

```http
HTTP/1.1 200 OK
Connection: close
Content-Length: 114
Content-Type: application/json; charset=utf8
Date: Tue, 15 May 2018 19:25:19 GMT
ETag: W/"72-oPrCQJagCLUSh2PmGv+W7S+xo4M"
X-Powered-By: node-share-folder (Express)
X-Tm-Mk: 1979-09-05T23:09:00.000Z

{
  "ctime": "2018-05-15T19:11:17.082Z",
  "mtime": "2018-05-15T19:11:17.082Z",
  "name": "my-file-or-folder",
  "size": 0,
  "type": "d"
}
```

### [GET] /path/to/file/or/folder

#### List a directory

Example:

```http
GET /
```

Possible respose:

```http
HTTP/1.1 200 OK
Connection: close
Content-Length: 218
Content-Type: application/json; charset=utf8
Date: Tue, 15 May 2018 17:20:59 GMT
ETag: W/"da-sIP9lRV14VgW0g/mFthDumv5hqE"
X-Powered-By: node-share-folder (Express)
X-Share-Folder-Type: d
X-Tm-Mk: 1979-09-05T23:09:00.000Z

[
  {
    "ctime": "2018-05-15T03:20:43.536Z",
    "mtime": "2018-05-15T03:20:43.536Z",
    "name": "test-folder",
    "size": 0,
    "type": "d"
  },
  {
    "ctime": "2018-05-15T17:13:40.979Z",
    "mtime": "2018-05-15T17:13:40.979Z",
    "name": "test-file.txt",
    "size": 22,
    "type": "f"
  }
]
```

#### Get content of a file

Example:

```http
GET /test-file.txt
```

Possible respose:

```http
HTTP/1.1 200 OK
Connection: close
Content-Length: 1706
Content-Type: text/plain
Date: Tue, 15 May 2018 17:22:38 GMT
ETag: W/"16-MKQSnrz7Udk6d5pTlq5C66K847M"
X-Powered-By: node-share-folder (Express)
X-Share-Folder-Type: f
X-Tm-Mk: 1979-09-05T23:09:00.000Z

Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. 

Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi. Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. 

Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat. Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi. 
```

#### Get info of a file or folder

```http
GET /test-file.txt?info=1
```

Possible response:

```http
HTTP/1.1 200 OK
Connection: close
Content-Length: 112
Content-Type: application/json; charset=utf8
Date: Tue, 15 May 2018 17:38:37 GMT
ETag: W/"70-z+vwPpHUvk692rkWEZzIZHAhJU4"
X-Powered-By: node-share-folder (Express)
X-Tm-Mk: 1979-09-05T23:09:00.000Z

{
  "ctime": "2018-05-15T17:24:07.094Z",
  "mtime": "2018-05-15T17:24:07.094Z",
  "name": "test.txt",
  "size": 1706,
  "type": "f"
}
```

### [POST] /path/to/folder/to/create

Creates a new directory.

```http
POST /my-new-folder
```

Possible response:

```http
HTTP/1.1 200 OK
Connection: close
Content-Length: 101
Content-Type: application/json; charset=utf8
Date: Tue, 15 May 2018 19:11:17 GMT
ETag: W/"65-A0B7XUVLv2NMnQ0vYHwV2lBVbgo"
X-Powered-By: node-share-folder (Express)
X-Tm-Mk: 1979-09-05T23:09:00.000Z

{
  "ctime": "2018-05-15T19:11:17.082Z",
  "mtime": "2018-05-15T19:11:17.082Z",
  "name": "my-new-folder",
  "size": 0,
  "type": "d"
}
```

### [PUT] /path/to/file

Writes to a file.

```http
PUT /my-file

Lorem ispum
```

Possible response:

```http
HTTP/1.1 200 OK
Connection: close
Content-Length: 102
Content-Type: application/json; charset=utf8
Date: Tue, 15 May 2018 19:14:11 GMT
ETag: W/"66-b5W/DNIHdZfEUzg6h+WRj/oDsVA"
X-Powered-By: node-share-folder (Express)
X-Tm-Mk: 1979-09-05T23:09:00.000Z

{
  "ctime": "2018-05-15T19:14:11.079Z",
  "mtime": "2018-05-15T19:14:11.079Z",
  "name": "my-file",
  "size": 11,
  "type": "f"
}
```
