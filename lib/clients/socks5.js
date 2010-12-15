var Put = require('put');
var Binary = require('binary');
var net = require('net');
var EventEmitter = require('events').EventEmitter;

module.exports = function () {
    var params = {};
    
    [].slice.call(arguments).forEach(function (arg) {
        if (typeof arg === 'string' && arg.match(/^\d+$/)) {
            params.port = parseInt(arg, 10);
        }
        else if (typeof arg === 'string') {
            params.host = arg;
        }
        else if (typeof arg === 'number') {
            params.port = arg;
        }
        else { // event emitter
            params.stream = arg;
        }
    });
    
    if (params.stream) {
        return fromStream(params.stream);
    }
    else {
        var stream = net.createConnection(params.port, params.host);
        return fromStream(stream);
    }
};

function fromStream (stream, cb) {
    var auth = null;
    var self = new EventEmitter;
    self.write = stream.write.bind(stream);
    
    self.auth = function (user, pass) {
        return self;
    };
    
    stream.on('end', function () { self.emit('end') });
    self.end = stream.end.bind(stream);
    self.destroy = stream.destroy.bind(stream);
    
    self.connect = function (addr, port) {
        if (stream.readyState === 'open' || stream.readyState === 'readOnly') {
            connect(addr, port);
        }
        else {
            stream.on('connect', function () {
                connect(addr, port);
            });
        }
        
        return self;
    };
    
    var methods = new Buffer([
        0x00, // no auth
    //    0x01, // gssapi
    //    0x02, // username / password
    ]);
    
    function connect (addr, port) {
        Binary(stream)
            .word8('ver')
            .word8('method')
            .tap(function (vars) {
                if (vars.method === 0xff) {
                    console.log('No supported methods');
                }
                else {
                    var dst = atype(addr);
                    Put()
                        .word8(5)
                        .word8(1) // connect
                        .pad(1) // reserved
                        .word8(dst.code)
                        .put(dst.buffer)
                        .word16be(port)
                        .write(stream)
                    ;
                    
                    self.emit('connect');
                    stream.on('data', self.emit.bind(self, 'data'));
                }
            })
        ;
    };
    
    Put()
        .word8(5) // socks v5
        .word8(methods.length)
        .put(methods)
        .write(stream)
    ;
    
    return self;
}

module.exports.atype = atype;
function atype (addr) {
    var ipv = process.binding('net').isIP(addr);
    
    if (ipv === 0) {
        var buf = new Buffer('x' + addr);
        buf[0] = buf.length - 1;
        return {
            code : 0x03,
            name : 'domain',
            buffer : buf,
        }
    }
    else if (ipv === 4) {
        return {
            code : 0x01,
            name : 'ipv4',
            buffer : new Buffer(addr.split('.')
                .map(function (n) { return parseInt(n, 10) })
            ),
        };
    }
    else if (ipv === 6) {
        return {
            code : 0x04,
            name : 'ipv6',
            buffer : addr.split(':').reduce(
                function (put, x) {
                    if (x === '') {
                        var zeros = 8 - addr.split(':').length + 1;
                        for (var i = 0; i < zeros; i++) put = put.word16be(0);
                        return put;
                    }
                    else return put.word16be(parseInt(x, 16))
                },
                Put()
            ).buffer(),
        };
    }
    else {
        throw new Error('IP version not supported');
    }
}
