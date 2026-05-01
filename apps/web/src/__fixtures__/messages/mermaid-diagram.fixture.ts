export const mermaidDiagramFixture = [
	'```mermaid',
	'graph TD',
	'    A[Search] --> B[Normalize]',
	'    B --> C[Dedup]',
	'    C --> D[Evidence]',
	'```',
].join('\n');
