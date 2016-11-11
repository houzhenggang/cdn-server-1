var webpack = require('webpack');
var path = require('path');
var fs = require('fs');

var nodeModules = {};
fs.readdirSync('node_modules')
    .filter(function(x) {
        return ['.bin'].indexOf(x) === -1;
    })
    .forEach(function(mod) {
        nodeModules[mod] = 'commonjs ' + mod;
    });

//nodeModules['iconv'] = 'commonjs iconv';

module.exports = {

    entry:  {
        'cache-server': './src/cacheServer.ts'
    } ,
    externals: nodeModules,
    target: 'node',
    node: {
        __filename: false,
        __dirname: false
    },
    output: {
        path: path.join(__dirname, "dist"),
        filename: "[name].js",
        library: 'cdn-server',
        libraryTarget: 'commonjs2'
    },
    resolve: {
        extensions: ['', '.webpack.js', '.ts']
    },
    devtool: 'inline-source-map',
    plugins: [
        //new webpack.optimize.UglifyJsPlugin({ minimize: true })
    ],
    module: {
        loaders: [
            {
                test: /\.ts$/,
                loader: 'ts-loader'
            }
        ]
    }
};