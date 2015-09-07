var _ = require('lodash');
var path = require('path');
var events = require('events');
var cluster = require('cluster');
var messaging = require('./messaging')

var runGarbageCollector = global.gc;
delete global.gc;

var messageHandlers = {
	boot: function(msg) {
		if (msg.workingDirectory) {
			process.chdir(msg.workingDirectory);
		}

		if (msg.arguments) {
			process.argv = process.argv.slice(0, 2).concat(msg.arguments);
		}

		process.title = 'satan-worker ' + msg.script + ' #' + cluster.worker.id;

		var script = path.resolve(msg.script);

		process.argv[1] = script;
		require(script);
	},
	gc: function(msg) {
		runGarbageCollector();
	},
	shutdown: function() {
		if (events.EventEmitter.listenerCount(process, 'shutdown')) {
			process.emit('shutdown');
		} else {
			process.once('disconnect', function() {
				process.exit(0);
			});

			cluster.worker.disconnect();
		}
	}
};

process.ready = function() {
	messaging.send(process, 'ready');
};

// Disable this terrible signal
process.on('SIGINT', function(){});

process.on('message', function(msg) {
	if (!msg || !_.isObject(msg)) {
		return;
	}

	// Check if this is a message from satan
	if (!msg.__satan) {
		return;
	}

	if (messageHandlers[msg.__type]) {
		messageHandlers[msg.__type](msg);
	}
});

