import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev proxy assumes the Fastify server runs on http://127.0.0.1:3000.
export default defineConfig({
	plugins: [react()],
	server: {
		port: 5173,
		proxy: {
			'/auth': {
				target: 'http://127.0.0.1:3000',
			},
			'/ws': {
				target: 'ws://127.0.0.1:3000',
				ws: true,
			},
		},
	},
});
