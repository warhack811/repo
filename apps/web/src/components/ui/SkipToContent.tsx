import type { ReactElement } from 'react';

export function SkipToContent(): ReactElement {
	return (
		<a href="#main-content" className="runa-skip-link">
			Ana içeriğe atla
		</a>
	);
}
