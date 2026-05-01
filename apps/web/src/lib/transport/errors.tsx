import { Button } from '@/components/ui/button';
import { uiText } from '@/lib/i18n/strings';
import { RotateCcw } from 'lucide-react';
import {
	type TransportErrorCode,
	classifyTransportError,
	getTransportErrorState,
} from './error-catalog';

type TransportErrorBannerProps = Readonly<
	{
		onRetry: () => void;
	} & ({ code: TransportErrorCode; error?: never } | { code?: never; error: Error })
>;

export function TransportErrorBanner({ code, error, onRetry }: TransportErrorBannerProps) {
	const state = code ? getTransportErrorState(code) : classifyTransportError(error);

	return (
		<div className="transport-error" data-error-kind={state.kind} role="alert">
			<span>{state.label}</span>
			<Button onClick={onRetry} type="button" variant="secondary">
				<RotateCcw className="size-4" /> {uiText.transport.retry}
			</Button>
		</div>
	);
}
