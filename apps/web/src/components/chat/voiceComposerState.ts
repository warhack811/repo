export type VoiceInputStatus = 'denied' | 'error' | 'idle' | 'listening' | 'unsupported';

export type VoiceComposerStateInput = Readonly<{
	canReadLatestResponse: boolean;
	isListening: boolean;
	isSpeechPlaybackSupported: boolean;
	isSpeaking: boolean;
	isVoiceSupported: boolean;
	permissionDenied?: boolean;
	voiceInputStatus?: VoiceInputStatus;
	voiceStatusMessage?: string | null;
}>;

export type VoiceComposerState = Readonly<{
	inputButtonLabel: string;
	inputButtonAriaLabel: string;
	inputButtonDisabled: boolean;
	inputStatusText: string;
	inputStatusTone: 'default' | 'error' | 'listening' | 'unsupported';
	readButtonLabel: string;
	readButtonAriaLabel: string;
	readButtonDisabled: boolean;
	readStatusText: string | null;
}>;

export function deriveVoiceComposerState(input: VoiceComposerStateInput): VoiceComposerState {
	const isUnsupported = !input.isVoiceSupported || input.voiceInputStatus === 'unsupported';
	const isDenied = Boolean(input.permissionDenied) || input.voiceInputStatus === 'denied';
	const isListening = input.isListening || input.voiceInputStatus === 'listening';

	let inputButtonLabel: string;
	let inputButtonAriaLabel: string;
	let inputButtonDisabled: boolean;
	let inputStatusText: string;
	let inputStatusTone: VoiceComposerState['inputStatusTone'];

	if (isUnsupported) {
		inputButtonLabel = 'Sesle yaz';
		inputButtonAriaLabel = 'Sesle yaz';
		inputButtonDisabled = true;
		inputStatusText = 'Bu tarayıcı sesle yazmayı desteklemiyor. Yazıyla devam edebilirsin.';
		inputStatusTone = 'unsupported';
	} else if (isDenied) {
		inputButtonLabel = 'Sesle yaz';
		inputButtonAriaLabel = 'Sesle yaz';
		inputButtonDisabled = true;
		inputStatusText = 'Mikrofon izni kapalı. Tarayıcı izinlerinden açıp yeniden deneyebilirsin.';
		inputStatusTone = 'error';
	} else if (isListening) {
		inputButtonLabel = 'Dinlemeyi durdur';
		inputButtonAriaLabel = 'Dinlemeyi durdur';
		inputButtonDisabled = false;
		inputStatusText = 'Dinliyorum. Bitirdiğinde durdurabilirsin.';
		inputStatusTone = 'listening';
	} else if (input.voiceInputStatus === 'error') {
		inputButtonLabel = 'Sesle yaz';
		inputButtonAriaLabel = 'Sesle yaz';
		inputButtonDisabled = false;
		inputStatusText =
			input.voiceStatusMessage ?? 'Sesle yazma başlatılamadı. Tekrar deneyebilirsin.';
		inputStatusTone = 'error';
	} else {
		inputButtonLabel = 'Sesle yaz';
		inputButtonAriaLabel = 'Sesle yaz';
		inputButtonDisabled = false;
		inputStatusText = 'Mikrofonu açıp kısa bir not söyleyebilirsin.';
		inputStatusTone = 'default';
	}

	let readButtonLabel: string;
	let readButtonAriaLabel: string;
	let readButtonDisabled: boolean;
	let readStatusText: string | null;

	if (input.isSpeaking) {
		readButtonLabel = 'Okumayı durdur';
		readButtonAriaLabel = 'Okumayı durdur';
		readButtonDisabled = false;
		readStatusText = null;
	} else if (!input.canReadLatestResponse) {
		readButtonLabel = 'Son yanıtı oku';
		readButtonAriaLabel = 'Son yanıtı oku';
		readButtonDisabled = true;
		readStatusText = 'Son yanıt yoksa okuma kapalı kalır.';
	} else if (!input.isSpeechPlaybackSupported) {
		readButtonLabel = 'Son yanıtı oku';
		readButtonAriaLabel = 'Son yanıtı oku';
		readButtonDisabled = true;
		readStatusText = 'Bu tarayıcı sesli okumayı desteklemiyor.';
	} else {
		readButtonLabel = 'Son yanıtı oku';
		readButtonAriaLabel = 'Son yanıtı oku';
		readButtonDisabled = false;
		readStatusText = null;
	}

	return {
		inputButtonLabel,
		inputButtonAriaLabel,
		inputButtonDisabled,
		inputStatusText,
		inputStatusTone,
		readButtonLabel,
		readButtonAriaLabel,
		readButtonDisabled,
		readStatusText,
	};
}
