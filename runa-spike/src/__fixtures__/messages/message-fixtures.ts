export type MessageFixture = {
  id: string
  content: string
}

export const messageFixtures: MessageFixture[] = [
  { id: 'markdown', content: '# Başlık\n**bold** ve *italic* metinler.' },
  { id: 'table', content: '| Sağlayıcı | Latency |\n|---|---|\n| Brave | 669ms |' },
  { id: 'typescript', content: '```typescript\nconst x: number = 42;\n```' },
  { id: 'python', content: '```python\nprint("runa")\n```' },
  { id: 'math', content: 'Enerji formülü $E=mc^2$ olarak bilinir.' },
  { id: 'display-math', content: '$$\\int_0^\\infty e^{-x^2} dx$$' },
  { id: 'mermaid', content: '```mermaid\ngraph TD\nA[Search] --> B[Evidence]\n```' },
  { id: 'broken-bold', content: 'Bir **bold cümle yarım kal' },
  { id: 'broken-code', content: '```typescript\nconst x = 1;' },
  { id: 'unsafe-html', content: '<script>alert(1)</script><img src=x onerror=alert(1)>' },
]
