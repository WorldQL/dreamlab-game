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
const esmLink = async (pkg, linkRoot, { pin = 'v135', exports = '' } = {}) => {
  const { version } = await packageJson(pkg, linkRoot)
  if (!version) throw new Error(`unknown version for package: ${pkg}`)

  return `https://esm.sh/${pkg}@${version}${exports}?pin=${pin}`
}
// #endregion

/**
 * @param {string|undefined} localCoreUrl
 * @returns {import('vite').Plugin}
 */
const importMapPlugin = localCoreUrl => ({
  name: 'import-map',
  transformIndexHtml: async () => {
    const core = '@dreamlab.gg/core'
    const ui = '@dreamlab.gg/ui'
    const react = 'react'
    const reactDom = 'react-dom'
    const matter = 'matter-js'
    const pixi = 'pixi.js'

    const [
      corePkg,
      reactPkg,
      jsxPkg,
      jsxDevPkg,
      reactDomPkg,
      reactDomClientPkg,
      matterPkg,
      pixiPkg,
    ] = await Promise.all([
      esmLink(core, undefined, { exports: '/dist/bundled' }),
      esmLink(react),
      esmLink(react, undefined, { exports: '/jsx-runtime' }),
      esmLink(react, undefined, { exports: '/jsx-dev-runtime' }),
      esmLink(reactDom),
      esmLink(reactDom, undefined, { exports: '/client' }),
      esmLink(matter, core),
      esmLink(pixi, core),
    ])

    const map = {
      imports: {
        [react]: reactPkg,
        [`${react}/jsx-runtime`]: jsxPkg,
        [`${react}/jsx-dev-runtime`]: jsxDevPkg,
        [reactDom]: reactDomPkg,
        [`${reactDom}/client`]: reactDomClientPkg,
        [`https://external/${react}`]: reactPkg,
        [`https://external/${react}/jsx-runtime`]: jsxPkg,
        [`https://external/${react}/jsx-dev-runtime`]: jsxDevPkg,
        [`https://external/reactDom`]: reactDomPkg,
        [`https://external/${reactDom}/client`]: reactDomClientPkg,
        [matter]: matterPkg,
        [pixi]: pixiPkg,
        [core]: corePkg,
      },
    }

    //#region Core Modules
    const coreModulesPath = await resolve(`${core}/modules.json`, import.meta.url)
    const coreModulesJson = await readFile(fileURLToPath(coreModulesPath), 'utf8')

    const coreModules = JSON.parse(coreModulesJson)
    for (const module of coreModules) {
      map.imports[`${core}/${module}`] = localCoreUrl ? localCoreUrl : corePkg
      map.imports[`${core}/dist/${module}`] = localCoreUrl ? localCoreUrl : corePkg
    }
    //#endregion

    //#region UI Modules
    const uiModulesPath = await resolve(`${ui}/modules.json`, import.meta.url)
    const uiModulesJson = await readFile(fileURLToPath(uiModulesPath), 'utf8')

    const uiModules = JSON.parse(uiModulesJson)
    const { version: uiVersion } = await packageJson(ui)
    map.imports[ui] = `https://cdn.jsdelivr.net/npm/@dreamlab.gg/ui@${uiVersion}/dist/index.js`
    for (const module of uiModules) {
      const url = `https://cdn.jsdelivr.net/npm/@dreamlab.gg/ui@${uiVersion}/dist/${module}.js`
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

export default defineConfig(async ({ mode }) => {
  const port = 5173
  const corePath = resolve('@dreamlab.gg/core', import.meta.url)

  const getLocalCoreUrl = () => {
    // only put the dreamlab-core URL in the sourcemap if it's linked and we're in dev mode
    if (mode !== 'development') return undefined
    if (corePath.includes('node_modules')) return undefined

    // TODO: unhack this
    const bundled = corePath.split('file://')[1].split('index.js').slice(0, -1)[0] + 'bundled.js'
    return `http://localhost:${port}/@fs${bundled}`
  }

  // const localCoreUrl = getLocalCoreUrl()
  // temporarily disable this because it causes the pixi error https://worldql.slack.com/archives/C03MFTRB9BJ/p1711580004918849
  const localCoreUrl = undefined

  return {
    resolve: {
      alias: [
        { find: /^react$/, replacement: 'https://external/react' },
        { find: /^react\/(.+)$/, replacement: 'https://external/react/$1' },
        { find: /^react-dom$/, replacement: 'https://external/react-dom' },
        { find: /^react-dom\/(.+)$/, replacement: 'https://external/react-dom/$1' },
      ],
    },
    plugins: [importMapPlugin(localCoreUrl)],
    preview: {
      port: port,
    },
    server: {
      port: port,
      strictPort: true,
      fs: {
        strict: false,
      },
    },

    build: {
      rollupOptions: {
        external: (source, importer, isResolved) => {
          if (source.startsWith('react')) return true
          if (source.startsWith('react-dom')) return true
          if (source.includes('matter-js')) return true
          if (source.includes('pixi.js')) return true
          if (source.includes('@pixi/')) return true
          if (source.startsWith('@dreamlab.gg/core')) return true
          if (source.startsWith('@dreamlab.gg/ui')) return true
        },
      },
    },
  }
})
