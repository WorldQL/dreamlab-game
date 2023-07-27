import { defineConfig } from 'tsup'

export default defineConfig(options => ({
  entry: ['./src/index.ts'],
  target: 'es2021',
  format: 'esm',
  platform: 'node',
  clean: true,
  minify: !options.watch,
  sourcemap: true,
}))
