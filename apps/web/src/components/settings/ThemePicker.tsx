import type { ReactElement } from 'react';

import type { Theme } from '../../lib/theme.js';
import styles from './ThemePicker.module.css';

type ThemePickerProps = Readonly<{
	onChange: (theme: Theme) => void;
	value: Theme;
}>;

const themes: readonly {
	readonly id: Theme;
	readonly label: string;
	readonly preview: string;
}[] = [
	{ id: 'ember-dark', label: 'Ember Dark', preview: '#14110D' },
	{ id: 'ember-light', label: 'Ember Light', preview: '#F6F1E8' },
	{ id: 'rose-dark', label: 'Rose Dark', preview: '#18110F' },
	{
		id: 'system',
		label: 'Sistem',
		preview: 'linear-gradient(135deg, #14110D 50%, #F6F1E8 50%)',
	},
];

export function ThemePicker({ onChange, value }: ThemePickerProps): ReactElement {
	return (
		<fieldset className={styles['themePicker']} aria-label="Tema">
			{themes.map((theme) => {
				const isChecked = value === theme.id;

				return (
					<label
						key={theme.id}
						className={`${styles['themeOption']}${isChecked ? ` ${styles['themeOptionChecked']}` : ''}`}
					>
						<input
							type="radio"
							name="theme"
							value={theme.id}
							checked={isChecked}
							onChange={() => onChange(theme.id)}
							className={styles['themeRadio']}
						/>
						<div>
							<span className={styles['themePreview']} style={{ background: theme.preview }} />
						</div>
						<span className={styles['themeLabel']}>{theme.label}</span>
					</label>
				);
			})}
		</fieldset>
	);
}
