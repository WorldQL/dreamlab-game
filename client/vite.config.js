import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          matter: ['matter-js'],
          pixi: ['pixi.js'],
          dreamlab: ['@dreamlab.gg/core'],
        },
      },
    },
  },
})
