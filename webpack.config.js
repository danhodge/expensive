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

  module.exports = {
    entry: './main.ts',
    mode: 'development',
    context: path.join(__dirname, 'src', 'server'),
    target: 'node',
    output: {
      path: path.join(__dirname, 'build'),
      filename: 'main.js'
    },
    externals: nodeModules,
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [
            'ts-loader'
         ]
        }
      ]
    }
 }
