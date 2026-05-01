import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const reportFile = path.resolve('spike-artifacts/after/bundle-report.json')

await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['scripts/write-bundle-report.mjs', '--out', reportFile], {
    stdio: 'inherit',
  })
  child.on('exit', (code) => {
    if (code === 0) {
      resolve(undefined)
      return
    }
    reject(new Error(`Bundle report failed with exit code ${code}`))
  })
})

const report = JSON.parse(await readFile(reportFile, 'utf8'))
const failures = []

if (report.totals.initialJsGzipBytes > report.budgets.initialJsGzipBytes) {
  failures.push(
    `initial JS gzip ${report.totals.initialJsGzipBytes} > ${report.budgets.initialJsGzipBytes}`,
  )
}

if (report.totals.totalJsGzipBytes > report.budgets.totalJsGzipBytes) {
  failures.push(`total JS gzip ${report.totals.totalJsGzipBytes} > ${report.budgets.totalJsGzipBytes}`)
}

if (report.focus.mermaidInitialGzipBytes > 0) {
  failures.push(`Mermaid is present in initial JS: ${report.focus.mermaidInitialGzipBytes}`)
}

if (report.focus.shikiInitialGzipBytes > 100 * 1024) {
  failures.push(`Shiki initial gzip ${report.focus.shikiInitialGzipBytes} > 102400`)
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}
