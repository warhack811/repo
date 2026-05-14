import { Code2, FileText, MonitorSmartphone, Search, Sparkles, Wand2 } from 'lucide-react';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { HafizaMark } from '../ui/HafizaMark.js';

const onboardingStorageKey = 'runa.onboarding.completed';

type OnboardingWizardProps = Readonly<{
	onSubmitPrompt: (prompt: string) => void;
}>;

type Purpose = 'personal' | 'research' | 'work';

const promptCards = [
	{
		icon: Code2,
		label: 'Kod incele',
		prompt: 'Bu kodu kalite, risk ve test eksikleri acisindan incele.',
	},
	{
		icon: Search,
		label: 'Arastirma',
		prompt: 'Bu konu hakkinda guvenilir kaynaklarla kisa bir arastirma plani hazirla.',
	},
	{
		icon: FileText,
		label: 'Dokuman',
		prompt: 'Bu notlari daha net, uygulanabilir bir gorev dokumanina cevir.',
	},
	{
		icon: MonitorSmartphone,
		label: 'Masaustu gorev',
		prompt: 'Bilgisayarimda yapilacak bu isi adimlara ayir ve onay gereken yerleri belirt.',
	},
	{
		icon: Wand2,
		label: 'Dosya analizi',
		prompt: 'Bu dosyayi ozetle, riskleri ve sonraki aksiyonlari cikar.',
	},
	{
		icon: Sparkles,
		label: 'Devam et',
		prompt: 'Onceki konusmadan kaldigimiz isi toparla ve bir sonraki net adimi oner.',
	},
] as const;

function readCompletedState(): boolean {
	if (typeof window === 'undefined') {
		return true;
	}

	return window.localStorage.getItem(onboardingStorageKey) === 'true';
}

export function OnboardingWizard({ onSubmitPrompt }: OnboardingWizardProps): ReactElement | null {
	const [isOpen, setIsOpen] = useState(false);
	const [step, setStep] = useState(0);
	const [workspaceName, setWorkspaceName] = useState('Runa workspace');
	const [purpose, setPurpose] = useState<Purpose>('work');

	useEffect(() => {
		setIsOpen(!readCompletedState());
	}, []);

	function complete(): void {
		window.localStorage.setItem(onboardingStorageKey, 'true');
		setIsOpen(false);
	}

	function submitPrompt(prompt: string): void {
		onSubmitPrompt(prompt);
		complete();
	}

	if (!isOpen) {
		return null;
	}

	return (
		<aside className="runa-onboarding-shell" aria-label="Runa baslangic">
			<section className="runa-onboarding" aria-live="polite">
				<div className="runa-onboarding__progress" aria-label={`Baslangic adimi ${step + 1} / 3`}>
					{[0, 1, 2].map((item) => (
						<span key={item} className={item <= step ? 'is-active' : undefined} />
					))}
				</div>

				{step === 0 ? (
					<div className="runa-onboarding__page">
						<HafizaMark
							weight="bold"
							variant="brand"
							className="runa-onboarding__mark"
							aria-label="Runa"
						/>
						<h2>Calisma ortagin hazir.</h2>
						<p>
							Runa sohbetten baslar, onay isteyen islerde seni karar noktasina getirir ve kalabaligi
							azaltir.
						</p>
						<div className="runa-onboarding__actions">
							<button
								type="button"
								className="runa-button runa-button--primary"
								onClick={() => setStep(1)}
							>
								Ileri
							</button>
							<button
								type="button"
								className="runa-button runa-button--secondary"
								onClick={complete}
							>
								Atla
							</button>
						</div>
					</div>
				) : null}

				{step === 1 ? (
					<div className="runa-onboarding__page">
						<h2>Calisma ve cihaz modelini sec.</h2>
						<p>
							Sohbet ayni kalir; masaustu islemleri sectigin cihazda calisir. Yeni cihazi ayni
							hesapla giris yaparak eklersin.
						</p>
						<label>
							<span>Calisma alani adi</span>
							<input
								className="runa-input"
								value={workspaceName}
								onChange={(event) => setWorkspaceName(event.target.value)}
							/>
						</label>
						<div
							className="runa-onboarding__segments"
							role="radiogroup"
							aria-label="Kullanim amaci"
						>
							{(['work', 'research', 'personal'] as const).map((item) => (
								<button
									key={item}
									type="button"
									aria-pressed={purpose === item}
									className={purpose === item ? 'is-active' : undefined}
									onClick={() => setPurpose(item)}
								>
									{item === 'work' ? 'Is' : item === 'research' ? 'Arastirma' : 'Kisisel'}
								</button>
							))}
						</div>
						<div className="runa-onboarding__actions">
							<button
								type="button"
								className="runa-button runa-button--secondary"
								onClick={() => setStep(0)}
							>
								Geri
							</button>
							<button
								type="button"
								className="runa-button runa-button--primary"
								onClick={() => setStep(2)}
							>
								Ileri
							</button>
							<button
								type="button"
								className="runa-button runa-button--secondary"
								onClick={complete}
							>
								Atla
							</button>
						</div>
					</div>
				) : null}

				{step === 2 ? (
					<div className="runa-onboarding__page">
						<h2>{workspaceName.trim() || 'Calisma alani'} icin ilk isi sec.</h2>
						<div className="runa-onboarding__prompt-grid">
							{promptCards.map((card) => {
								const Icon = card.icon;
								return (
									<button key={card.label} type="button" onClick={() => submitPrompt(card.prompt)}>
										<Icon aria-hidden="true" size={18} />
										<span>{card.label}</span>
									</button>
								);
							})}
						</div>
						<div className="runa-onboarding__actions">
							<button
								type="button"
								className="runa-button runa-button--secondary"
								onClick={() => setStep(1)}
							>
								Geri
							</button>
							<button type="button" className="runa-button runa-button--primary" onClick={complete}>
								Bos sohbetle basla
							</button>
							<button
								type="button"
								className="runa-button runa-button--secondary"
								onClick={complete}
							>
								Atla
							</button>
						</div>
					</div>
				) : null}
			</section>
		</aside>
	);
}
