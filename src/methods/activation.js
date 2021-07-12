/**
 * Define Activation Functions
 * See: https://en.wikipedia.org/wiki/Activation_function
 * Also: https://stats.stackexchange.com/questions/115258/comprehensive-list-of-activation-functions-in-neural-networks-with-pros-cons
 */
const activation = {
	/* LOGISTIC activation */
	LOGISTIC: (x, derivate) => {
		let fx = 1 / (1 + Math.exp(-x));
		if (!derivate) return fx;
		return fx * (1 - fx);
	},

	/* TANH activation */
	TANH: (x, derivate) => {
		if (derivate) return 1 - Math.pow(Math.tanh(x), 2);
		return Math.tanh(x);
	},

	/* IDENTITY activation */
	IDENTITY: (x, derivate) => {
		return derivate ? 1 : x;
	},

	/* STEP activation */
	STEP: (x, derivate) => {
		return derivate ? 0 : x > 0 ? 1 : 0;
	},

	/* RELU activation */
	RELU: (x, derivate) => {
		if (derivate) return x > 0 ? 1 : 0;
		return x > 0 ? x : 0;
	},

	/* SOFTSIGN activation */
	SOFTSIGN: (x, derivate) => {
		let d = 1 + Math.abs(x);
		if (derivate) return x / Math.pow(d, 2);
		return x / d;
	},

	/* SINUSOID activation */
	SINUSOID: (x, derivate) => {
		if (derivate) return Math.cos(x);
		return Math.sin(x);
	},

	/* GAUSSIAN activation */
	GAUSSIAN: (x, derivate) => {
		let d = Math.exp(-Math.pow(x, 2));
		if (derivate) return -2 * x * d;
		return d;
	},

	/* BENT_IDENTITY activation */
	BENT_IDENTITY: (x, derivate) => {
		let d = Math.sqrt(Math.pow(x, 2) + 1);
		if (derivate) return x / (2 * d) + 1;
		return (d - 1) / 2 + x;
	},

	/* BIPOLAR activation */
	BIPOLAR: (x, derivate) => {
		return derivate ? 0 : x > 0 ? 1 : -1;
	},

	/* BIPOLAR_SIGMOID activation */
	BIPOLAR_SIGMOID: (x, derivate) => {
		let d = 2 / (1 + Math.exp(-x)) - 1;
		if (derivate) return (1 / 2) * (1 + d) * (1 - d);
		return d;
	},

	/* HARD_TANH activation */
	HARD_TANH: (x, derivate) => {
		if (derivate) return x > -1 && x < 1 ? 1 : 0;
		return Math.max(-1, Math.min(1, x));
	},

	/* ABSOLUTE activation */
	ABSOLUTE: (x, derivate) => {
		if (derivate) return x < 0 ? -1 : 1;
		return Math.abs(x);
	},

	/* INVERSE activation */
	INVERSE: (x, derivate) => {
		if (derivate) return -1;
		return 1 - x;
	},

	/**
	 * SELU activation
	 * See: https://arxiv.org/pdf/1706.02515.pdf
	 */
	SELU: (x, derivate) => {
		var alpha = 1.6732632423543772848170429916717;
		var scale = 1.0507009873554804934193349852946;
		var fx = x > 0 ? x : alpha * Math.exp(x) - alpha;
		if (derivate) {
			return x > 0 ? scale : (fx + alpha) * scale;
		}
		return fx * scale;
	}
};

/* Export */
module.exports = activation;
