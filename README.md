# tart-stream-adapter

_Stability: 1 - [Experimental](https://github.com/tristanls/stability-index#stability-1---experimental)_

[![NPM version](https://badge.fury.io/js/tart-stream-adapter.png)](http://npmjs.org/package/tart-stream-adapter)

[Tiny Actor Run-Time in JavaScript](https://github.com/organix/tartjs) adapter for Node.js streams.

## Contributors

[@dalnefre](https://github.com/dalnefre), [@tristanls](https://github.com/tristanls)

## Overview

[Tiny Actor Run-Time in JavaScript](https://github.com/organix/tartjs) adapter for Node.js streams.

  * [Usage](#usage)
  * [Tests](#tests)
  * [Documentation](#documentation)
  * [Sources](#sources)

## Usage

To run the below example run:

    npm run readme

```javascript
"use strict";

var fs = require('fs');
var path = require('path');
var stream = require('stream');
var streams = require('../index.js');
var tart = require('tart');

var sponsor = tart.minimal();

var reader = fs.createReadStream(
    path.normalize(path.join(__dirname, 'files', 'readFromMe.txt')));

var readData = sponsor(function data(message) {
    console.log('==1', 'readSeq', message.readSeq)
    console.log(message.chunk);
});
var readEnd = sponsor(function end() {
    console.log('==1', 'done reading');
});

var readCapabilities = streams.adapt(reader, {
    data: readData, 
    end: readEnd,
    encoding: 'utf8'
});

var reader2 = fs.createReadStream(
    path.normalize(path.join(__dirname, 'files', 'readFromMe.txt')));

var readEnd2 = sponsor(function end2() {
    console.log('=2=', 'done reading');
});

var printer = sponsor(function printer(message) {
    if (message.chunk != null) {
        var readSeq = message.readSeq;
        console.log('=2=', 'readSeq', readSeq);
        console.log(message.chunk.toString('utf8'));
        // read from next (32 byte) chunk
        message.next({readSeq: ++readSeq, size: 32, ok: this.self});
    } else {
        console.log('=2=', 'readSeq', message.readSeq);
        console.log('~null chunk~');
        // wait for readable to be triggered again, or end to be emitted
    }
});

var read;

var readable = sponsor(function readable(readSeq) {
     // stream is readable, read to printer (in 32 byte chunks)
    read({readSeq: readSeq, size: 32, ok: printer});
});

var readCapabilities = streams.adapt(reader2, {
    end: readEnd2,
    readable: readable
});
read = sponsor(readCapabilities.readBeh);

// delete files/writtenTo.txt before writing
var writeFileName = path.normalize(path.join(__dirname, 'files', 'writtenTo.txt'));
if (fs.existsSync(writeFileName)) {
    fs.unlinkSync(writeFileName);
}

var writer = fs.createWriteStream(writeFileName);

var writeCapabilities = streams.adapt(writer);
var write = sponsor(writeCapabilities.writeBeh);
var writeEnd = sponsor(writeCapabilities.endBeh);

var writeFinished = sponsor(function writeFinished() {
    console.log('3==', 'write finished, look in "examples/writtenTo.txt"');
});

writeEnd({chunk: 'finished', encoding: 'utf8', writeSeq: 10, ok: writeFinished})
write({chunk: 'zeroth\n', encoding: 'utf8', writeSeq: 0});
write({chunk: 'sixth\n', encoding: 'utf8', writeSeq: 6});
write({chunk: 'first\n', encoding: 'utf8', writeSeq: 1});
write({chunk: 'third\n', encoding: 'utf8', writeSeq: 3});
write({chunk: 'eight\n', encoding: 'utf8', writeSeq: 8});
write({chunk: 'fourth\n', encoding: 'utf8', writeSeq: 4});
write({chunk: 'second\n', encoding: 'utf8', writeSeq: 2});
write({chunk: 'ninth\n', encoding: 'utf8', writeSeq: 9});
write({chunk: 'seventh\n', encoding: 'utf8', writeSeq: 7});
write({chunk: 'fifth\n', encoding: 'utf8', writeSeq: 5});
```

## Tests

    npm test

## Documentation

**Public API**

  * [streams.adapt(stream, options)](#streamsadaptstream-options)
  * [streams.adaptReadable(stream, options)](#streamsadaptreadablestream-options)
  * [streams.adaptWritable(stream, options)](#streamsadaptwritablestream-options)

### streams.adapt(stream, options)

  * `stream`: _Stream_ Node.js `Stream`.
  * `options`: _Object_ _(Default: {})_
    * `close`: _Function_ `function () {}` Actor to receive 'close' event.
    * `data`: _Function_ `function (message) {}` Actor to receive 'data' events.
      * `message.chunk` _Buffer|String_ Data from the stream.
      * `message.readSeq` _Integer_ Sequence number to read next.
    * `drain`: _Function_ `function () {}` Actor to receive 'drain' event.
    * `encoding`: _String_ The encoding to use for _Readable_, _Duplex_, or _Transform_ stream.
    * `end`: _Function_ `function () {}` Actor to receive 'end' event.
    * `fail`: _Function_ `function (error) {}` Actor to receive 'error' events.
    * `finish`: _Function_ `function () {}` Actor to receive 'finish' event.
    * `readable`: _Function_ `function (message) {}` Actor to receive 'readable' event notification.
      * `message.readSeq`: _Integer_ Sequence number to read next.
  * Return: _Object_ Capabilities wrapping the `stream`.

Adapts the `stream` to Tart. Returned Capabilities are:

  * `endBeh`: _Function_ `function (message) {}` End capability.
  * `pauseBeh`: _Function_ `function (message) {}` Pause capability.
  * `readBeh`: _Function_ `function (message) {}` Read capability.
  * `resumeBeh`: _Function_ `function (message) {}` Resume capability.
  * `unshiftBeh`: _Function_ `function (message) {}` Unshift capability.
  * `writeBeh`: _Function_ `function (message) {}` Write capability.

### streams.adaptReadable(stream, options)

  * `stream`: _Stream_ Node.js `Stream`.
  * `options`: _Object_ _(Default: {})_
    * `close`: _Function_ `function () {}` Actor to receive 'close' event.
    * `data`: _Function_ `function (message) {}` Actor to receive 'data' events.
      * `message.chunk` _Buffer|String_ Data from the stream.
      * `message.readSeq` _Integer_ Sequence number to read next.
    * `encoding`: _String_ The encoding to use for _Readable_, _Duplex_, or _Transform_ stream.
    * `end`: _Function_ `function () {}` Actor to receive 'end' event.
    * `fail`: _Function_ `function (error) {}` Actor to receive 'error' events.
    * `readable`: _Function_ `function (message) {}` Actor to receive 'readable' event notification.
      * `message.readSeq`: _Integer_ Sequence number to read next.
  * Return: _Object_ Capabilities wrapping the readable `stream`.

Adapts a readable `stream`. Returned Capabilities are:

  * `pauseBeh`: _Function_ `function (message) {}` Pause capability.
  * `readBeh`: _Function_ `function (message) {}` Read capability.
  * `resumeBeh`: _Function_ `function (message) {}` Resume capability.
  * `unshiftBeh`: _Function_ `function (message) {}` Unshift capability.

### streams.adaptWritable(stream, options)

  * `stream`: _Stream_ Node.js `Stream`.
  * `options`: _Object_ _(Default: {})_
    * `drain`: _Function_ `function () {}` Actor to receive 'drain' event.
    * `fail`: _Function_ `function (error) {}` Actor to receive 'error' events.
    * `finish`: _Function_ `function () {}` Actor to receive 'finish' event.
  * Return: _Object_ Capabilities wrapping the writable `stream`.

Adapts the writable `stream` to Tart. Returned Capabilities are:

  * `endBeh`: _Function_ `function (message) {}` End capability.
  * `writeBeh`: _Function_ `function (message) {}` Write capability.

## Sources

  * [Tiny Actor Run-Time (JavaScript)](https://github.com/organix/tartjs)
