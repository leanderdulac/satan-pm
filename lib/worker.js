var Worker = function(clusterWorker) {
	this.worker = clusterWorker;
	this.id = clusterWorker.id;
};

module.exports = Worker;

