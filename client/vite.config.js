import { defineConfig } from 'vite'

/** @returns {import('vite').Plugin} */
const importMapPlugin = () => ({
  name: 'import-map',
  transformIndexHtml: () => {
    const pkg = '@dreamlab.gg/core'
    const version = '0.0.13' // TODO: Resolve version from package.json
    const resolved = `https://esm.sh/${pkg}@${version}/bundled`

    const map = {
      imports: {
        [pkg]: resolved,
      },
    }

    // TODO: Resolve modules dynamically
    const modules = [
      'entities',
      'input',
      'math',
      'network',
      'textures',
      'utils',
    ]

    for (const module of modules) {
      map.imports[`${pkg}/${module}`] = resolved
    }

    return [
      {
        tag: 'script',
        attrs: { type: 'importmap' },
        children: JSON.stringify(map),
      },
    ]
  },
})

export default defineConfig(async () => ({
  plugins: [importMapPlugin()],

  build: {
    rollupOptions: {
      external: ['@dreamlab.gg/core', /@dreamlab.gg\/core\/.*/g],
    },
  },
}))
