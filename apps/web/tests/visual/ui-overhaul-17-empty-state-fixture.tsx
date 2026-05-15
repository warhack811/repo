import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

import '../../src/styles/index.css';
import { EmptyState } from '../../src/components/chat/EmptyState.js';

function Fixture() {
	const [selectedPrompt, setSelectedPrompt] = useState('');

	return (
		<main className="runa-page runa-page--chat-product">
			<section data-testid="empty-state-fixture">
				<EmptyState
					activeDeviceLabel="Muhammet'in bilgisayarı"
					conversationCount={3}
					onSubmitSuggestion={setSelectedPrompt}
					workingDirectory="D:\\ai\\Runa"
				/>
				<output data-testid="selected-prompt">{selectedPrompt}</output>
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
