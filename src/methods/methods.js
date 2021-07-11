/* Export */
module.exports = methods;

const methods = {
	activation: require('./activation'),
	mutation: require('./mutation'),
	selection: require('./selection'),
	crossover: require('./crossover'),
	cost: require('./cost'),
	gating: require('./gating'),
	connection: require('./connection'),
	rate: require('./rate')
};
