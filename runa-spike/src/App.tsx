import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from '@assistant-ui/react'
import { useChatRuntime } from '@assistant-ui/react-ai-sdk'
import { useChat } from '@ai-sdk/react'
import type { DynamicToolUIPart, ToolUIPart } from 'ai'
import { DefaultChatTransport } from 'ai'
import {
  Activity,
  Bot,
  Check,
  ChevronRight,
  Gauge,
  Moon,
  Play,
  RotateCcw,
  Send,
  Square,
  Sun,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselHeader,
  InlineCitationCarouselIndex,
  InlineCitationCarouselItem,
  InlineCitationCarouselNext,
  InlineCitationCarouselPrev,
  InlineCitationQuote,
  InlineCitationSource,
  InlineCitationText,
} from '@/components/ai-elements/inline-citation'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources'
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from '@/components/ai-elements/tool'
import { Button } from '@/components/ui/button'
import { MessageRenderer } from '@/lib/assistant-ui/MessageRenderer'
import { StreamdownMessage } from '@/lib/streamdown/StreamdownMessage'
import './App.css'

type ToolPart = ToolUIPart | DynamicToolUIPart

type EvidencePack = {
  query: string
  searches: number
  results: number
  truncated: boolean
  sources: Array<{
    id: string
    url: string
    canonical_url: string
    title: string
    domain: string
    favicon: string
    published_at: string | null
    snippet: string
    trust_score: number
  }>
}

const markdownFixtures = [
  {
    id: 'plain',
    label: 'A Markdown',
    content:
      '# Başlık\n**bold** ve *italic* metinler.\n- madde 1\n- madde 2\n\n> blockquote',
  },
  {
    id: 'table',
    label: 'B GFM tablo',
    content:
      '| Sağlayıcı | Latency | Score |\n|---|---|---|\n| Brave | 669ms | 14.89 |\n| Tavily | 998ms | 13.67 |',
  },
  {
    id: 'code',
    label: 'C Shiki kod',
    content:
      '```typescript\nconst x: number = 42;\nfunction greet(name: string) { return `Hello, ${name}`; }\n```',
  },
  {
    id: 'math',
    label: 'D KaTeX math',
    content:
      'Inline: $E = mc^2$ olarak ifade edilir.\nDisplay:\n$$\n\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}\n$$',
  },
  {
    id: 'mermaid',
    label: 'E Mermaid',
    content:
      '```mermaid\ngraph TD\n    A[Search] --> B[Normalize]\n    B --> C[Dedup]\n    C --> D[Evidence]\n```',
  },
  {
    id: 'mixed',
    label: 'F Uzun karma',
    content:
      '# Karma cevap\n\n**Özet:** tablo, kod, matematik ve diagram aynı mesajda.\n\n| Sağlayıcı | Latency | Score |\n|---|---|---|\n| Brave | 669ms | 14.89 |\n| Tavily | 998ms | 13.67 |\n\n```typescript\nconst x: number = 42;\nfunction greet(name: string) { return `Hello, ${name}`; }\n```\n\nInline: $E = mc^2$.\n\n$$\n\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}\n$$\n\n```mermaid\ngraph TD\nA[Search] --> B[Normalize]\nB --> C[Dedup]\nC --> D[Evidence]\n```\n\n<script>alert(1)</script>\n<img src=x onerror=alert(1)>',
  },
  {
    id: 'broken',
    label: 'G Yarım stream',
    content:
      'Bir **bold cümle yarım kal\n\n```typescript\nconst x = 1;\n\n$E = mc^\n\n| col1 | col2 |\n|---|',
  },
] as const

