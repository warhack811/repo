import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { LoginPage } from './LoginPage.js';

function renderLoginPage(): string {
	return renderToStaticMarkup(
		<MemoryRouter>
			<LoginPage
				authContext={null}
				authError={null}
				authNotice={null}
				authStatus="anonymous"
				hasStoredBearerToken={false}
				isAuthPending={false}
				onAuthenticateWithToken={async () => undefined}
				onClearAuthToken={async () => undefined}
				onLoginWithPassword={async () => undefined}
				onRefreshAuthContext={async () => undefined}
				onSignupWithPassword={async () => undefined}
				onStartLocalDevSession={() => undefined}
				onStartOAuth={() => undefined}
			/>
		</MemoryRouter>,
	);
}

describe('first-impression polish surfaces', () => {
	it('keeps login first impression product-facing without raw auth labels', () => {
		const markup = renderLoginPage();

		expect(markup).toContain('Runa ile devam et');
		expect(markup).toContain('Calisma alanin hazirlaniyor');
		expect(markup).toContain('Gelistirici girisi');
		expect(markup).not.toContain('principal');
		expect(markup).not.toContain('stored token seam');
		expect(markup).not.toContain('Mevcut tarayici auth durumu');
	});
});
