const path = require('path');

module.exports = {
  mode: 'production',
  entry: './umd_temp/index.js',
  output: {
    path: path.resolve(__dirname, 'lib/umd'),
    filename: 'supabase.js',
    library: 'Supabase',
    libraryTarget: 'var'
  },
};