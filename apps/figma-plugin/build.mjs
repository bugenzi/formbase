import * as esbuild from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const watch = process.argv.includes('--watch')

mkdirSync('dist', { recursive: true })

// Bundle code.ts → dist/code.js (Figma sandbox, no DOM)
const codeCtx = await esbuild.context({
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  format: 'iife',
  target: 'es2017',
  platform: 'browser',
})

// Inline ui.ts into ui.html → dist/ui.html
const uiCtx = await esbuild.context({
  entryPoints: ['src/ui.ts'],
  bundle: true,
  outfile: 'dist/ui.js',
  format: 'iife',
  target: 'es2017',
  platform: 'browser',
})

async function buildUI() {
  await uiCtx.rebuild()
  const js = readFileSync('dist/ui.js', 'utf-8')
  const css = readFileSync('src/ui.css', 'utf-8')
  const html = `<!DOCTYPE html>
<html>
<head>
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<script>${js}</script>
</body>
</html>`
  writeFileSync('dist/ui.html', html)
}

await codeCtx.rebuild()
await buildUI()
console.log('[Figma Plugin] Built successfully')

if (watch) {
  console.log('[Figma Plugin] Watching for changes...')
  await codeCtx.watch()
  // For UI, we re-inline on each change
  const watcher = await esbuild.context({
    entryPoints: ['src/ui.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    target: 'es2020',
    platform: 'browser',
    plugins: [{
      name: 'inline-html',
      setup(build) {
        build.onEnd(async () => {
          await buildUI()
          console.log('[Figma Plugin] UI rebuilt')
        })
      }
    }]
  })
  await watcher.watch()
} else {
  await codeCtx.dispose()
  await uiCtx.dispose()
}
