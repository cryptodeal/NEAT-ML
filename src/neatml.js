const NeatML = {
	Network: require('./architecture/network'),
	methods: require('./methods/methods'),
	Connection: require('./architecture/connection'),
	architect: require('./architecture/architect'),
	config: require('./config'),
	Group: require('./architecture/group'),
	Layer: require('./architecture/layer'),
	Node: require('./architecture/node'),
	Neat: require('./neat'),
	multi: require('./multithreading/multi')
};

/* CommonJS & AMD */
/* eslint-disable no-undef */
if (typeof define !== 'undefined' && define.amd) {
	define([], function () {
		return NeatML;
	});
}
/* eslint-enable no-undef */

/* Node.js */
if (typeof module !== 'undefined' && module.exports) {
	module.exports = NeatML;
}

/* Browser */
if (typeof window === 'object') {
	(function () {
		var old = window['neatml'];
		NeatML.ninja = function () {
			window['neatml'] = old;
			return NeatML;
		};
	})();

	window['neatml'] = NeatML;
}
