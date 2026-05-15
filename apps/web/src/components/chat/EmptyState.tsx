import { Bug, Code2, FileText, Search } from 'lucide-react';
import type { ReactElement } from 'react';
import { HafizaMark } from '../ui/HafizaMark.js';
import { deriveEmptyStateModel } from './emptyStateModel.js';
import type { EmptyStateContext, EmptyStateSuggestionKind } from './emptyStateModel.js';

type EmptyStateProps = Readonly<{
	activeDeviceLabel?: string | null;
	conversationCount?: number;
	onSubmitSuggestion: (prompt: string) => void;
	workingDirectory?: string | null;
}>;

const SUGGESTION_ICONS: Record<EmptyStateSuggestionKind, ReactElement> = {
	code: <Code2 aria-hidden="true" size={18} />,
	review: <Bug aria-hidden="true" size={18} />,
	research: <Search aria-hidden="true" size={18} />,
	document: <FileText aria-hidden="true" size={18} />,
};

export function EmptyState({
	activeDeviceLabel,
	conversationCount,
	onSubmitSuggestion,
	workingDirectory,
}: EmptyStateProps): ReactElement {
	const context: EmptyStateContext = {
		activeDeviceLabel: activeDeviceLabel ?? null,
		conversationCount: conversationCount ?? 0,
		workingDirectory: workingDirectory ?? null,
	};
	const model = deriveEmptyStateModel(context);

	return (
		<aside className="runa-chat-empty-state" aria-label="Başlangıç önerileri">
			<section className="runa-chat-empty-hero">
				<HafizaMark
					weight="bold"
					variant="brand"
					aria-hidden
					className="runa-chat-empty-hero__mark"
				/>
				<h1 className="runa-chat-empty-hero__title">{model.greeting}</h1>
				<p className="runa-chat-empty-hero__lead">{model.lead}</p>
				{model.contextLine ? (
					<p className="runa-chat-empty-hero__context">{model.contextLine}</p>
				) : null}
				{model.contextChips.length > 0 ? (
					<div className="runa-chat-empty-context">
						{model.contextChips.map((chip) => (
							<span key={chip} className="runa-chat-empty-context__chip">
								{chip}
							</span>
						))}
					</div>
				) : null}
			</section>
			<div className="runa-chat-suggestion-grid">
				{model.suggestions.map((suggestion) => {
					const icon = SUGGESTION_ICONS[suggestion.kind];
					return (
						<button
							key={suggestion.kind}
							type="button"
							aria-label={`${suggestion.label}: ${suggestion.description}`}
							className="runa-chat-suggestion"
							onClick={() => onSubmitSuggestion(suggestion.prompt)}
						>
							{icon}
							<span className="runa-chat-suggestion__copy">
								<strong className="runa-chat-suggestion__label">{suggestion.label}</strong>
								<span className="runa-chat-suggestion__description">{suggestion.description}</span>
							</span>
						</button>
					);
				})}
			</div>
			<p className="runa-chat-empty-state__tip">İpucu: Ctrl+K ile komut paleti açılır.</p>
		</aside>
	);
}
