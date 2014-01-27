/*

index.js - "tart-stream-adapter": Tart adapter for Node.js streams.

The MIT License (MIT)

Copyright (c) 2014 Dale Schumacher, Tristan Slominski

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

*/
"use strict";

var nodeStream = require('stream');

var streams = module.exports = {};

/*
  * `stream`: _Stream_ Node.js `Stream`.
  * `options`: _Object_ _(Default: {})_
    * `close`: _Function_ `function () {}` Actor to receive 'close' event.
    * `data`: _Function_ `function (message) {}` Actor to receive 'data' events.
      * `message.chunk` _Buffer|String_ Data from the stream.
      * `message.readSeq` _Integer_ Sequence number to read next.
    * `encoding`: _String_ The encoding to use for _Readable_, _Duplex_, or
        _Transform_ stream.
    * `end`: _Function_ `function () {}` Actor to receive 'end' event.
    * `fail`: _Function_ `function (error) {}` Actor to receive 'error' events.
    * `readable`: _Function_ `function (message) {}` Actor to receive 'readable'
        event notification.
      * `message.readSeq`: _Integer_ Sequence number to read next.
  * Return: _Object_ Capabilities wrapping the readable `stream`.
*/
streams.adaptReadable = function adaptReadable(stream, options) {
    options = options || {};
    // FIXME: implement readable.pipe()
    // FIXME: implement readable.unpipe()
    var readSeq = 0;

    // message = {ok()}
    var pauseBeh = function pauseBeh(message) {
        stream.pause();
        message && message.ok && message.ok();
    };

    // message = {readSeq, ok(), fail()}
    var readBeh = function readBeh(message) {
        var self = this.self;

        if (!message || message.readSeq === undefined) {
            return;
        }

        if (message.ok && message.readSeq == readSeq) {
            var chunk = stream.read(message.size);
            message.ok({chunk: chunk, next: self, readSeq: readSeq});
            // this sequence number has been consumed
            readSeq++;
        }

        // if the sequence number doesn't match our state, return failure
        // let the client figure it out if this ever happens
        if (message.fail && message.readSeq != readSeq) {
            message.fail(message.readSeq);
        }
    };

    // message = {ok()}
    var resumeBeh = function resumeBeh(message) {
        stream.resume();
        message && message.ok && message.ok();
    };

    // message = {chunk, ok()}
    var unshiftBeh = function unshiftBeh(message) {
        if (!message) {
            return;
        }

        if (message.chunk !== undefined) {
            stream.unshift(message.chunk);
            message.ok && message.ok();
        }
    };

    if (options.encoding) {
        stream.setEncoding(options.encoding);
    }

    if (options.readable instanceof Function) {
        stream.on('readable', function () {
            options.readable(readSeq);
        });
    }

    if (options.data instanceof Function) {
        stream.on('data', function (chunk) {
            options.data({chunk: chunk, readSeq: readSeq});
            // this sequence number has been consumed
            readSeq++;
        });
    }

    if (options.fail instanceof Function) {
        stream.on('error', function (error) {
            options.fail(error);
        });
    }

    if (options.end instanceof Function) {
        stream.on('end', function () {
            options.end();
        });
    }

    if (options.close instanceof Function) {
        stream.on('close', function () {
            options.close();
        });
    }

    return {
        pauseBeh: pauseBeh,
        readBeh: readBeh,
        resumeBeh: resumeBeh,
        unshiftBeh: unshiftBeh
    };
};

