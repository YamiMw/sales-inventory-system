/**
 * Webpack Renderer Config
 * Configures the production bundle for renderer assets.
 */

const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/renderer/js/app.js',
  target: 'electron-renderer',
  output: {
    path: path.resolve(__dirname, '../dist/renderer'),
    filename: 'app.js'
  }
};