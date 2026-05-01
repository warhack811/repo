import { Button } from '@/components/ui/button';
import { uiText } from '@/lib/i18n/strings';
import { RotateCcw } from 'lucide-react';
import { classifyTransportError } from './error-catalog';

type TransportErrorBannerProps = {
	error: Error;
	onRetry: () => void;
};

export function TransportErrorBanner({ error, onRetry }: TransportErrorBannerProps) {
	const state = classifyTransportError(error);

	return (
		<div className="transport-error" data-error-kind={state.kind}>
			<span>{state.label}</span>
			<Button onClick={onRetry} type="button" variant="secondary">
				<RotateCcw className="size-4" /> {uiText.transport.retry}
			</Button>
		</div>
	);
}
