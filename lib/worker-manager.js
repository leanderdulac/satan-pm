var _ = require('lodash');
var path = require('path');
var cluster = require('cluster');
var Promise = require('bluebird');
var Worker = require('./worker');

var logger = require('log4js').getLogger('WORKER-MANAGER');

var WorkerManager = function(settings) {
	this.targetWorkerCount = settings.instances;
	this.settings = settings;
	this.workers = [];
};

WorkerManager.prototype.run = function() {
	switch (this.settings.schedulingPolicy) {
		case 'rr':
			cluster.schedulingPolicy = cluster.SCHED_RR;
			break;
		case 'none':
			cluster.schedulingPolicy = cluster.SCHED_NODE;
			break;
		default:
			throw new Error("Invalid scheduling policy " + this.settings.schedulingPolicy);
			break;
	}

	cluster.setupMaster({
		exec: path.join(__dirname, 'worker-container.js'),
		args: []
	});

	this.refresh();
};

WorkerManager.prototype.updateTargetWorkerCount = function(count) {
	this.targetWorkerCount = count;

	return this.refresh();
};

WorkerManager.prototype.refresh = function() {
	var self = this;

	var computeInstanceDelta = function() {
		return self.targetWorkerCount - self.workers.length;
	};

	if (computeInstanceDelta() > 0) {
		logger.info('Upscaling to %s worker(s).', this.targetWorkerCount);

		var workers = _.times(computeInstanceDelta(), this.spawn, this);

		return Promise.map(workers, function(worker) {
			return worker.when('ready');
		});
	} else if (computeInstanceDelta() < 0) {
		logger.info('Downscaling to %s worker(s).', this.targetWorkerCount);

		var workers = this.workers.slice(0, computeInstanceDelta() * -1);

		return Promise.map(workers, function(worker) {
			return worker.shutdown();
		});
	}
};

WorkerManager.prototype.each = function(callback, opts) {
	// This function creates a snapshot of the current worker set
	// so we don't fuck up if the callback modifies them
	return Promise.each(_.clone(this.workers), callback, opts);
};

WorkerManager.prototype.gc = function() {
	return this.each(function(worker) {
		return worker.gc();
	});
};

WorkerManager.prototype.reload = function() {
	var self = this;

	return this.each(function(worker) {
		var newWorker = self.spawn();

		logger.info('Reloading worker #%s...', worker.id);

		return newWorker.when('ready')
		.then(function() {
			// Once the new worker is ready, shutdown the old one
			return worker.shutdown();
		});
	}, { concurrency: 1 });
};

WorkerManager.prototype.terminate = function() {
	return this.updateTargetWorkerCount(0);
};

WorkerManager.prototype.kill = function(sig) {
	return this.each(function(worker) {
		return worker.kill(sig);
	});
};

WorkerManager.prototype.spawn = function() {
	var self = this;
	var worker = Worker.create();

	this.workers.push(worker);

	worker.once('offline', function() {
		_.remove(self.workers, { id: worker.id });

		if (!worker.suicide) {
			self.refresh();
		}
	});

	worker.once('online', function() {
		worker.boot({
			script: self.settings.script,
			arguments: self.settings.arguments,
			workingDirectory: self.settings.workingDirectory
		});
	});

	return worker;
};

module.exports = WorkerManager;

