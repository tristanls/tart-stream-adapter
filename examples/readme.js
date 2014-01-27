/*

readme.js - readme example script

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