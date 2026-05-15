import { useCallback, useState } from 'react';
import type { ReactElement } from 'react';

import type { ConversationMessage } from '../../hooks/useConversations.js';
import styles from './MessageActionBar.module.css';
import type { MessageActionModel } from './messageActions.js';

type MessageActionBarProps = Readonly<{
	actionModel: MessageActionModel;
	message: ConversationMessage;
	onPreparePrompt: (input: {
		readonly prompt: string;
		readonly reason: 'edit' | 'retry';
		readonly sourceMessageId: string;
	}) => void;
}>;

export type { MessageActionBarProps };

export function MessageActionBar({
	actionModel,
	message,
	onPreparePrompt,
}: MessageActionBarProps): ReactElement | null {
	const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');

	if (!actionModel.canCopy && !actionModel.canEdit && !actionModel.canRetry) {
		return null;
	}

	const handleCopy = useCallback(() => {
		if (!actionModel.copyText || copyState !== 'idle') {
			return;
		}

		navigator.clipboard
			.writeText(actionModel.copyText)
			.then(() => {
				setCopyState('success');
				setTimeout(() => {
					setCopyState('idle');
				}, 1000);
			})
			.catch(() => {
				setCopyState('error');
				setTimeout(() => {
					setCopyState('idle');
				}, 1000);
			});
	}, [actionModel.copyText, copyState]);

	return (
		<fieldset className={styles['root']} aria-label="Mesaj aksiyonları">
			{actionModel.canCopy ? (
				<button
					type="button"
					className={`${styles['actionButton']}${copyState === 'success' ? ` ${styles['successState']}` : ''}${copyState === 'error' ? ` ${styles['errorState']}` : ''}`}
					onClick={handleCopy}
					aria-label="Mesajı kopyala"
					disabled={copyState === 'error'}
				>
					{copyState === 'error'
						? 'Kopyalanamadı'
						: copyState === 'success'
							? 'Kopyalandı'
							: 'Kopyala'}
				</button>
			) : null}
			{actionModel.canEdit ? (
				<button
					type="button"
					className={styles['actionButton']}
					onClick={() => {
						if (!actionModel.editPrompt) {
							return;
						}

						onPreparePrompt({
							prompt: actionModel.editPrompt,
							reason: 'edit',
							sourceMessageId: message.message_id,
						});
					}}
					aria-label="Bu mesajı düzenlemek için composer'a taşı"
				>
					Düzenle
				</button>
			) : null}
			{actionModel.canRetry ? (
				<button
					type="button"
					className={styles['actionButton']}
					onClick={() => {
						if (!actionModel.retryPrompt) {
							return;
						}

						onPreparePrompt({
							prompt: actionModel.retryPrompt,
							reason: 'retry',
							sourceMessageId: message.message_id,
						});
					}}
					aria-label="Önceki isteği tekrar denemeye hazırla"
				>
					Tekrar dene
				</button>
			) : null}
		</fieldset>
	);
}
