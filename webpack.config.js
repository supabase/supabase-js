const path = require('path');

module.exports = {
  mode: 'production',
  entry: './lib/index.js',
  output: {
    path: path.resolve(__dirname, 'lib'),
    filename: 'supabase.js',
    library: 'Supabase',
    libraryTarget: 'var'
  },
};