const evidencePack: EvidencePack = {
  query: 'AI UI streaming markdown components',
  searches: 4,
  results: 17,
  truncated: false,
  sources: [
    {
      id: '1',
      url: 'https://techcrunch.com/2026/01/15/ai-agents-ui-patterns/',
      canonical_url: 'https://techcrunch.com/2026/01/15/ai-agents-ui-patterns/',
      title: 'AI agent interfaces start converging on streaming work surfaces',
      domain: 'techcrunch.com',
      favicon: 'https://www.google.com/s2/favicons?domain=techcrunch.com&sz=64',
      published_at: '2026-01-15',
      snippet:
        'Streaming assistant interfaces increasingly combine citations, tool states, and markdown rendering.',
      trust_score: 0.74,
    },
    {
      id: '2',
      url: 'https://en.wikipedia.org/wiki/Server-sent_events',
      canonical_url: 'https://en.wikipedia.org/wiki/Server-sent_events',
      title: 'Server-sent events',
      domain: 'wikipedia.org',
      favicon: 'https://www.google.com/s2/favicons?domain=wikipedia.org&sz=64',
      published_at: null,
      snippet:
        'SSE is a browser event stream format commonly used for one-way streaming updates.',
      trust_score: 0.82,
    },
    {
      id: '3',
      url: 'https://github.com/vercel/ai',
      canonical_url: 'https://github.com/vercel/ai',
      title: 'vercel/ai',
      domain: 'github.com',
      favicon: 'https://www.google.com/s2/favicons?domain=github.com&sz=64',
      published_at: null,
      snippet:
        'The AI SDK repository contains the UIMessage stream helpers used by the mock backend.',
      trust_score: 0.92,
    },
    {
      id: '4',
      url: 'https://news.ycombinator.com/item?id=41234567',
      canonical_url: 'https://news.ycombinator.com/item?id=41234567',
      title: 'Discussion: Streaming UI state for agents',
      domain: 'news.ycombinator.com',
      favicon:
        'https://www.google.com/s2/favicons?domain=news.ycombinator.com&sz=64',
      published_at: '2026-02-03',
      snippet:
        'Practitioners compare markdown flicker, citations, and tool call UX in long agent threads.',
      trust_score: 0.61,
    },
  ],
}

function useProgressiveText(text: string, enabled: boolean, tokensPerSecond = 80) {
  const [visible, setVisible] = useState(enabled ? '' : text)

  useEffect(() => {
    if (!enabled) {
      window.setTimeout(() => setVisible(text), 0)
      return undefined
    }

    window.setTimeout(() => setVisible(''), 0)
    let index = 0
    const step = Math.max(1, Math.floor(tokensPerSecond / 20))
    const timer = window.setInterval(() => {
      index = Math.min(text.length, index + step)
      setVisible(text.slice(0, index))
      if (index >= text.length) {
        window.clearInterval(timer)
      }
    }, 50)

    return () => window.clearInterval(timer)
  }, [enabled, text, tokensPerSecond])

  return visible
}

