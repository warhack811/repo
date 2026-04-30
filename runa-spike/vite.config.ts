import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import tailwindcss from '@tailwindcss/vite'
import {
  UI_MESSAGE_STREAM_HEADERS,
  convertToModelMessages,
  createUIMessageStream,
  pipeUIMessageStreamToResponse,
} from 'ai'
import type { UIMessage, UIMessageChunk } from 'ai'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const scenarioText = (scenario: string) => {
  if (scenario === 'turkish-rtl') {
    return 'Türkçe karakterler: ğüşıöç. Emoji: 🚀. RTL karışımı: مرحبا بالعالم ve שלום עולם. **Markdown** akışı bozulmadan kalmalı.'
  }

  if (scenario === 'tool') {
    return 'Tool çağrısı tamamlandı. Partial JSON input akışı `tool-input-start` ve `tool-input-delta` ile geldi; sonuç EvidencePack özeti olarak bağlandı.'
  }

  return [
    '# Custom backend cevabı',
    '',
    '**AI SDK v6 transport** Vite middleware üstündeki `/api/chat` endpointine bağlandı.',
    '',
    '| Sağlayıcı | Latency | Score |',
    '|---|---|---|',
    '| Brave | 669ms | 14.89 |',
    '| Tavily | 998ms | 13.67 |',
    '',
    '```typescript',
    'const x: number = 42;',
    'function greet(name: string) { return `Hello, ${name}`; }',
    '```',
    '',
    'Inline: $E = mc^2$ olarak ifade edilir.',
    '',
    '$$',
    '\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}',
    '$$',
    '',
    '```mermaid',
    'graph TD',
    '    A[Search] --> B[Normalize]',
    '    B --> C[Dedup]',
    '    C --> D[Evidence]',
    '```',
    '',
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
  ].join('\n')
}

const writeText = async (
  writer: { write: (part: UIMessageChunk) => void },
  text: string,
  id = 'mock-text',
) => {
  writer.write({ type: 'text-start', id })
  for (const token of text.match(/.{1,8}/gs) ?? []) {
    writer.write({ type: 'text-delta', id, delta: token })
    await sleep(20)
  }
  writer.write({ type: 'text-end', id })
}

const parseRequestBody = async (req: import('node:http').IncomingMessage) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) {
    return {}
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
    messages?: UIMessage[]
    scenario?: string
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'runa-spike-chat-api',
      configureServer(server) {
        server.middlewares.use('/api/chat', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Method not allowed')
            return
          }

          const body = await parseRequestBody(req)
          const scenario = body.scenario ?? 'mixed'
          const modelMessages = await convertToModelMessages(body.messages ?? [])
          console.info('[runa-spike] /api/chat', {
            scenario,
            uiMessages: body.messages?.length ?? 0,
            modelMessages: modelMessages.length,
          })

          if (scenario === 'network-cut') {
            res.writeHead(200, UI_MESSAGE_STREAM_HEADERS)
            res.write(`data: ${JSON.stringify({ type: 'text-start', id: 'cut-text' })}\n\n`)
            res.write(
              `data: ${JSON.stringify({
                type: 'text-delta',
                id: 'cut-text',
                delta: 'Stream deliberately cut after this partial sentence...',
              })}\n\n`,
            )
            setTimeout(() => res.destroy(), 300)
            return
          }

          const stream = createUIMessageStream({
            execute: async ({ writer }) => {
              writer.write({
                type: 'start',
                messageId: `mock-${Date.now()}`,
                messageMetadata: { scenario },
              })

              writer.write({ type: 'reasoning-start', id: 'mock-reasoning' })
              writer.write({
                type: 'reasoning-delta',
                id: 'mock-reasoning',
                delta: 'Mock backend önce UIMessage parçalarını ve tool durumunu hazırlıyor.',
              })
              await sleep(80)
              writer.write({ type: 'reasoning-end', id: 'mock-reasoning' })

              if (scenario === 'tool' || scenario === 'mixed') {
                const toolCallId = 'tool-evidence-1'
                writer.write({
                  type: 'tool-input-start',
                  toolCallId,
                  toolName: 'evidence.search',
                  title: 'Evidence search',
                })
                for (const delta of ['{"query"', ':"runa ui"', ',"limit":4}']) {
                  writer.write({ type: 'tool-input-delta', toolCallId, inputTextDelta: delta })
                  await sleep(50)
                }
                writer.write({
                  type: 'tool-input-available',
                  toolCallId,
                  toolName: 'evidence.search',
                  input: { query: 'runa ui', limit: 4 },
                  title: 'Evidence search',
                })
                await sleep(100)
                writer.write({
                  type: 'tool-output-available',
                  toolCallId,
                  output: {
                    results: 4,
                    topDomain: 'github.com',
                    elapsedMs: 128,
                  },
                })
              }

              writer.write({
                type: 'source-url',
                sourceId: 'source-github',
                url: 'https://github.com/vercel/ai',
                title: 'Vercel AI SDK',
              })
              await writeText(writer, scenarioText(scenario))
              writer.write({ type: 'finish', finishReason: 'stop' })
            },
          })

          pipeUIMessageStreamToResponse({
            response: res,
            headers: UI_MESSAGE_STREAM_HEADERS,
            stream,
          })
        })
      },
    },
  ],
  build: {
    rollupOptions: {
      plugins:
        process.env.npm_lifecycle_event === 'analyze'
          ? [
              visualizer({
                filename: 'dist/bundle-visualizer.html',
                gzipSize: true,
                brotliSize: true,
                template: 'treemap',
              }),
            ]
          : [],
    },
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
})
