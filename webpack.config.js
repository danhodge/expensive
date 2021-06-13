var webpack = require('webpack');
var path = require('path');
var fs = require('fs');

var CopyWebpackPlugin =  require('copy-webpack-plugin');

var nodeModules = {};
fs.readdirSync('node_modules')
  .filter(function(x) {
    return ['.bin'].indexOf(x) === -1;
  })
  .forEach(function(mod) {
    nodeModules[mod] = 'commonjs ' + mod;
  });

const serverConfig = {
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
  },
  plugins: [
    new webpack.BannerPlugin('require("source-map-support").install();'),
    new CopyWebpackPlugin({
      patterns: [
       { from: '../../views', to: 'views' },
      ]
    })
  ],
  devtool: 'source-map'
}

const clientConfig = {
  entry: [
    './index.js'
  ],
  target: 'web',
  mode: 'development',
  context: path.join(__dirname, 'src', 'client'),
  output: {
    path: path.join(__dirname, 'build', 'public'),
    filename: 'transactions.js'
  },
  module: {
    rules: [
      {
        test: /\.elm$/,
        exclude: [/elm-stuff/, /node_modules/],
        loader: "elm-webpack-loader",
        options: {
          debug: true,
          cwd: path.join(__dirname, 'src', 'client'),
        }
      }
    ]
  }
}

const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const tailwindConfig = {
  entry: [
    './public/css/style.css',
  ],
  target: 'web',
  mode: 'development',
  output: {
    path: path.join(__dirname, 'build', 'public', 'css'),
    filename: 'style.css'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          "css-loader", "postcss-loader"
        ]
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "styles.css",
      chunkFilename: "styles.css"
    })
  ]
};

module.exports = [serverConfig, clientConfig, tailwindConfig];