function TransportChat() {
  const [scenario, setScenario] = useState('mixed')
  const [input, setInput] = useState('Runa stack spike için mixed streaming çalıştır.')
  const { messages, sendMessage, status, stop, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ id, messages: requestMessages, trigger }) => ({
        body: {
          id,
          messages: requestMessages,
          scenario,
          trigger,
        },
      }),
    }),
  })

  const lastMessageShape = useMemo(
    () =>
      JSON.stringify(
        messages.map((message) => ({
          id: message.id,
          role: message.role,
          parts: message.parts?.map((part) => ({
            type: part.type,
            state: 'state' in part ? part.state : undefined,
          })),
        })),
        null,
        2,
      ),
    [messages],
  )

  const handleSubmit = () => {
    sendMessage({ text: input || `Run scenario: ${scenario}` })
  }

  return (
    <section className="panel wide" id="transport">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Test 1</p>
          <h2>AI SDK v6 custom backend transport</h2>
        </div>
        <span className="status-pill">{status}</span>
      </div>
      <div className="chat-grid">
        <div className="chat-surface" data-testid="transport-chat">
          {messages.length === 0 && (
            <div className="empty-note">Mock `/api/chat` UIMessage stream bekliyor.</div>
          )}
          {messages.map((message) => (
            <article className={`bubble ${message.role}`} key={message.id}>
              <strong>{message.role}</strong>
              {message.parts?.map((part, index) => {
                if (part.type === 'text') {
                  return (
                    <StreamdownMessage
                      className="markdown"
                      mode={status === 'streaming' ? 'streaming' : 'static'}
                      key={`${message.id}-${index}`}
                    >
                      {part.text}
                    </StreamdownMessage>
                  )
                }
                if (part.type === 'reasoning') {
                  return (
                    <Reasoning
                      defaultOpen
                      isStreaming={status === 'streaming'}
                      key={`${message.id}-${index}`}
                    >
                      <ReasoningTrigger />
                      <ReasoningContent>{part.text}</ReasoningContent>
                    </Reasoning>
                  )
                }
                if (part.type.startsWith('tool-')) {
                  const toolPart = part as ToolPart
                  return (
                    <Tool className="tool-shell" defaultOpen key={`${message.id}-${index}`}>
                      {toolPart.type === 'dynamic-tool' ? (
                        <ToolHeader
                          state={toolPart.state}
                          title="Mock evidence search"
                          toolName={toolPart.toolName}
                          type={toolPart.type}
                        />
                      ) : (
                        <ToolHeader
                          state={toolPart.state}
                          title="Mock evidence search"
                          type={toolPart.type}
                        />
                      )}
                      <ToolContent>
                        <ToolInput input={toolPart.input} state={toolPart.state} />
                        <ToolOutput
                          errorText={toolPart.errorText}
                          output={toolPart.output}
                        />
                      </ToolContent>
                    </Tool>
                  )
                }
                return (
                  <pre className="part-dump" key={`${message.id}-${index}`}>
                    {JSON.stringify(part, null, 2)}
                  </pre>
                )
              })}
            </article>
          ))}
        </div>
        <div className="side-log">
          <label>
            Scenario
            <select onChange={(event) => setScenario(event.target.value)} value={scenario}>
              <option value="mixed">mixed markdown + raw HTML</option>
              <option value="tool">tool call + partial JSON</option>
              <option value="network-cut">network cut</option>
              <option value="turkish-rtl">Türkçe + emoji + RTL</option>
            </select>
          </label>
          <textarea
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                handleSubmit()
              }
            }}
            value={input}
          />
          <div className="toolbar">
            <Button onClick={handleSubmit} type="button">
              <Send className="size-4" /> Send
            </Button>
            <Button onClick={() => regenerate()} type="button" variant="secondary">
              <RotateCcw className="size-4" /> Retry
            </Button>
            <Button onClick={stop} type="button" variant="secondary">
              <Square className="size-4" /> Stop
            </Button>
          </div>
          <pre>{lastMessageShape}</pre>
        </div>
      </div>
    </section>
  )
}

