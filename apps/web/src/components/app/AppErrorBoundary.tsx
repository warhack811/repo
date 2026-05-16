import { Component, type ErrorInfo, type ReactElement, type ReactNode } from 'react';

import { RunaButton } from '../ui/RunaButton.js';
import { getAppErrorRecoveryCopy } from './appErrorBoundaryCopy.js';

import styles from './AppErrorBoundary.module.css';

export type AppErrorBoundaryTone = 'root' | 'route';

export type AppErrorBoundaryFallbackAction = Readonly<{
	label: string;
	onClick: () => void;
}>;

export type AppErrorBoundaryProps = Readonly<{
	children: ReactNode;
	resetKey?: string | number | null;
	tone?: AppErrorBoundaryTone;
	onRecoverToChat?: () => void;
	onError?: (error: Error, errorInfo: ErrorInfo) => void;
}>;

export type AppErrorBoundaryState = Readonly<{
	errorId: number;
	hasError: boolean;
}>;

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
	constructor(props: AppErrorBoundaryProps) {
		super(props);
		this.state = { errorId: 0, hasError: false };
		this.handleRetry = this.handleRetry.bind(this);
		this.handleRecover = this.handleRecover.bind(this);
	}

	static getDerivedStateFromError(): Partial<AppErrorBoundaryState> {
		return { hasError: true };
	}

	override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		this.props.onError?.(error, errorInfo);
	}

	override componentDidUpdate(prevProps: AppErrorBoundaryProps): void {
		if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
			this.resetBoundary();
		}
	}

	private resetBoundary(): void {
		this.setState((prev) => ({
			errorId: prev.errorId + 1,
			hasError: false,
		}));
	}

	private handleRetry(): void {
		this.resetBoundary();
	}

	private handleRecover(): void {
		this.resetBoundary();
		this.props.onRecoverToChat?.();
	}

	override render(): ReactNode {
		if (this.state.hasError) {
			return (
				<AppErrorFallback
					onRetry={this.handleRetry}
					onRecover={this.props.onRecoverToChat ? this.handleRecover : undefined}
				/>
			);
		}

		return this.props.children;
	}
}

type AppErrorFallbackProps = Readonly<{
	onRetry: () => void;
	onRecover?: () => void;
}>;

function AppErrorFallback({ onRetry, onRecover }: AppErrorFallbackProps): ReactElement {
	const copy = getAppErrorRecoveryCopy();

	return (
		<div className={styles['root']} role="alert">
			<div className={styles['surface']}>
				<span className={styles['eyebrow']}>{copy.eyebrow}</span>
				<h1 className={styles['title']}>{copy.title}</h1>
				<p className={styles['description']}>{copy.description}</p>
				<div className={styles['actions']}>
					<RunaButton variant="primary" onClick={onRetry}>
						{copy.retryLabel}
					</RunaButton>
					{onRecover && (
						<RunaButton variant="secondary" onClick={onRecover}>
							{copy.recoverLabel}
						</RunaButton>
					)}
				</div>
			</div>
		</div>
	);
}
