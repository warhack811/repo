import { BookOpen, Code2, FileText, History, MonitorUp, Search } from 'lucide-react';
import type { ReactElement } from 'react';

type EmptyStateProps = Readonly<{
	onSubmitSuggestion: (prompt: string) => void;
}>;

const suggestions = [
	{
		description: 'Bir degisikligi planla, riskleri ayir ve uygulanabilir patch yolunu netlestir.',
		icon: Code2,
		label: 'Kod yaz veya gozden gecir',
		prompt:
			'Bu kod isini profesyonelce ele al: once ilgili dosyalari incele, riskleri ayir, sonra gerekli degisikligi yap ve test kanitlarini raporla. Konu: ',
	},
	{
		description: 'Guvenilir kaynaklari ayir, celiskileri belirt ve karar notu hazirla.',
		icon: Search,
		label: 'Arastir ve ozetle',
		prompt:
			'Bu konuyu kaynaklariyla arastir, en onemli noktalarini ayir ve kisa bir karar notu hazirla: ',
	},
	{
		description: 'Taslak, teknik not veya teslim edilebilir dokumani birlikte sekillendir.',
		icon: FileText,
		label: 'Dokuman hazirla',
		prompt: 'Bu dokumani hedef kitleye gore net, profesyonel ve uygulanabilir hale getir: ',
	},
	{
		description:
			'Bagli cihaz varsa kontrollu masaustu adimi planla; yoksa baglama yolunu netlestir.',
		icon: MonitorUp,
		label: 'Masaustumde gorev baslat',
		prompt:
			'Masaustu companion ile yapilacak isi onayli ve guvenli adimlara bol; cihaz bagli degilse once nasil baglanacagini netlestir. Is: ',
	},
	{
		description: 'Dosya, ekran goruntusu veya fikirdeki eksik ve sonraki adimi cikar.',
		icon: BookOpen,
		label: 'Bir dosyayi analiz et',
		prompt:
			'Su dosya veya fikri inceleyip eksikleri, riskleri ve uygulanabilir sonraki adimi netlestir: ',
	},
	{
		description: 'Gecmisi toparla, karari ayir ve kaldigin yerden devam et.',
		icon: History,
		label: 'Onceki konusmadan devam et',
		prompt:
			'Bu projede mevcut baglama gore kaldigimiz yeri ozetle, acik karar noktalarini ayir ve sonraki en mantikli adimi oner.',
	},
] as const;

export function EmptyState({ onSubmitSuggestion }: EmptyStateProps): ReactElement {
	return (
		<aside className="runa-chat-empty-state">
			<div className="runa-chat-empty-state__copy">
				<p className="runa-chat-empty-state__hint">Bugun ne yapmak istersin?</p>
				<p className="runa-subtle-copy">
					Runa kisa bir niyeti alir, gerekirse kaynak, dosya ve onay isteyen adimlari sohbetin
					icinde toparlar.
				</p>
			</div>
			<div className="runa-chat-suggestion-grid">
				{suggestions.map((suggestion) => {
					const Icon = suggestion.icon;
					return (
						<button
							key={suggestion.label}
							type="button"
							className="runa-chat-suggestion"
							onClick={() => onSubmitSuggestion(suggestion.prompt)}
						>
							<Icon aria-hidden="true" size={18} />
							<span>
								<strong>{suggestion.label}</strong>
								<span>{suggestion.description}</span>
							</span>
						</button>
					);
				})}
			</div>
		</aside>
	);
}
