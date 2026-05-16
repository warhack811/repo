import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

import '../../src/styles/index.css';
import { AppShell } from '../../src/components/app/AppShell.js';

function Fixture() {
	return (
		<MemoryRouter initialEntries={['/history']}>
			<AppShell activePage="history">
				<div data-testid="page-content">Sayfa içeriği</div>
			</AppShell>
		</MemoryRouter>
	);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
	throw new Error('Fixture root element is missing.');
}

createRoot(rootElement).render(<Fixture />);
