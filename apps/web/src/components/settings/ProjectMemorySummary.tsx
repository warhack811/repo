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
				body: 'Bu calisma alani icin kayitli proje hafizasi hazir.',
				label: 'Hazir',
			};
		case 'empty':
			return {
				body: 'Bu calisma alanina henuz proje hafizasi eklenmedi.',
				label: 'Bos',
			};
		case 'unavailable':
			return {
				body: 'Bu alan hazir, fakat canli proje hafizasi kaynagi bu fazda henuz baglanmadi.',
				label: 'Bagli degil',
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
			className="runa-migrated-components-settings-projectmemorysummary-1"
			aria-labelledby="project-memory-heading"
		>
			<div className="runa-migrated-components-settings-projectmemorysummary-2">
				<div className="runa-migrated-components-settings-projectmemorysummary-3">
					Gizlilik ve hafiza
				</div>
				<h2
					id="project-memory-heading"
					className="runa-migrated-components-settings-projectmemorysummary-4"
				>
					Proje hafizasi
				</h2>
				<p className="runa-migrated-components-settings-projectmemorysummary-5">
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
				Hafiza gorunurlugu burada yalniz bilgilendirme icin yer alir; gercek kaynak ve politika
				kontrolleri baglanana kadar veri uydurulmaz.
			</div>
		</section>
	);
}
