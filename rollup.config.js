import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export default {
  entry: 'index.js',
  format: 'umd',
  globals: {
    'd3-selection': 'd3'
  },
  plugins: [
    resolve({
      jsnext: true,
      skip: ['d3-selection']
    }),
    commonjs(),
    babel({
      presets: ['es2015-rollup']
    })
  ]
};
