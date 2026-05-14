import type { ReactElement } from 'react';

import type { OAuthProvider } from '@runa/types';
import { uiCopy } from '../../localization/copy.js';

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
		<div className="runa-auth-oauthbuttons-1">
			<div className="runa-auth-oauthbuttons-2">
				{providers.map((provider) => (
					<button
						key={provider.provider}
						type="button"
						disabled={isDisabled}
						onClick={() => onStartOAuth(provider.provider)}
						aria-label={provider.label}
						className="runa-button runa-button--secondary runa-auth-oauthbuttons-3"
					>
						{provider.label}
					</button>
				))}
			</div>
			<p className="runa-auth-oauthbuttons-4">{uiCopy.auth.oauthDescription}</p>
		</div>
	);
}
