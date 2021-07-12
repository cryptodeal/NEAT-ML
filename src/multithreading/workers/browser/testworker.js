/* Import */
const multi = require('../../multi');

/* WebWorker */
class TestWorker {
	constructor(dataSet, cost) {
		let blob = new Blob([this.#createBlobString(cost)]);
		this.url = window.URL.createObjectURL(blob);
		this.worker = new Worker(this.url);

		let data = { set: new Float64Array(dataSet).buffer };
		this.worker.postMessage(data, [data.set]);
	}

	evaluate(network) {
		/* eslint-disable no-unused-vars */
		return new Promise((resolve, reject) => {
			/* eslint-enable no-unused-vars */
			let serialized = network.serialize();

			let data = {
				activations: new Float64Array(serialized[0]).buffer,
				states: new Float64Array(serialized[1]).buffer,
				conns: new Float64Array(serialized[2]).buffer
			};

			this.worker.onmessage = function (e) {
				let error = new Float64Array(e.data.buffer)[0];
				resolve(error);
			};

			this.worker.postMessage(data, [data.activations, data.states, data.conns]);
		});
	}

	terminate() {
		this.worker.terminate();
		window.URL.revokeObjectURL(this.url);
	}

	#createBlobString(cost) {
		var source = `
      var F = [${multi.activations.toString()}];
      var cost = ${cost.toString()};
      var multi = {
        deserializeDataSet: ${multi.deserializeDataSet.toString()},
        testSerializedSet: ${multi.testSerializedSet.toString()},
        activateSerializedNetwork: ${multi.activateSerializedNetwork.toString()}
      };
      this.onmessage = function (e) {
        if(typeof e.data.set === 'undefined'){
          var A = new Float64Array(e.data.activations);
          var S = new Float64Array(e.data.states);
          var data = new Float64Array(e.data.conns);
          var error = multi.testSerializedSet(set, cost, A, S, data, F);
          var answer = { buffer: new Float64Array([error ]).buffer };
          postMessage(answer, [answer.buffer]);
        } else {
          set = multi.deserializeDataSet(new Float64Array(e.data.set));
        }
      };`;

		return source;
	}
}

/* Export */
module.exports = TestWorker;
