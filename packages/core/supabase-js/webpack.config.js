const webpack = require('webpack')
const path = require('path')

module.exports = (env) => ({
  mode: env?.mode || 'production',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist/umd'),
    filename: 'supabase.js',
    library: {
      type: 'umd',
      name: 'supabase',
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
  plugins: [],
})
