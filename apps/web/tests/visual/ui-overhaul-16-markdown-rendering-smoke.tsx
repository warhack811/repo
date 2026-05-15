import { createRoot } from 'react-dom/client';

import '../../src/styles/index.css';
import { StreamdownMessage } from '../../src/lib/streamdown/StreamdownMessage.js';

const markdown = `# Başlık

Kısa paragraf ve \`inline code\`.

- Birinci madde
- İkinci madde

> Alıntı metni

| Alan | Durum |
|---|---|
| Markdown | Hazır |

\`\`\`ts
const value = "runa";
\`\`\`

[Harici link](https://example.com)`;

function Fixture() {
	return (
		<main className="runa-page runa-page--chat-product">
			<div
				data-testid="markdown-fixture"
				style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}
			>
				<StreamdownMessage>{markdown}</StreamdownMessage>
			</div>
		</main>
	);
}

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Fixture root element is missing.');
}

createRoot(rootElement).render(<Fixture />);
