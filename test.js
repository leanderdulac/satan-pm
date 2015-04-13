var http = require('http');
var requiem = require('cluster-requiem');
requiem.initialize();
var server = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
}).listen(1339, '127.0.0.1');
requiem.trackSocket(server);
console.log('Server running at http://127.0.0.1:1337/');
