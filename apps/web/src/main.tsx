import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App.js';
import './index.css';
import { startWebVitalsMonitoring } from './lib/monitoring/telemetry.js';
import { applyTheme, getStoredTheme } from './lib/theme.js';

applyTheme(getStoredTheme());
startWebVitalsMonitoring();

const container = document.getElementById('root');

if (!container) {
	throw new Error('Root container was not found.');
}

createRoot(container).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
