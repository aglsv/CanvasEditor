import {defineConfig} from 'vite'
import typescript from '@rollup/plugin-typescript'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'
import * as path from 'path'

export default defineConfig(({ mode }) => {
  const name = 'canvas-editor'
  if (mode === 'lib') {
    return {
      plugins: [
        cssInjectedByJsPlugin({
          styleId: `${name}-style`,
          topExecutionPriority: true
        }),
        {
          ...typescript({
            tsconfig: './tsconfig.json',
            include: ['./src/**']
          }),
          apply: 'build',
          declaration: true,
          declarationDir: 'types/',
          rootDir: '/'
        }
      ],
      build: {
        lib: {
          name,
          fileName: name,
          formats: ['umd'],
          // entry: path.resolve(__dirname, 'src/editor/index.ts')
          entry: path.resolve(__dirname, 'src/main.ts')
        },
        rollupOptions: {
          output: {
            sourcemap: false
          }
        }
      }
    }
  }
  return {
    base: `./`,
    server: {
      port: 3001,
      host: '0.0.0.0'
    }
  }
})
