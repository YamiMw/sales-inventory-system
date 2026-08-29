/**
 * Webpack Main Config
 * Configures the production bundle for the Electron main process.
 */

const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/main/main.js',
  target: 'electron-main',
  output: {
    path: path.resolve(__dirname, '../dist/main'),
    filename: 'main.js'
  },
  node: {
    __dirname: false,
    __filename: false
  },
  externals: {
    'better-sqlite3': 'commonjs better-sqlite3',
    'knex': 'commonjs knex'
  }
};
