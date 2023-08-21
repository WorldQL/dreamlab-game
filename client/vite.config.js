// @ts-check
import { defineConfig } from 'vite'
import { resolve } from 'import-meta-resolve'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, parse, sep } from 'node:path'

// #region Package Helpers
/**
 * @param {string} pkg - Package name
 * @returns {Promise<import('type-fest').PackageJson>}
 */
const packageJson = async pkg => {
  const direct = async () => {
    const path = await resolve(`${pkg}/package.json`, import.meta.url)
    const json = await readFile(fileURLToPath(path), 'utf8')

    return json
  }

  const indirect = async () => {
    const root = await resolve(pkg, import.meta.url)
    const { dir } = parse(fileURLToPath(root))

    const dirs = dir.split(sep)
    const offset = pkg.startsWith('@') ? 3 : 2
    const idx = dirs.length - dirs.indexOf('node_modules') - offset

    let path = dir
    for (let i = 0; i < idx; i++) {
      path = join(path, '..')
    }

    const jsonPath = join(path, 'package.json')
    const json = await readFile(jsonPath, 'utf8')

    return json
  }

  // @ts-ignore
  const json = await Promise.any([direct(), indirect()])
  return JSON.parse(json)
}

/**
 *
 * @param {string} pkg - Package Name
 */
const esmLink = async pkg => {
  const { version } = await packageJson(pkg)
  if (!version) throw new Error(`unknown version for package: ${pkg}`)

  return `https://esm.sh/${pkg}@${version}`
}
// #endregion

/** @returns {import('vite').Plugin} */
const importMapPlugin = () => ({
  name: 'import-map',
  transformIndexHtml: async () => {
    const core = '@dreamlab.gg/core'
    const matter = 'matter-js'
    const pixi = 'pixi.js'

    const [corePkg, matterPkg, pixiPkg] = await Promise.all([
      esmLink(core),
      esmLink(matter),
      esmLink(pixi),
    ])

    const coreBundled = `${corePkg}/dist/bundled`
    const map = {
      imports: {
        [matter]: matterPkg,
        [pixi]: pixiPkg,
        [core]: coreBundled,
      },
    }

    const modulesPath = await resolve(`${core}/modules.json`, import.meta.url)
    const modulesJson = await readFile(fileURLToPath(modulesPath), 'utf8')

    const modules = JSON.parse(modulesJson)
    for (const module of modules) {
      map.imports[`${core}/${module}`] = coreBundled
      map.imports[`${core}/dist/${module}`] = coreBundled
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
        if (source.includes('matter-js')) return true
        if (source.includes('pixi.js')) return true
        if (source.includes('@pixi/')) return true
        if (source.includes('@dreamlab.gg/core')) return true
      },
    },
  },
}))
