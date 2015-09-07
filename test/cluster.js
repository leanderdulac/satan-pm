var path = require('path');
var Promise = require('bluebird');
var WorkerManager = require('../lib/worker-manager');

describe('Cluster', function() {
	describe('when spawning workers', function() {
		var satan;

		before(function() {
			satan = new WorkerManager({
				script: path.join(__dirname, 'fixtures/simple-server.js'),
				arguments: [],
				instances: 0,
				schedulingPolicy: 'rr'
			});

			return satan.run();
		});

		before(function() {
			return satan.updateTargetWorkerCount(2);
		});

		after(function() {
			return satan.terminate();
		});

		it('should have 2 workers', function() {
			expect(satan.workers).to.have.length(2);
		});

		it('each worker should have online as status', function() {
			expect(satan.workers).to.all.have.property('status', 'ready');
		});

		describe('when downscaling to 1 worker', function() {
			before(function() {
				return satan.updateTargetWorkerCount(2);
			});
		
			it('should have 1 workers', function() {
				expect(satan.workers).to.have.length(2);
			});

			it('each worker should have online as status', function() {
				expect(satan.workers).to.all.have.property('status', 'ready');
			});
		});

		describe('when upscaling to 4 worker', function() {
			before(function() {
				return satan.updateTargetWorkerCount(4);
			});
		
			it('should have 1 workers', function() {
				expect(satan.workers).to.have.length(4);
			});

			it('each worker should have online as status', function() {
				expect(satan.workers).to.all.have.property('status', 'ready');
			});
		});
	});

	describe('when reloading workers', function() {
		var satan, inCleanup = false;
		var reloadPromise, whosInDanger = [];

		before(function() {
			satan = new WorkerManager({
				script: path.join(__dirname, 'fixtures/stubborn-worker.js'),
				arguments: [],
				instances: 0,
				schedulingPolicy: 'rr'
			});

			satan.on('message', function(worker, msg) {
				if (msg == 'they are trying to kill me') {
					if (inCleanup) {
						worker.send('let it go');
					} else {
						whosInDanger.push(worker);
					}
				}
			});

			return satan.run();
		});

		before(function() {
			return satan.updateTargetWorkerCount(2)
			.then(function() {
				reloadPromise = satan.reload();

				return satan.when('ready');
			});
		});

		after(function() {
			inCleanup = true;

			return satan.terminate();
		});

		it('should have 3 workers', function() {
			expect(satan.workers).to.have.length(3);
		});

		it('each worker should have online as status', function() {
			expect(satan.workers).to.all.have.property('status', 'ready');
		});

		it('should have 1 worker with shutdown requested', function() {
			expect(whosInDanger).to.have.length(1);
		});

		describe('after reloading the first worker', function() {
			before(function() {
				whosInDanger[0].send('let it go');

				return Promise.join(whosInDanger[0].when('offline'), satan.when('ready'));
			});

			it('first worker should be offline', function() {
				expect(whosInDanger[0]).to.have.property('status', 'offline');
			});
			
			it('should have 3 workers', function() {
				expect(satan.workers).to.have.length(3);
			});

			it('each worker should have online as status', function() {
				expect(satan.workers).to.all.have.property('status', 'ready');
			});

			it('should have 2 worker with shutdown requested', function() {
				expect(whosInDanger).to.have.length(2);
			});
		});

		describe('after reloading all workers', function() {
			before(function() {
				whosInDanger[1].send('let it go');

				return reloadPromise;
			});

			it('second worker should be offline', function() {
				expect(whosInDanger[1]).to.have.property('status', 'offline');
			});
			
			it('should have 2 workers', function() {
				expect(satan.workers).to.have.length(2);
			});

			it('each worker should have online as status', function() {
				expect(satan.workers).to.all.have.property('status', 'ready');
			});

			it('should have 2 worker with shutdown requested', function() {
				expect(whosInDanger).to.have.length(2);
			});
		});
	});
});

