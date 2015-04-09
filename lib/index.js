var _ = require('lodash');
var fs = require('fs');
var os = require('os');
var cluster = require('cluster');
var logger = require('log4js').getLogger('SATAN');

var Satan = function(defaultConfig, configFilePath) {
	this.workers = {};
	this.workerCount = 0;
	this.loadingCount = 0;
	this.targetWorkerCount = 0;
	this.defaultConfig = defaultConfig;
	this.configFile = {};
	this.configFilePath = configFilePath;

	this.sanitizeConfig(this.defaultConfig);
};

Satan.prototype.sanitizeConfig = function(config) {
	if (typeof config.arguments == 'string') {
		config.arguments = config.arguments.split(' ');
	}
};

Satan.prototype.refreshConfiguration = function() {
	if (this.configFilePath) {
		try {
			this.configFile = JSON.parse(fs.readFileSync(this.configFilePath));
			this.sanitizeConfig(this.configFile);
		} catch (e) {
			logger.error('Failed to read config file! Continuing anyway with previous configuration...');
			logger.error(e);
		}
	}

	this.config = _.defaults({
		arguments: (this.defaultConfig.arguments || []).concat(this.configFile.arguments || [])
	}, this.defaultConfig, this.configFile, {
		instances: 1,
		schedulingPolicy: 'rr',
		nodeArguments: process.execArgs
	});

	if (this.config.instances <= 0) {
		this.config.instances = os.cpus().length;
	}

	this.targetWorkerCount = this.config.instances;
};

Satan.prototype.prepare = function() {
	var self = this;

	switch (this.config.schedulingPolicy) {
		case 'rr':
			cluster.schedulingPolicy = cluster.SCHED_RR;
			break;
		case 'none':
			cluster.schedulingPolicy = cluster.SCHED_NODE;
			break;
		default:
			throw new Error("Invalid scheduling policy " + this.config.schedulingPolicy);
			break;
	}

	cluster.setupMaster({
		execArgs: this.config.nodeArguments,
		exec: this.config.script,
		args: this.config.arguments
	});

	process.on('SIGUSR2', function() {
		logger.debug('Caught SIGUSR2!');
		self.reload();
	});

	process.on('SIGINT', function() {
		logger.debug('Caught SIGINT!');
		self.terminate();
	});

	if (this.config.pidFile) {
		fs.writeFileSync(this.config.pidFile, process.pid);
	}
};

Satan.prototype.ensureWorkerCount = function() {
	var instanceDelta = function() {
		return this.targetWorkerCount - this.workerCount - this.loadingCount;
	}.bind(this);

	if (instanceDelta() > 0) {
		logger.info('Upscaling to %s worker(s).', this.targetWorkerCount);

		while (instanceDelta() > 0) {
			this.spawnWorker();
		}
	} else if (instanceDelta() < 0) {
		logger.info('Downscaling to %s worker(s).', this.targetWorkerCount);

		while (instanceDelta() < 0) {
			this.removeWorker(Object.keys[this.workers][0]);
		}
	} else {
		return;
	}

	// Ensures that the config is correct
	this.ensureWorkerCount();
};

Satan.prototype.start = function() {
	this.refreshConfiguration();
	this.prepare();
	this.ensureWorkerCount();
};

Satan.prototype.reload = function() {
	var oldWorkers = Object.keys(this.workers);

	logger.info('Reloading configuration...');
	this.refreshConfiguration();
	this.ensureWorkerCount();

	logger.info('Reloading all remaining workers...');
	for (var i = 0; i < oldWorkers.length; i++) {
		var worker = this.workers[oldWorkers[i]];
		// Check if worker still exists
		if (!worker || worker.satanState != 'online') {
			continue;
		}

		this.reloadWorker(oldWorkers[i]);
	}
};

Satan.prototype.spawnWorker = function(notify) {
	var self = this;
	var worker = cluster.fork();

	if (notify === undefined) {
		notify = true;
	}

	worker.once('disconnect', function() {
		delete self.workers[worker.id];

		if (!this.ignoreDisconnect) {
			logger.warn('Worker %s disconnected!', worker.id);
			self.workerCount--;

			// If we're the last worker and satan is terminating...
			if (self.workerCount == 0 && self.terminating) {
				// Kill the process
				process.exit(0);
			}
		}

		self.ensureWorkerCount();
	});

	if (notify) {
		this.loadingCount++;
	}

	worker.satanState = 'loading';

	this.workers[worker.id] = worker;

	worker.once('online', function() {
		worker.satanState = 'online';

		if (notify) {
			self.workerCount++;
			self.loadingCount--;
		}
	});

	logger.info('Spawned worker #%s...', worker.id);

	return worker;
};

Satan.prototype.reloadWorker = function(id) {
	var worker = this.workers[id];

	if (!worker) {
		return;
	}

	logger.info('Reloading worker #%s...', id);

	worker.satanState = 'reloading';

	var newWorker = this.spawnWorker(false);

	newWorker.once('listening', function() {
		worker.ignoreDisconnect = true;
		worker.send('shutdown');
	});

	return newWorker;
};

Satan.prototype.removeWorker = function(id) {
	var worker = this.workers[id];

	if (!worker) {
		return;
	}

	logger.info('Removing worker #%s...', id);

	this.workerCount--;

	worker.ignoreDisconnect = true;
	worker.satanState = 'unloading';
	worker.send('shutdown');
};

Satan.prototype.terminate = function() {
	var oldWorkers = Object.keys(this.workers);

	// Clear our target worker count as we are exiting
	this.targetWorkerCount = 0;

	// Make us know that we're terminating
	this.terminating = true;

	logger.info('Terminating all active workers...');
	for (var i = 0; i < oldWorkers.length; i++) {
		var worker = this.workers[oldWorkers[i]];
		// Check if worker still exists
		if (!worker || worker.satanState != 'online') {
			continue;
		}

		this.removeWorker(oldWorkers[i]);
	}
};

module.exports = Satan;

