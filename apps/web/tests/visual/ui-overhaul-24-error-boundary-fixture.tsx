import { type ReactElement, useRef } from 'react';
import { createRoot } from 'react-dom/client';

import '../../src/styles/index.css';
import { AppErrorBoundary } from '../../src/components/app/AppErrorBoundary.js';

function ControlledChild(): ReactElement {
	const params = new URLSearchParams(window.location.search);
	const mode = params.get('mode') ?? 'route-error';

	if (mode === 'route-error' || mode === 'root-error') {
		throw new Error('Simulated render error for fixture');
	}

	return <div data-testid="success-content">Ekran yeniden açıldı.</div>;
}

function Fixture(): ReactElement {
	const params = new URLSearchParams(window.location.search);
	const mode = params.get('mode') ?? 'route-error';
	const recoverOutputRef = useRef<HTMLDivElement>(null);

	const handleRecoverToChat = (): void => {
		const output = recoverOutputRef.current;
		if (output) {
			output.textContent = 'Sohbete dönüş istendi';
		}
	};

	const tone = mode === 'root-error' || mode === 'root-recover' ? 'root' : 'route';

	return (
		<main className="runa-page runa-page--chat-product" data-testid="error-boundary-fixture">
			<section style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
				<AppErrorBoundary
					tone={tone}
					onRecoverToChat={handleRecoverToChat}
				>
					<ControlledChild />
				</AppErrorBoundary>
				<div ref={recoverOutputRef} data-testid="recover-output" />
			</section>
		</main>
	);
}

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Fixture root element is missing.');
}

createRoot(rootElement).render(<Fixture />);
