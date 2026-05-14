import { describe, expect, it, vi } from 'vitest';

import { createLogger, startLogSpan } from './logger.js';

describe('createLogger', () => {
	it('masks sensitive values while preserving structured context', () => {
		const sink = vi.fn();
		const logger = createLogger({
			context: {
				component: 'test.logger',
				password: 'top-secret',
			},
			sink,
		});

		logger.error('logger.test', {
			apiKey: 'secret-key',
			nested: {
				access_token: 'token-value',
				keep: 'visible',
			},
			trace_id: 'trace_1',
		});

		expect(sink).toHaveBeenCalledWith(
			'error',
			expect.objectContaining({
				apiKey: '[REDACTED]',
				component: 'test.logger',
				level: 'error',
				message: 'logger.test',
				nested: {
					access_token: '[REDACTED]',
					keep: 'visible',
				},
				password: '[REDACTED]',
				trace_id: 'trace_1',
			}),
		);
	});

	it('redacts internal reasoning fields from structured log payloads', () => {
		const sink = vi.fn();
		const logger = createLogger({ sink });

		logger.info('logger.reasoning.test', {
			internal_reasoning: 'hidden chain',
			nested: {
				reasoning_content: 'hidden provider trace',
				visible: 'safe',
			},
			visible: 'safe root',
		});

		expect(sink).toHaveBeenCalledWith(
			'info',
			expect.objectContaining({
				internal_reasoning: '[REDACTED]',
				message: 'logger.reasoning.test',
				nested: {
					reasoning_content: '[REDACTED]',
					visible: 'safe',
				},
				visible: 'safe root',
			}),
		);
	});

	it('redacts bearer, jwt, ws_ticket, and workspace_id tokens in string payloads', () => {
		const sink = vi.fn();
		const logger = createLogger({ sink });

		logger.warn('logger.redaction.patterns', {
			url: 'wss://app.runa.ai/ws?ws_ticket=secret-ticket&workspace_id=workspace_123',
			value:
				'authorization=Bearer secret-token jwt=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1In0.signature',
		});

		expect(sink).toHaveBeenCalledWith(
			'warn',
			expect.objectContaining({
				message: 'logger.redaction.patterns',
				url: 'wss://app.runa.ai/ws?ws_ticket=[REDACTED]&workspace_id=[REDACTED]',
				value: 'authorization=Bearer [REDACTED] jwt=[REDACTED_JWT]',
			}),
		);
	});

	it('emits span lifecycle entries with shared span metadata', () => {
		const sink = vi.fn();
		const logger = createLogger({
			context: {
				run_id: 'run_1',
			},
			sink,
		});
		const span = startLogSpan(logger, 'tool.execute', {
			tool_name: 'file.read',
		});

		span.end({
			status: 'completed',
		});

		expect(sink).toHaveBeenNthCalledWith(
			1,
			'info',
			expect.objectContaining({
				level: 'info',
				message: 'span.started',
				run_id: 'run_1',
				span_id: span.span_id,
				span_name: 'tool.execute',
				tool_name: 'file.read',
			}),
		);
		expect(sink).toHaveBeenNthCalledWith(
			2,
			'info',
			expect.objectContaining({
				level: 'info',
				message: 'span.completed',
				run_id: 'run_1',
				span_id: span.span_id,
				span_name: 'tool.execute',
				status: 'completed',
				tool_name: 'file.read',
			}),
		);
	});
});
