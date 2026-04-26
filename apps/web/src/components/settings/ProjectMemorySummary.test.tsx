import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProjectMemorySummary } from './ProjectMemorySummary.js';

describe('ProjectMemorySummary', () => {
	it('states when live project memory is not connected', () => {
		const markup = renderToStaticMarkup(<ProjectMemorySummary status="unavailable" />);

		expect(markup).toContain('Proje hafizasi');
		expect(markup).toContain('Bagli degil');
		expect(markup).toContain('henuz baglanmadi');
	});

	it('renders provided summary without inventing source counts', () => {
		const markup = renderToStaticMarkup(
			<ProjectMemorySummary
				sourceCount={2}
				status="available"
				summary="Repo docs and progress ledger are attached."
			/>,
		);

		expect(markup).toContain('Repo docs and progress ledger are attached.');
		expect(markup).toContain('2 kaynak');
	});
});
