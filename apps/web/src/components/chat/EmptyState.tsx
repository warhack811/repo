import { Code2, FileText, Search } from 'lucide-react';
import type { ReactElement } from 'react';

type EmptyStateProps = Readonly<{
	onSubmitSuggestion: (prompt: string) => void;
}>;

const suggestions = [
	{
		description: 'Değişikliği planla, riski ayır ve güvenle uygula.',
		icon: Code2,
		label: 'Kod yaz veya gözden geçir',
		prompt:
			'Bu kod işini profesyonelce ele al: önce ilgili dosyaları incele, riskleri ayır, sonra gerekli değişikliği yap ve test kanıtlarını raporla. Konu: ',
	},
	{
		description: 'Güvenilir kaynakları ayır, çelişkileri belirt ve karar notu hazırla.',
		icon: Search,
		label: 'Araştır ve özetle',
		prompt:
			'Bu konuyu kaynaklarıyla araştır, en önemli noktalarını ayır ve kısa bir karar notu hazırla: ',
	},
	{
		description: 'Taslak, teknik not veya teslim edilebilir dokümanı birlikte şekillendir.',
		icon: FileText,
		label: 'Doküman hazırla',
		prompt: 'Bu dokümanı hedef kitleye göre net, profesyonel ve uygulanabilir hale getir: ',
	},
] as const;

export function EmptyState({ onSubmitSuggestion }: EmptyStateProps): ReactElement {
	return (
		<aside className="runa-chat-empty-state" aria-label="Başlangıç önerileri">
			<div className="runa-chat-suggestion-grid">
				{suggestions.map((suggestion) => {
					const Icon = suggestion.icon;
					return (
						<button
							key={suggestion.label}
							type="button"
							aria-label={`${suggestion.label}: ${suggestion.description}`}
							className="runa-chat-suggestion"
							onClick={() => onSubmitSuggestion(suggestion.prompt)}
						>
							<Icon aria-hidden="true" size={18} />
							<span>{suggestion.label}</span>
						</button>
					);
				})}
			</div>
			<p className="runa-chat-empty-state__tip">İpucu: Ctrl+K ile komut paleti açılır.</p>
		</aside>
	);
}
