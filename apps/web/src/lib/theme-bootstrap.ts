import { applyAppearance, getStoredBrandTheme, getStoredTheme } from './theme.js';

applyAppearance(getStoredTheme(), getStoredBrandTheme());
