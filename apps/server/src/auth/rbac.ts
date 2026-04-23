import type { AuthContext, AuthMetadata, ToolDefinition } from '@runa/types';

export const authorizationRoles = ['anonymous', 'viewer', 'editor', 'owner', 'admin'] as const;

export type AuthorizationRole = (typeof authorizationRoles)[number];

export class AuthorizationError extends Error {
	readonly code = 'AUTHORIZATION_FORBIDDEN';
	readonly statusCode = 403;

	constructor(message: string) {
		super(message);
		this.name = 'AuthorizationError';
	}
}

function normalizeOptionalString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

interface AuthorizationMetadataCandidate extends AuthMetadata {
	readonly role?: unknown;
	readonly roles?: unknown;
	readonly runa_role?: unknown;
}

function readRoleMetadataValue(metadata: AuthMetadata | undefined): AuthorizationRole | undefined {
	if (!metadata) {
		return undefined;
	}

	const candidate = metadata as AuthorizationMetadataCandidate;
	const runaRole = normalizeOptionalString(candidate.runa_role);

	if (runaRole && authorizationRoles.includes(runaRole as AuthorizationRole)) {
		return runaRole as AuthorizationRole;
	}

	const role = normalizeOptionalString(candidate.role);

	if (role && authorizationRoles.includes(role as AuthorizationRole)) {
		return role as AuthorizationRole;
	}

	const roles = candidate.roles;

	if (Array.isArray(roles)) {
		for (const value of roles) {
			const candidate = normalizeOptionalString(value);

			if (candidate && authorizationRoles.includes(candidate as AuthorizationRole)) {
				return candidate as AuthorizationRole;
			}
		}
	}

	return undefined;
}

function toRoleWeight(role: AuthorizationRole): number {
	switch (role) {
		case 'anonymous':
			return 0;
		case 'viewer':
			return 1;
		case 'editor':
			return 2;
		case 'owner':
			return 3;
		case 'admin':
			return 4;
	}
}

export function hasAuthorizationRole(
	role: AuthorizationRole,
	requiredRole: AuthorizationRole,
): boolean {
	return toRoleWeight(role) >= toRoleWeight(requiredRole);
}

export function resolveAuthorizationRole(authContext: AuthContext | undefined): AuthorizationRole {
	if (!authContext || authContext.principal.kind === 'anonymous') {
		return 'anonymous';
	}

	if (authContext.principal.kind === 'service') {
		return 'admin';
	}

	return (
		readRoleMetadataValue(authContext.claims?.app_metadata) ??
		readRoleMetadataValue(authContext.user?.metadata) ??
		'editor'
	);
}

export function requireAuthorizationRole(
	authContext: AuthContext | undefined,
	requiredRole: Exclude<AuthorizationRole, 'anonymous'>,
	resourceLabel: string,
): AuthorizationRole {
	const role = resolveAuthorizationRole(authContext);

	if (!hasAuthorizationRole(role, requiredRole)) {
		throw new AuthorizationError(
			`${resourceLabel} requires ${requiredRole} authorization. Current role: ${role}.`,
		);
	}

	return role;
}

export function resolveMinimumToolAuthorizationRole(
	toolDefinition: Pick<ToolDefinition, 'metadata' | 'name'>,
): Exclude<AuthorizationRole, 'anonymous'> {
	if (
		toolDefinition.metadata.side_effect_level === 'execute' ||
		toolDefinition.name === 'shell.exec'
	) {
		return 'owner';
	}

	if (toolDefinition.metadata.side_effect_level === 'write') {
		return 'editor';
	}

	return 'viewer';
}
