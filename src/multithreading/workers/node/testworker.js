/* Import */
const cp = require('child_process');
const path = require('path');

/* WebWorker */
class TestWorker {
	constructor(dataSet, cost) {
		this.worker = cp.fork(path.join(__dirname, '/worker'));

		this.worker.send({ set: dataSet, cost: cost.name });
	}

	evaluate(network) {
		/* eslint-disable no-unused-vars */
		return new Promise((resolve, reject) => {
			/* eslint-disable no-unused-vars */
			let serialized = network.serialize();

			let data = {
				activations: serialized[0],
				states: serialized[1],
				conns: serialized[2]
			};

			let _that = this.worker;
			this.worker.on('message', function callback(e) {
				_that.removeListener('message', callback);
				resolve(e);
			});

			this.worker.send(data);
		});
	}

	terminate() {
		this.worker.kill();
	}
}

/* Export */
module.exports = TestWorker;
