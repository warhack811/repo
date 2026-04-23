import { describe, expect, it } from 'vitest';

import type { AuthContext } from '@runa/types';

import {
	AuthorizationError,
	hasAuthorizationRole,
	requireAuthorizationRole,
	resolveAuthorizationRole,
	resolveMinimumToolAuthorizationRole,
} from './rbac.js';

function createAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
	return {
		principal: {
			email: 'dev@runa.ai',
			kind: 'authenticated',
			provider: 'supabase',
			role: 'authenticated',
			scope: {},
			user_id: 'user_1',
		},
		transport: 'http',
		...overrides,
	};
}

describe('rbac', () => {
	it('resolves admin for service principals and editor for normal authenticated users', () => {
		expect(
			resolveAuthorizationRole(
				createAuthContext({
					principal: {
						kind: 'service',
						provider: 'supabase',
						role: 'service_role',
						scope: {},
						service_name: 'supabase-admin',
					},
				}),
			),
		).toBe('admin');
		expect(resolveAuthorizationRole(createAuthContext())).toBe('editor');
		expect(
			resolveAuthorizationRole(
				createAuthContext({
					claims: {
						app_metadata: {
							runa_role: 'viewer',
						},
						scope: {},
						sub: 'user_1',
					},
				}),
			),
		).toBe('viewer');
	});

	it('compares role weights predictably', () => {
		expect(hasAuthorizationRole('owner', 'viewer')).toBe(true);
		expect(hasAuthorizationRole('viewer', 'editor')).toBe(false);
	});

	it('throws a typed authorization error when the minimum role is not met', () => {
		expect(() =>
			requireAuthorizationRole(
				createAuthContext({
					claims: {
						app_metadata: {
							runa_role: 'viewer',
						},
						scope: {},
						sub: 'user_1',
					},
				}),
				'editor',
				'Protected auth route',
			),
		).toThrowError(AuthorizationError);
	});

	it('maps tool surfaces to a minimum authorization role', () => {
		expect(
			resolveMinimumToolAuthorizationRole({
				metadata: {
					capability_class: 'file_system',
					requires_approval: false,
					risk_level: 'low',
					side_effect_level: 'read',
				},
				name: 'file.read',
			}),
		).toBe('viewer');
		expect(
			resolveMinimumToolAuthorizationRole({
				metadata: {
					capability_class: 'file_system',
					requires_approval: true,
					risk_level: 'medium',
					side_effect_level: 'write',
				},
				name: 'edit.patch',
			}),
		).toBe('editor');
		expect(
			resolveMinimumToolAuthorizationRole({
				metadata: {
					capability_class: 'shell',
					requires_approval: true,
					risk_level: 'high',
					side_effect_level: 'execute',
				},
				name: 'shell.exec',
			}),
		).toBe('owner');
	});
});