/*
  * `stream`: _Stream_ Node.js `Stream`.
  * `options`: _Object_ _(Default: {})_
    * `drain`: _Function_ `function () {}` Actor to receive 'drain' event.
    * `fail`: _Function_ `function (error) {}` Actor to receive 'error' events.
    * `finish`: _Function_ `function () {}` Actor to receive 'finish' event.
  * Return: _Object_ Capabilities wrapping the writable `stream`.
*/
streams.adaptWritable = function adaptWritable(stream, options) {
    options = options || {};

    var writeSeq = 0;
    var endMarker = {};
    var writeBuffer = [];

    // message = {chunk, encoding, writeSeq, ok(), wait()}
    var write = function write(message, next) {
        if (!message) {
            return;
        }

        if (message.writeSeq >= writeSeq) {
            writeBuffer[message.writeSeq - writeSeq] = message;
        }

        while (writeBuffer[0] != undefined) {
            var msg = writeBuffer.shift();
            var callback;
            var wait;
            if (msg.ok) {
                callback = function () {
                    var ok = msg.ok;
                    return function () {
                        ok(next);
                    };
                }(); // create closure
            }        

            if (msg.wait) {
                wait = function () {
                    var wait = msg.wait;
                    return function () {
                        wait(next);
                    };
                }(); // create closure
            }    

            if (msg !== endMarker) {
                var handled = stream.write(msg.chunk, msg.encoding, callback);
                if (!handled) {
                    wait();
                }
            } else {
                stream.end(msg.chunk, msg.encoding, callback);
            }

            writeSeq++;
        }
    };

    var endBeh = function endBeh(message) {

        // populate end marker instead of buffering the message
        // so that we can recognize when we are done
        endMarker.chunk = message.chunk;
        endMarker.encoding = message.encoding;
        endMarker.writeSeq = message.writeSeq;
        endMarker.ok = message.ok;

        write(endMarker, this.self);
    };

    var writeBeh = function writeBeh(message) {
        write(message, this.self);
    };

    if (options.drain instanceof Function) {
        stream.on('drain', function () {
            options.drain();
        });
    }

    if (options.fail instanceof Function) {
        stream.on('error', function (error) {
            options.fail();
        });
    }

    if (options.finish instanceof Function) {
        stream.on('finish', function () {
            options.finish();
        });
    }

    return {
        endBeh: endBeh,
        writeBeh: writeBeh
    };
};

/*
  * `stream`: _Stream_ Node.js `Stream`.
  * `options`: _Object_ _(Default: {})_
    * `close`: _Function_ `function () {}` Actor to receive 'close' event.
    * `data`: _Function_ `function (message) {}` Actor to receive 'data' events.
      * `message.chunk` _Buffer|String_ Data from the stream.
      * `message.readSeq` _Integer_ Sequence number to read next.
    * `drain`: _Function_ `function () {}` Actor to receive 'drain' event.
    * `encoding`: _String_ The encoding to use for _Readable_, _Duplex_, or
        _Transform_ stream.
    * `end`: _Function_ `function () {}` Actor to receive 'end' event.
    * `fail`: _Function_ `function (error) {}` Actor to receive 'error' events.
    * `finish`: _Function_ `function () {}` Actor to receive 'finish' event.
    * `readable`: _Function_ `function (message) {}` Actor to receive 'readable'
        event notification.
      * `message.readSeq`: _Integer_ Sequence number to read next.
  * Return: _Object_ Capabilities wrapping the `stream`.
*/
streams.adapt = function adapt(stream, options) {
    if (stream instanceof nodeStream.Transform
        || stream instanceof nodeStream.Duplex) {
        
        var readCapabilities = streams.adaptReadable(stream, options);
        var writeCapabilities = streams.adaptWritable(stream, options);
        var duplexCapabilities = {};
        Object.keys(readCapabilities).forEach(function (key) {
            duplexCapabilities[key] = readCapabilities[key];
        });
        Object.keys(writeCapabilities).forEach(function (key) {
            duplexCapabilities[key] = writeCapabilities[key];
        });
        return duplexCapabilities;
    }

    if (stream instanceof nodeStream.Readable) {
        return streams.adaptReadable(stream, options);
    }

    if (stream instanceof nodeStream.Writable) {
        return streams.adaptWritable(stream, options);
    }
};