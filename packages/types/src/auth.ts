export const authProviders = ['supabase', 'internal', 'external_jwt'] as const;

export type AuthProvider = (typeof authProviders)[number];

export const authIdentityProviders = [
	'email_password',
	'magic_link',
	'oauth',
	'desktop_agent',
	'service_token',
] as const;

export type AuthIdentityProvider = (typeof authIdentityProviders)[number];

export const oauthProviders = [
	'google',
	'github',
	'apple',
	'azure',
	'discord',
	'gitlab',
	'notion',
	'slack',
	'custom',
] as const;

export type OAuthProvider = (typeof oauthProviders)[number];

export const authRoles = ['anon', 'authenticated', 'service_role'] as const;

export type AuthRole = (typeof authRoles)[number];

export const authTransports = ['http', 'websocket', 'desktop_bridge', 'internal'] as const;

export type AuthTransport = (typeof authTransports)[number];

export interface AuthScope {
	readonly tenant_id?: string;
	readonly workspace_id?: string;
	readonly workspace_ids?: readonly string[];
}

export type AuthMetadata = Readonly<Record<string, unknown>>;

export interface AuthIdentity {
	readonly identity_id: string;
	readonly provider: AuthProvider;
	readonly identity_provider: AuthIdentityProvider;
	readonly provider_subject: string;
	readonly email?: string;
	readonly oauth_provider?: OAuthProvider;
	readonly linked_at?: string;
}

export interface AuthUser {
	readonly user_id: string;
	readonly primary_provider: AuthProvider;
	readonly email?: string;
	readonly email_verified: boolean;
	readonly display_name?: string;
	readonly avatar_url?: string;
	readonly status: 'active' | 'invited' | 'suspended';
	readonly scope: AuthScope;
	readonly identities: readonly AuthIdentity[];
	readonly created_at?: string;
	readonly updated_at?: string;
	readonly metadata?: AuthMetadata;
}

export interface AuthSession {
	readonly session_id: string;
	readonly user_id: string;
	readonly provider: AuthProvider;
	readonly identity_provider: AuthIdentityProvider;
	readonly scope: AuthScope;
	readonly issued_at?: string;
	readonly expires_at?: string;
	readonly refreshed_at?: string;
	readonly impersonated_by?: string;
}

export interface AuthClaims {
	readonly sub: string;
	readonly role?: AuthRole;
	readonly session_id?: string;
	readonly aud?: string | readonly string[];
	readonly iss?: string;
	readonly iat?: number;
	readonly exp?: number;
	readonly email?: string;
	readonly email_verified?: boolean;
	readonly scope: AuthScope;
	readonly app_metadata?: AuthMetadata;
	readonly user_metadata?: AuthMetadata;
	readonly raw_claims?: AuthMetadata;
}

export interface AnonymousPrincipal {
	readonly kind: 'anonymous';
	readonly role: 'anon';
	readonly provider: 'internal';
	readonly scope: AuthScope;
}

export interface AuthenticatedPrincipal {
	readonly kind: 'authenticated';
	readonly role: 'authenticated';
	readonly provider: AuthProvider;
	readonly user_id: string;
	readonly session_id?: string;
	readonly email?: string;
	readonly scope: AuthScope;
}

export interface ServicePrincipal {
	readonly kind: 'service';
	readonly role: 'service_role';
	readonly provider: AuthProvider;
	readonly service_name: string;
	readonly session_id?: string;
	readonly scope: AuthScope;
}

export type AuthPrincipal = AnonymousPrincipal | AuthenticatedPrincipal | ServicePrincipal;

export interface AuthContext {
	readonly principal: AuthPrincipal;
	readonly transport: AuthTransport;
	readonly claims?: AuthClaims;
	readonly session?: AuthSession;
	readonly user?: AuthUser;
	readonly bearer_token_present?: boolean;
	readonly request_id?: string;
}

export interface AuthEmailPasswordCredentials {
	readonly email: string;
	readonly password: string;
}

export interface AuthPasswordSignupRequest extends AuthEmailPasswordCredentials {}

export interface AuthSessionTokens {
	readonly access_token: string;
	readonly expires_at?: number;
	readonly expires_in?: number;
	readonly refresh_token?: string;
	readonly token_type?: string;
}

export interface AuthenticatedAuthActionResponse {
	readonly auth: AuthContext;
	readonly outcome: 'authenticated';
	readonly principal_kind: Extract<AuthContext['principal']['kind'], 'authenticated' | 'service'>;
	readonly session: AuthSessionTokens;
}

export interface VerificationRequiredAuthActionResponse {
	readonly email: string;
	readonly message: string;
	readonly outcome: 'verification_required';
}

export type AuthPasswordActionResponse =
	| AuthenticatedAuthActionResponse
	| VerificationRequiredAuthActionResponse;

export const authLogoutRemoteStatuses = ['skipped', 'succeeded'] as const;

export type AuthLogoutRemoteStatus = (typeof authLogoutRemoteStatuses)[number];

export interface AuthLogoutResponse {
	readonly message: string;
	readonly outcome: 'logged_out';
	readonly remote_sign_out: AuthLogoutRemoteStatus;
}
