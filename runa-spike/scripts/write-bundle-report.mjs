import { gzipSync } from 'node:zlib'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const distDir = path.resolve('dist')
const defaultOut = path.resolve('spike-artifacts/after/bundle-report.json')
const outIndex = process.argv.indexOf('--out')
const outFile = outIndex === -1 ? defaultOut : path.resolve(process.argv[outIndex + 1])

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name)
      return entry.isDirectory() ? walk(fullPath) : Promise.resolve([fullPath])
    }),
  )
  return files.flat()
}

function gzipSize(bytes) {
  return gzipSync(bytes).length
}

const html = await readFile(path.join(distDir, 'index.html'), 'utf8')
const initialRefs = new Set(
  [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((match) => path.basename(match[1])),
)
const files = await walk(distDir)
const assets = await Promise.all(
  files.map(async (file) => {
    const bytes = await readFile(file)
    const info = await stat(file)
    const name = path.relative(distDir, file).replaceAll('\\', '/')
    return {
      name,
      bytes: info.size,
      gzipBytes: gzipSize(bytes),
      initial: initialRefs.has(path.basename(file)),
    }
  }),
)

const jsAssets = assets.filter((asset) => asset.name.endsWith('.js'))
const cssAssets = assets.filter((asset) => asset.name.endsWith('.css'))
const initialJsGzipBytes = jsAssets
  .filter((asset) => asset.initial)
  .reduce((total, asset) => total + asset.gzipBytes, 0)
const totalJsGzipBytes = jsAssets.reduce((total, asset) => total + asset.gzipBytes, 0)

const report = {
  generatedAt: new Date().toISOString(),
  budgets: {
    initialJsGzipBytes: 350 * 1024,
    totalJsGzipBytes: 1.5 * 1024 * 1024,
  },
  totals: {
    initialJsGzipBytes,
    lazyJsGzipBytes: totalJsGzipBytes - initialJsGzipBytes,
    totalJsGzipBytes,
    cssGzipBytes: cssAssets.reduce((total, asset) => total + asset.gzipBytes, 0),
  },
  focus: {
    mermaidInitialGzipBytes: jsAssets
      .filter((asset) => asset.initial && asset.name.toLowerCase().includes('mermaid'))
      .reduce((total, asset) => total + asset.gzipBytes, 0),
    shikiInitialGzipBytes: jsAssets
      .filter((asset) => asset.initial && /typescript|javascript|python|github-|shiki/i.test(asset.name))
      .reduce((total, asset) => total + asset.gzipBytes, 0),
    katexCssGzipBytes: cssAssets.reduce((total, asset) => total + asset.gzipBytes, 0),
  },
  assets: assets.sort((a, b) => b.gzipBytes - a.gzipBytes),
}

await mkdir(path.dirname(outFile), { recursive: true })
await writeFile(outFile, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report.totals, null, 2))
