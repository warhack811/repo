import type { FastifyInstance } from 'fastify';

interface HealthResponse {
	readonly service: 'runa-server';
	readonly status: 'ok';
}

const healthResponse = {
	service: 'runa-server',
	status: 'ok',
} as const satisfies HealthResponse;

export async function registerHealthRoutes(server: FastifyInstance): Promise<void> {
	server.get<{ Reply: HealthResponse }>('/health', async () => healthResponse);
}
