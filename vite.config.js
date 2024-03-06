// @ts-check
import { defineConfig } from 'vite'
import { resolve } from 'import-meta-resolve'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, parse, sep } from 'node:path'

// #region Package Helpers
/**
 * @param {string} pkg - Package name
 * @param {string} [linkRoot] - npm link root
 * @returns {Promise<import('type-fest').PackageJson>}
 */
const packageJson = async (pkg, linkRoot) => {
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

  const linked = async () => {
    if (!linkRoot) throw new Error('cannot read linked')

    const path = join(
      fileURLToPath(import.meta.url),
      '..',
      'node_modules',
      linkRoot,
      'node_modules',
      pkg,
    )

    const jsonPath = join(path, 'package.json')
    const json = await readFile(jsonPath, 'utf8')

    return json
  }

  // @ts-ignore
  const json = await Promise.any([direct(), indirect(), linked()])
  return JSON.parse(json)
}

/**
 * @param {string} pkg - Package Name
 * @param {string} [linkRoot] - npm link root
 */
const esmLink = async (pkg, linkRoot) => {
  const { version } = await packageJson(pkg, linkRoot)
  if (!version) throw new Error(`unknown version for package: ${pkg}`)

  return `https://esm.sh/v135/${pkg}@${version}`
}
// #endregion

/** @returns {import('vite').Plugin} */
const importMapPlugin = () => ({
  name: 'import-map',
  transformIndexHtml: async () => {
    const core = '@dreamlab.gg/core'
    const ui = '@dreamlab.gg/ui'
    const matter = 'matter-js'
    const pixi = 'pixi.js'

    const [corePkg, uiPkg, matterPkg, pixiPkg] = await Promise.all([
      esmLink(core),
      esmLink(ui),
      esmLink(matter, core),
      esmLink(pixi, core),
    ])

    const coreBundled = `${corePkg}/dist/bundled`
    const map = {
      imports: {
        [matter]: matterPkg,
        [pixi]: pixiPkg,
        [core]: coreBundled,
        [ui]: uiPkg,
      },
    }

    //#region Core Modules
    const coreModulesPath = await resolve(
      `${core}/modules.json`,
      import.meta.url,
    )

    const coreModulesJson = await readFile(
      fileURLToPath(coreModulesPath),
      'utf8',
    )

    const coreModules = JSON.parse(coreModulesJson)
    for (const module of coreModules) {
      map.imports[`${core}/${module}`] = coreBundled
      map.imports[`${core}/dist/${module}`] = coreBundled
    }
    //#endregion

    //#region UI Modules
    const uiModulesPath = await resolve(`${ui}/modules.json`, import.meta.url)
    const uiModulesJson = await readFile(fileURLToPath(uiModulesPath), 'utf8')

    const uiModules = JSON.parse(uiModulesJson)
    for (const module of uiModules) {
      const url = `${uiPkg}/dist/${module}?external=${core}`
      map.imports[`${ui}/${module}`] = url
      map.imports[`${ui}/dist/${module}`] = url
    }
    //#endregion

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
  preview: {
    port: 5173,
  },

  build: {
    rollupOptions: {
      external: (source, importer, isResolved) => {
        if (source.includes('matter-js')) return true
        if (source.includes('pixi.js')) return true
        if (source.includes('@pixi/')) return true
        if (source.includes('@dreamlab.gg/core')) return true
        if (source.includes('@dreamlab.gg/ui')) return true
      },
    },
  },
}))
