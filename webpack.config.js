/* Import */
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

/* Update readme and read license */
var version = require('./package.json').version;
var readme = fs
	.readFileSync('./README.md', 'utf-8')
	.replace(/cdn\/(.*)\/neatml.js/, `cdn/${version}/neatml.js`);
fs.writeFileSync('./README.md', readme);

var license = fs.readFileSync('./LICENSE', 'utf-8');

/* Export config */
module.exports = {
	mode: 'production',
	context: __dirname,
	entry: {
		'dist/neatml': './src/neatml.js',
		[`mkdocs/theme/cdn/${version}/neatml`]: './src/neatml.js'
	},
	resolve: {
		modules: [path.join(__dirname, 'node_modules')],
		fallback: {
			assert: require.resolve('assert'),
			util: require.resolve('util'),
			console: require.resolve('console-browserify'),
			path: require.resolve('path-browserify')
		}
	},
	output: {
		path: __dirname,
		filename: '[name].js',
		library: 'NEAT-ML',
		libraryTarget: 'umd',
		globalObject: 'this'
	},
	plugins: [
		new webpack.BannerPlugin(license),
		new CopyWebpackPlugin({
			patterns: [{ from: 'src/multithreading/workers/node/worker.js', to: 'dist' }]
		})
	],
	externals: ['child_process', 'os'],
	node: {
		__dirname: false
	}
};
