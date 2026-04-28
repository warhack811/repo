import type { ReactElement, TextareaHTMLAttributes } from 'react';

import styles from './RunaTextarea.module.css';
import { cx } from './ui-utils.js';

export type RunaTextareaProps = Readonly<
	Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'style'>
>;

export function RunaTextarea({ className, ...textareaProps }: RunaTextareaProps): ReactElement {
	const mergedClassName = cx('runa-ui-textarea', styles['textarea'], className);

	return <textarea {...textareaProps} className={mergedClassName} />;
}
