import type { CSSProperties, ReactElement } from 'react';

import type { OAuthProvider } from '@runa/types';

import { secondaryButtonStyle, subcardStyle } from '../../lib/chat-styles.js';
import { uiCopy } from '../../localization/copy.js';

const providerGridStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))',
	gap: '10px',
};

const providerButtonStyle: CSSProperties = {
	...secondaryButtonStyle,
	width: '100%',
	minHeight: '52px',
	fontWeight: 700,
};

const providerDescriptionStyle: CSSProperties = {
	margin: 0,
	color: 'hsl(var(--color-text-soft))',
	fontSize: '13px',
	lineHeight: 1.6,
};

const providers = [
	{
		label: uiCopy.auth.continueWithGoogle,
		provider: 'google',
	},
	{
		label: uiCopy.auth.continueWithGithub,
		provider: 'github',
	},
] as const satisfies readonly {
	readonly label: string;
	readonly provider: Extract<OAuthProvider, 'github' | 'google'>;
}[];

type OAuthButtonsProps = Readonly<{
	isDisabled: boolean;
	onStartOAuth: (provider: Extract<OAuthProvider, 'github' | 'google'>) => void;
}>;

export function OAuthButtons({ isDisabled, onStartOAuth }: OAuthButtonsProps): ReactElement {
	return (
		<div className="runa-card runa-card--subtle runa-card--soft-grid" style={subcardStyle}>
			<div style={providerGridStyle}>
				{providers.map((provider) => (
					<button
						key={provider.provider}
						type="button"
						disabled={isDisabled}
						onClick={() => onStartOAuth(provider.provider)}
						aria-label={provider.label}
						style={{
							...providerButtonStyle,
							opacity: isDisabled ? 0.6 : 1,
						}}
						className="runa-button runa-button--secondary"
					>
						{provider.label}
					</button>
				))}
			</div>
			<p style={providerDescriptionStyle}>{uiCopy.auth.oauthDescription}</p>
		</div>
	);
}
