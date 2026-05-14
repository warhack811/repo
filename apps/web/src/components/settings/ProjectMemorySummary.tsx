import type { ReactElement } from 'react';

import { RunaSkeleton } from '../ui/RunaSkeleton.js';

type ProjectMemorySummaryProps = Readonly<{
	isLoading?: boolean;
	sourceCount?: number;
	status: 'available' | 'empty' | 'unavailable';
	summary?: string;
}>;

function getStatusCopy(status: ProjectMemorySummaryProps['status']): {
	readonly body: string;
	readonly label: string;
} {
	switch (status) {
		case 'available':
			return {
				body: 'Bu çalÄ±şma alanı için kayıtlı proje hafızası hazır.',
				label: 'Hazır',
			};
		case 'empty':
			return {
				body: 'Bu çalÄ±şma alanına henüz proje hafızası eklenmedi.',
				label: 'Boş',
			};
		case 'unavailable':
			return {
				body: 'Proje hafızası şu anda bağlı değil.',
				label: 'Bağlı değil',
			};
	}
}

export function ProjectMemorySummary({
	isLoading = false,
	sourceCount,
	status,
	summary,
}: ProjectMemorySummaryProps): ReactElement {
	const statusCopy = getStatusCopy(status);

	return (
		<section
			className="runa-settings-projectmemorysummary-1"
			aria-labelledby="project-memory-heading"
		>
			<div className="runa-settings-projectmemorysummary-2">
				<div className="runa-settings-projectmemorysummary-3">Gizlilik ve hafıza</div>
				<h2 id="project-memory-heading" className="runa-settings-projectmemorysummary-4">
					Proje hafızası
				</h2>
				<p className="runa-settings-projectmemorysummary-5">
					{isLoading ? (
						<output aria-busy="true" className="runa-memory-skeleton">
							<RunaSkeleton variant="text" />
							<RunaSkeleton variant="text" />
						</output>
					) : (
						summary?.trim() || statusCopy.body
					)}
				</p>
			</div>

			<div className="runa-inline-cluster">
				<span className="runa-pill">{statusCopy.label}</span>
				{typeof sourceCount === 'number' ? (
					<span className="runa-pill">{sourceCount} kaynak</span>
				) : null}
			</div>

			<div className="runa-alert runa-alert--info">
				Hafıza görünürlüğü yalnız bilgilendirme içindir; kaynak ve politika kontrolleri
				bağlanana kadar veri uydurulmaz.
			</div>
		</section>
	);
}
