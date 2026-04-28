import type { ReactNode } from 'react';

export type MarkdownBlock =
	| {
			readonly type: 'code';
			readonly code: string;
			readonly language?: string;
	  }
	| {
			readonly level: 1 | 2 | 3;
			readonly text: string;
			readonly type: 'heading';
	  }
	| {
			readonly ordered: boolean;
			readonly items: readonly string[];
			readonly type: 'list';
	  }
	| {
			readonly rows: readonly (readonly string[])[];
			readonly type: 'table';
	  }
	| {
			readonly text: string;
			readonly type: 'paragraph';
	  };

export type InlineToken =
	| {
			readonly text: string;
			readonly type: 'text';
	  }
	| {
			readonly text: string;
			readonly type: 'code';
	  }
	| {
			readonly href: string;
			readonly label: string;
			readonly type: 'link';
	  };

export type InlineRenderer = (content: string) => ReactNode;
