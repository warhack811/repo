import {
	type ReactElement,
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from 'react';
import { createPortal } from 'react-dom';

import styles from './RunaToast.module.css';
import { cx } from './ui-utils.js';

export type RunaToastTone = 'danger' | 'info' | 'success' | 'warning';

export interface RunaToastInput {
	readonly message: string;
	readonly title: string;
	readonly tone?: RunaToastTone;
}

interface RunaToastRecord extends Required<RunaToastInput> {
	readonly id: string;
}

interface RunaToastContextValue {
	dismissToast(id: string): void;
	pushToast(input: RunaToastInput): string;
}

const RunaToastContext = createContext<RunaToastContextValue | null>(null);

export function useRunaToast(): RunaToastContextValue {
	const context = useContext(RunaToastContext);
	if (!context) {
		throw new Error('useRunaToast must be used inside RunaToastProvider.');
	}
	return context;
}

export function RunaToastProvider({ children }: { readonly children: ReactNode }): ReactElement {
	const [toasts, setToasts] = useState<readonly RunaToastRecord[]>([]);

	const dismissToast = useCallback((id: string) => {
		setToasts((current) => current.filter((toast) => toast.id !== id));
	}, []);

	const pushToast = useCallback(
		(input: RunaToastInput): string => {
			const id = crypto.randomUUID();
			const toast: RunaToastRecord = {
				id,
				message: input.message,
				title: input.title,
				tone: input.tone ?? 'info',
			};
			setToasts((current) => [...current, toast]);
			window.setTimeout(() => dismissToast(id), 5000);
			return id;
		},
		[dismissToast],
	);

	const value = useMemo(() => ({ dismissToast, pushToast }), [dismissToast, pushToast]);

	return (
		<RunaToastContext.Provider value={value}>
			{children}
			{createPortal(
				<div className={styles['viewport']}>
					{toasts.map((toast) => (
						<article
							aria-live={
								toast.tone === 'danger' || toast.tone === 'warning' ? 'assertive' : 'polite'
							}
							className={cx(styles['toast'], styles[toast.tone])}
							key={toast.id}
						>
							<div className={styles['header']}>
								<strong className={styles['title']}>{toast.title}</strong>
								<button
									aria-label="Dismiss notification"
									className={styles['close']}
									onClick={() => dismissToast(toast.id)}
									type="button"
								>
									x
								</button>
							</div>
							<div className={styles['message']}>{toast.message}</div>
						</article>
					))}
				</div>,
				document.body,
			)}
		</RunaToastContext.Provider>
	);
}
