import type { ReactElement } from 'react';

import type { RenderBlock } from '../../../ws-types.js';
import styles from './BlockRenderer.module.css';

type TableBlockProps = Readonly<{
	block: Extract<RenderBlock, { type: 'table' }>;
}>;

export function TableBlock({ block }: TableBlockProps): ReactElement {
	return (
		<article className={styles['block']}>
			<div className={styles['headerStack']}>
				<span className={styles['eyebrow']}>Structured table</span>
				<strong className={styles['title']}>{block.payload.caption ?? 'Table'}</strong>
			</div>
			<div className={styles['tableWrap']}>
				<table className={styles['table']}>
					<thead>
						<tr>
							{block.payload.headers.map((header) => (
								<th key={`${block.id}:header:${header}`} scope="col">
									{header}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{block.payload.rows.map((row, rowIndex) => (
							<tr key={`${block.id}:row:${rowIndex}`}>
								{row.map((cell, cellIndex) => (
									<td key={`${block.id}:cell:${rowIndex}:${cellIndex}`}>{cell}</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</article>
	);
}
