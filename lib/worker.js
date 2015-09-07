var _ = require('lodash');
var util = require('util');
var events = require('events');
var cluster = require('cluster');
var Promise = require('bluebird');
var messaging = require('./messaging');

var Worker = function(worker) {
	var self = this;

	events.EventEmitter.call(this);

	this.id = worker.id;
	this.worker = worker;
	this.status = 'forking';

	// Hook-up events
	worker.once('message', function(msg) {
		if (msg === 'online') {
			return self.markAs('ready');
		}

		if (!msg || !_.isObject(msg)) {
			return;
		}

		// Check if this is a message from a satan worker
		if (!msg.__satan) {
			return;
		}

		self.parse(msg);
	});

	worker.once('online', function() {
		self.markAs('online');
	});

	worker.once('listening', function() {
		self.markAs('ready');
	});

	worker.once('disconnect', function() {
		self.markAs('offline');
	});

	worker.once('exit', function() {
		self.markAs('offline');
	});

	// If the worker is already connected, force emit the online event
	if (worker.isConnected()) {
		process.nextTick(function() {
			self.markAs('online');
		});
	}
};

util.inherits(Worker, events.EventEmitter);

Worker.create = function() {
	return new Worker(cluster.fork());
};

Worker.prototype.send = function(type, msg) {
	return messaging.send(this.worker, type, msg);
};

Worker.prototype.parse = function(msg) {
	if (msg.type == 'ready') {
		this.markAs('ready');
	}
};

Worker.prototype.boot = function(opts) {
	this.send('boot', opts);

	return this.when('ready');
};

Worker.prototype.shutdown = function() {
	this.suicide = true;
	this.send('shutdown');

	return this.when('offline');
};

Worker.prototype.gc = function() {
	return this.send('gc');
};

Worker.prototype.kill = function(sig) {
	return this.worker.kill(sig);
};

Worker.prototype.when = function(event) {
	var self = this;

	return new Promise(function(resolve) {
		self.once(event, resolve);
	});
};

Worker.prototype.markAs = function(status) {
	if (this.status != status) {
		this.status = status;
		this.emit(status);
	}
};

module.exports = Worker;

