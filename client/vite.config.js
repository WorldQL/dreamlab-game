import { defineConfig } from 'vite'
import { resolve } from 'import-meta-resolve'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/** @returns {import('vite').Plugin} */
const importMapPlugin = () => ({
  name: 'import-map',
  transformIndexHtml: async () => {
    const pkg = '@dreamlab.gg/core'

    const pkgPath = await resolve(`${pkg}/package.json`, import.meta.url)
    const pkgJson = await readFile(fileURLToPath(pkgPath), 'utf8')

    const { version } = JSON.parse(pkgJson)
    const resolved = `https://esm.sh/${pkg}@${version}/bundled`

    const map = {
      imports: {
        [pkg]: resolved,
      },
    }

    const modulesPath = await resolve(`${pkg}/modules.json`, import.meta.url)
    const modulesJson = await readFile(fileURLToPath(modulesPath), 'utf8')

    const modules = JSON.parse(modulesJson)
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
      external: (source, importer, isResolved) => {
        if (source.includes('@dreamlab.gg/core')) return true
      },
    },
  },
}))
