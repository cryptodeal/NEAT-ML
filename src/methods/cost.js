/* Export */
module.exports = cost;

/**
 * Define Cost (Loss) Functions
 * See: https://en.wikipedia.org/wiki/Loss_function
 */
const cost = {
	/* Cross entropy error */
	CROSS_ENTROPY: (target, output) => {
		let error = 0;
		for (let i = 0; i < output.length; i++) {
			/* Avoid negative and zero numbers, use 1e-15 http://bit.ly/2p5W29A */
			error -=
				target[i] * Math.log(Math.max(output[i], 1e-15)) +
				(1 - target[i]) * Math.log(1 - Math.max(output[i], 1e-15));
		}
		return error / output.length;
	},

	/* Mean Squared Error */
	MSE: (target, output) => {
		let error = 0;
		for (let i = 0; i < output.length; i++) {
			error += Math.pow(target[i] - output[i], 2);
		}

		return error / output.length;
	},

	/* Binary error */
	BINARY: (target, output) => {
		let misses = 0;
		for (let i = 0; i < output.length; i++) {
			misses += Math.round(target[i] * 2) !== Math.round(output[i] * 2);
		}

		return misses;
	},

	/* Mean Absolute Error */
	MAE: (target, output) => {
		let error = 0;
		for (let i = 0; i < output.length; i++) {
			error += Math.abs(target[i] - output[i]);
		}

		return error / output.length;
	},

	/* Mean Absolute Percentage Error */
	MAPE: (target, output) => {
		let error = 0;
		for (let i = 0; i < output.length; i++) {
			error += Math.abs((output[i] - target[i]) / Math.max(target[i], 1e-15));
		}

		return error / output.length;
	},

	/* Mean Squared Logarithmic Error */
	MSLE: (target, output) => {
		let error = 0;
		for (let i = 0; i < output.length; i++) {
			error += Math.log(Math.max(target[i], 1e-15)) - Math.log(Math.max(output[i], 1e-15));
		}

		return error;
	},

	/* Hinge loss, for classifiers */
	HINGE: (target, output) => {
		let error = 0;
		for (let i = 0; i < output.length; i++) {
			error += Math.max(0, 1 - target[i] * output[i]);
		}

		return error;
	}
};
