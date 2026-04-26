import type { ReactElement } from 'react';

type EmptyStateProps = Readonly<{
	onSubmitSuggestion: (prompt: string) => void;
}>;

const suggestions = [
	{
		label: 'Bir konuyu kaynaklariyla toparla',
		prompt:
			'Bu konuyu kaynaklariyla arastir, en onemli noktalarini ayir ve kisa bir karar notu hazirla: ',
	},
	{
		label: 'Bu projede kaldigimiz yeri ozetle',
		prompt:
			'Bu projede mevcut baglama gore kaldigimiz yeri ozetle ve sonraki en mantikli adimi oner.',
	},
	{
		label: 'Bir dosya veya fikri birlikte netlestir',
		prompt:
			'Su dosya veya fikri inceleyip eksikleri, riskleri ve uygulanabilir sonraki adimi netlestir: ',
	},
	{
		label: 'Izin gerektiren bir isi hazirla',
		prompt: 'Bu isi yapmadan once gerekli adimlari ve benden onay isteyecegin noktayi hazirla: ',
	},
] as const;

export function EmptyState({ onSubmitSuggestion }: EmptyStateProps): ReactElement {
	return (
		<section className="runa-chat-empty-state" aria-labelledby="runa-empty-state-heading">
			<div className="runa-chat-empty-state__copy">
				<div className="runa-eyebrow">RUNA</div>
				<h2 id="runa-empty-state-heading">Bugun neyi birlikte ilerletelim?</h2>
				<p>
					Bir fikri netlestirebilir, kaynakli arastirma isteyebilir, proje baglamini toparlatabilir
					veya onay isteyen isleri sakin bir akisla hazirlatabilirsin.
				</p>
			</div>
			<div className="runa-chat-suggestion-grid">
				{suggestions.map((suggestion) => (
					<button
						key={suggestion.label}
						type="button"
						className="runa-chat-suggestion"
						onClick={() => onSubmitSuggestion(suggestion.prompt)}
					>
						{suggestion.label}
					</button>
				))}
			</div>
		</section>
	);
}
