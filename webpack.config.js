const path = require('path');
const glob = require('glob');

const visualizations = glob.sync('./src/visualizations/*/register.ts');

const loaders = {
  babel: 'babel-loader',
  ts: 'ts-loader',
  style: 'style-loader',
  css: 'css-loader'
}

module.exports = {
  entry: Object.fromEntries(visualizations.map(vis => {
    const name = path.basename(path.dirname(vis));
    return [name, vis];
  })),
  output: {
    filename: '[name].js',
    path: path.join(__dirname, 'docs'),
    clean: true
  },
  resolve: {
    extensions: ['.ts', '.js', '.css'],
    modules: [path.resolve(__dirname, 'src'), 'node_modules']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          loaders.babel,
          loaders.ts
        ]
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          loaders.babel
        ]
      },
      {
        test: /\.css$/,
        exclude: /node_modules/,
        use: [
          loaders.style,
          loaders.css
        ]
      }
    ]
  },
  devServer: {
    port: 4443,
    https: true,
    hot: false,
    inline: false,
    compress: true
  },
}