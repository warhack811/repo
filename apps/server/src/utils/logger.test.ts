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
