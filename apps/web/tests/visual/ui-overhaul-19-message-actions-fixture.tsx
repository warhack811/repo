import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import '../../src/styles/index.css';
import { PersistedTranscript } from '../../src/components/chat/PersistedTranscript.js';

const MESSAGES = [
	{
		content: 'Projedeki tüm testleri çalıştır ve sonuçları raporla.',
		conversation_id: 'conv-1',
		created_at: '2026-05-15T10:00:00Z',
		message_id: 'user-1',
		role: 'user' as const,
		sequence_no: 1,
	},
	{
		content: 'Testleri çalıştırdım. İşte sonuçlar:\n\n- **Unit test**: 142/142 PASS\n- **Integration**: 38/38 PASS\n- **E2E**: 12/12 PASS\n\nTüm testler başarıyla geçti.',
		conversation_id: 'conv-1',
		created_at: '2026-05-15T10:01:00Z',
		message_id: 'assistant-1',
		role: 'assistant' as const,
		sequence_no: 2,
	},
	{
		content: 'Bir hata bulduğun dosyayı düzelt ve tekrar çalıştır.',
		conversation_id: 'conv-1',
		created_at: '2026-05-15T10:02:00Z',
		message_id: 'user-2',
		role: 'user' as const,
		sequence_no: 3,
	},
	{
		content: 'Hata `src/utils/validator.ts` dosyasında eksik tip kontrolüydü. Düzelttim ve testleri tekrar çalıştırdım:\n\n- **Unit test**: 143/143 PASS\n- **Integration**: 38/38 PASS\n\nYeni test eklendi: `validator-edge-cases.test.ts`',
		conversation_id: 'conv-1',
		created_at: '2026-05-15T10:03:00Z',
		message_id: 'assistant-2',
		role: 'assistant' as const,
		sequence_no: 4,
	},
];

function Fixture() {
	const [preparedPrompt, setPreparedPrompt] = useState('');

	return (
		<main className="runa-page runa-page--chat-product">
			<section data-testid="message-actions-fixture" style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
				<PersistedTranscript
					activeConversationId="conv-1"
					activeConversationMessages={MESSAGES}
					onPreparePrompt={(input) => {
						setPreparedPrompt(input.prompt);
					}}
				/>
				<output data-testid="prepared-prompt" style={{ display: 'block', marginTop: 16, padding: 8, background: 'var(--surface-3)', borderRadius: 8 }}>
					{preparedPrompt || '(boş)'}
				</output>
			</section>
		</main>
	);
}

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Fixture root element is missing.');
}

createRoot(rootElement).render(
	<StrictMode>
		<Fixture />
	</StrictMode>,
);
