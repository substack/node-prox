var socks5 = require('prox').socks5;

exports.socks5 = function (assert) {
    var port = Math.floor(10000 + Math.random() * (Math.pow(2,16) - 10000));
    var tc = setTimeout(function () {
        assert.fail('Never connected');
    }, 500);
    
    var td = setTimeout(function () {
        assert.fail('Never got data');
    }, 500);
    
    var to = setTimeout(function () {
        assert.fail('Never ended');
    }, 500);
     
    var server = socks5.createServer(function (req, res) {
        assert.eql(req.host, 'moo');
        assert.eql(req.port, 8080);
        res.write(new Buffer('oh hello '));
        res.on('data', function (buf) {
            res.write(buf);
            res.end();
        });
    });
    server.listen(port, ready);
    
    function ready () {
        var stream = socks5
            .createConnection('localhost', port)
            .connect('moo', 8080)
        ;
        
        stream.on('connect', function () {
            clearTimeout(tc);
            stream.write(new Buffer('pow!'));
        });
        
        stream.on('data', function (buf) {
            clearTimeout(td);
            assert.eql(buf.toString(), 'oh hello pow!');
            stream.end();
        });
        
        stream.on('end', function () {
            clearTimeout(to);
            server.close();
        });
    }
};
