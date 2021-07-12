/**
 * RATE
 * See: https://stackoverflow.com/questions/30033096/what-is-lr-policy-in-caffe/30045244
 */
const rate = {
	FIXED: () => {
		/* eslint-disable no-unused-vars */
		const func = (baseRate, iteration) => {
			return baseRate;
		};
		/* eslint-enable no-unused-vars */

		return func;
	},

	STEP: (gamma, stepSize) => {
		gamma = gamma || 0.9;
		stepSize = stepSize || 100;

		const func = (baseRate, iteration) => {
			return baseRate * Math.pow(gamma, Math.floor(iteration / stepSize));
		};

		return func;
	},

	EXP: (gamma) => {
		gamma = gamma || 0.999;

		var func = (baseRate, iteration) => {
			return baseRate * Math.pow(gamma, iteration);
		};

		return func;
	},

	INV: (gamma, power) => {
		gamma = gamma || 0.001;
		power = power || 2;

		const func = (baseRate, iteration) => {
			return baseRate * Math.pow(1 + gamma * iteration, -power);
		};

		return func;
	}
};

/* Export */
module.exports = rate;
