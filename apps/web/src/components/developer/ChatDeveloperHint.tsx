import type { ReactElement } from 'react';

export function ChatDeveloperHint(): ReactElement {
	return (
		<section
			className="runa-card runa-card--subtle runa-developer-chatdeveloperhint-1"
			aria-label="Developer Mode notice"
		>
			<div className="runa-developer-chatdeveloperhint-2">Developer Mode kapalı</div>
			<div className="runa-subtle-copy">
				Ham timeline, geçmiş çalÄ±şmalar ve teknik izler ikinci katmanda tutulur. İhtiyaç
				olduğunda navigation içinden Developer Mode'u açabilirsin.
			</div>
		</section>
	);
}