function AssistantThreadShell() {
  const runtime = useChatRuntime({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <section className="panel" id="assistant-ui">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Test 2</p>
            <h2>assistant-ui thread shell</h2>
          </div>
          <Bot className="icon-muted" />
        </div>
        <ThreadPrimitive.Root className="assistant-thread">
          <ThreadPrimitive.Viewport className="assistant-viewport">
            <ThreadPrimitive.Empty>
              <div className="empty-note">ThreadPrimitive empty state</div>
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages
              components={{
                UserMessage: () => (
                  <MessagePrimitive.Root className="assistant-message user">
                    <MessageRenderer />
                  </MessagePrimitive.Root>
                ),
                AssistantMessage: () => (
                  <MessagePrimitive.Root className="assistant-message assistant">
                    <MessageRenderer />
                  </MessagePrimitive.Root>
                ),
              }}
            />
            <ThreadPrimitive.ViewportFooter>
              <ComposerPrimitive.Root className="assistant-composer">
                <ComposerPrimitive.Input
                  className="assistant-input"
                  placeholder="Cmd+Enter shortcut burada assistant-ui composer ile denenir"
                />
                <ComposerPrimitive.Send asChild>
                  <Button type="button">
                    <Send className="size-4" /> Send
                  </Button>
                </ComposerPrimitive.Send>
              </ComposerPrimitive.Root>
            </ThreadPrimitive.ViewportFooter>
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </section>
    </AssistantRuntimeProvider>
  )
}

function StreamdownMatrix() {
  const [fixtureId, setFixtureId] = useState<(typeof markdownFixtures)[number]['id']>('plain')
  const [streaming, setStreaming] = useState(true)
  const [dark, setDark] = useState(true)
  const activeFixture =
    markdownFixtures.find((fixture) => fixture.id === fixtureId) ?? markdownFixtures[0]
  const progressive = useProgressiveText(activeFixture.content, streaming, 100)

  return (
    <section className="panel wide" id="streamdown">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Test 3</p>
          <h2>Streamdown gerçek mesaj tipleri</h2>
        </div>
        <div className="toolbar compact">
          <Button onClick={() => setStreaming((value) => !value)} type="button" variant="secondary">
            <Play className="size-4" /> {streaming ? 'Static' : 'Stream'}
          </Button>
          <Button onClick={() => setDark((value) => !value)} type="button" variant="secondary">
            {dark ? <Moon className="size-4" /> : <Sun className="size-4" />} Theme
          </Button>
        </div>
      </div>
      <div className="fixture-tabs">
        {markdownFixtures.map((fixture) => (
          <button
            className={fixture.id === fixtureId ? 'selected' : ''}
            key={fixture.id}
            onClick={() => setFixtureId(fixture.id)}
            type="button"
          >
            {fixture.label}
          </button>
        ))}
      </div>
      <div className={dark ? 'render-box dark-render' : 'render-box light-render'}>
        <StreamdownMessage
          className="markdown"
          mode={streaming ? 'streaming' : 'static'}
        >
          {progressive}
        </StreamdownMessage>
      </div>
    </section>
  )
}

function EvidencePanel() {
  return (
    <section className="panel" id="evidence">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Test 4</p>
          <h2>ai-elements citations</h2>
        </div>
        <span className="status-pill">{evidencePack.results} results</span>
      </div>
      <p className="body-copy">
        EvidencePack query: <strong>{evidencePack.query}</strong>. Runa can show a
        compact claim with inline citations{' '}
        <InlineCitation>
          <InlineCitationText>streaming markdown needs hardened renderers</InlineCitationText>
          <InlineCitationCard>
            <InlineCitationCardTrigger
              sources={evidencePack.sources.slice(0, 2).map((source) => source.url)}
            />
            <InlineCitationCardBody>
              <InlineCitationCarousel>
                <InlineCitationCarouselHeader>
                  <InlineCitationCarouselPrev />
                  <InlineCitationCarouselIndex />
                  <InlineCitationCarouselNext />
                </InlineCitationCarouselHeader>
                <InlineCitationCarouselContent>
                  {evidencePack.sources.slice(0, 2).map((source) => (
                    <InlineCitationCarouselItem key={source.id}>
                      <InlineCitationSource
                        description={source.snippet}
                        title={source.title}
                        url={source.url}
                      />
                      <InlineCitationQuote>{source.domain}</InlineCitationQuote>
                    </InlineCitationCarouselItem>
                  ))}
                </InlineCitationCarouselContent>
              </InlineCitationCarousel>
            </InlineCitationCardBody>
          </InlineCitationCard>
        </InlineCitation>{' '}
        and a second citation chip{' '}
        <InlineCitation>
          <InlineCitationText>tool evidence should stay inspectable</InlineCitationText>
          <InlineCitationCard>
            <InlineCitationCardTrigger sources={[evidencePack.sources[2].url]} />
            <InlineCitationCardBody>
              <div className="citation-card">
                <InlineCitationSource
                  description={evidencePack.sources[2].snippet}
                  title={evidencePack.sources[2].title}
                  url={evidencePack.sources[2].url}
                />
              </div>
            </InlineCitationCardBody>
          </InlineCitationCard>
        </InlineCitation>
        .
      </p>
      <Sources>
        <SourcesTrigger count={evidencePack.sources.length}>
          <span>Sources</span>
          <ChevronRight className="size-4" />
        </SourcesTrigger>
        <SourcesContent>
          {evidencePack.sources.map((source) => (
            <Source href={source.url} key={source.id} title={source.title}>
              <img alt="" className="favicon" src={source.favicon} />
              <span>
                {source.id}. {source.title}
                <small>{source.domain} · trust {source.trust_score}</small>
              </span>
            </Source>
          ))}
        </SourcesContent>
      </Sources>
      <Reasoning defaultOpen={false}>
        <ReasoningTrigger />
        <ReasoningContent>{`Search count: ${evidencePack.searches}. Truncated: ${String(
          evidencePack.truncated,
        )}. The component is visually compact, but labels are English by default.`}</ReasoningContent>
      </Reasoning>
      <Tool defaultOpen>
        <ToolHeader state="output-available" title="web.search" type="tool-web_search" />
        <ToolContent>
          <ToolInput input={{ query: evidencePack.query, limit: 5 }} state="output-available" />
          <ToolOutput errorText={undefined} output={evidencePack} />
        </ToolContent>
      </Tool>
    </section>
  )
}

function PerfPanel() {
  const [messages, setMessages] = useState(50)
  const [tokenRun, setTokenRun] = useState(false)
  const perfStart = useRef(0)
  const longMessage = useMemo(
    () =>
      Array.from({ length: 160 }, (_, index) => `Satır ${index + 1}: Runa ğüşıöç العربية עברית 🚀 streaming metni.`).join(
        '\n',
      ),
    [],
  )
  const streamedLong = useProgressiveText(longMessage, tokenRun, 100)

  useEffect(() => {
    if (tokenRun) {
      perfStart.current = performance.now()
    }
  }, [tokenRun])

  return (
    <section className="panel wide" id="stress">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Test 5-7</p>
          <h2>Bundle, stress ve edge durumları</h2>
        </div>
        <Gauge className="icon-muted" />
      </div>
      <div className="toolbar">
        <Button onClick={() => setMessages((value) => (value === 50 ? 5 : 50))} type="button">
          <Activity className="size-4" /> {messages} messages
        </Button>
        <Button onClick={() => setTokenRun((value) => !value)} type="button" variant="secondary">
          100 token/s sim
        </Button>
      </div>
      <div className="conversation-load">
        {Array.from({ length: messages }, (_, index) => (
          <article className={`bubble ${index % 2 ? 'assistant' : 'user'}`} key={index}>
            <strong>{index % 2 ? 'assistant' : 'user'} #{index + 1}</strong>
            <StreamdownMessage className="markdown">
              {index === messages - 1 ? streamedLong : `Kısa mesaj ${index + 1} **bold** ve tablo izi.`}
            </StreamdownMessage>
          </article>
        ))}
      </div>
    </section>
  )
}

function App() {
  return (
    <main>
      <header className="hero-lockup">
        <div>
          <p className="eyebrow">Runa production stack spike</p>
          <h1>AI UI stack integration lab</h1>
          <p>
            Vite + React 19 + AI SDK v6 + assistant-ui + Streamdown + ai-elements
            birlikte, custom backend stream üzerinden deneniyor.
          </p>
        </div>
        <div className="result-card">
          <Check className="size-5" />
          <span>Exact package lock + custom `/api/chat`</span>
        </div>
      </header>
      <div className="layout">
        <TransportChat />
        <AssistantThreadShell />
        <StreamdownMatrix />
        <EvidencePanel />
        <PerfPanel />
      </div>
    </main>
  )
}

export default App
