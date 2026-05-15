import { describe, expect, it } from 'vitest';
import {
	deriveEmptyStateModel,
	getGreeting,
	getProjectNameFromWorkingDirectory,
} from './emptyStateModel.js';

describe('getGreeting', () => {
	it('returns Günaydın at 09:00', () => {
		expect(getGreeting(new Date(2026, 4, 15, 9, 0, 0))).toBe('Günaydın');
	});

	it('returns İyi günler at 14:00', () => {
		expect(getGreeting(new Date(2026, 4, 15, 14, 0, 0))).toBe('İyi günler');
	});

	it('returns İyi akşamlar at 20:00', () => {
		expect(getGreeting(new Date(2026, 4, 15, 20, 0, 0))).toBe('İyi akşamlar');
	});

	it('returns Geç oldu at 02:00', () => {
		expect(getGreeting(new Date(2026, 4, 15, 2, 0, 0))).toBe('Geç oldu');
	});
});

describe('getProjectNameFromWorkingDirectory', () => {
	it('extracts basename from Windows path', () => {
		expect(getProjectNameFromWorkingDirectory('D:\\ai\\Runa')).toBe('Runa');
	});

	it('extracts basename from Unix path', () => {
		expect(getProjectNameFromWorkingDirectory('/Users/me/project')).toBe('project');
	});

	it('handles trailing slash', () => {
		expect(getProjectNameFromWorkingDirectory('/Users/me/project/')).toBe('project');
	});

	it('returns null for null input', () => {
		expect(getProjectNameFromWorkingDirectory(null)).toBeNull();
	});

	it('returns null for undefined input', () => {
		expect(getProjectNameFromWorkingDirectory(undefined)).toBeNull();
	});

	it('returns null for empty string', () => {
		expect(getProjectNameFromWorkingDirectory('')).toBeNull();
	});

	it('returns null for whitespace-only string', () => {
		expect(getProjectNameFromWorkingDirectory('   ')).toBeNull();
	});

	it('returns null for very long path', () => {
		expect(getProjectNameFromWorkingDirectory('a'.repeat(501))).toBeNull();
	});

	it('returns null for path with segment > 128 chars', () => {
		expect(getProjectNameFromWorkingDirectory(`/a/${'b'.repeat(129)}`)).toBeNull();
	});
});

describe('deriveEmptyStateModel', () => {
	it('returns greeting based on time', () => {
		const model = deriveEmptyStateModel({ now: new Date(2026, 4, 15, 9, 0, 0) });
		expect(model.greeting).toBe('Günaydın');
	});

	it('returns Nereden başlayalım lead', () => {
		const model = deriveEmptyStateModel();
		expect(model.lead).toBe('Nereden başlayalım?');
	});

	it('sets contextLine with project name when project exists', () => {
		const model = deriveEmptyStateModel({
			workingDirectory: 'D:\\ai\\Runa',
		});
		expect(model.contextLine).toBe('Runa üzerinde çalışmaya hazırım.');
		expect(model.contextLine).not.toContain('D:\\ai\\Runa');
	});

	it('sets contextLine with device when device exists', () => {
		const model = deriveEmptyStateModel({
			activeDeviceLabel: "Muhammet'in bilgisayarı",
		});
		expect(model.contextLine).toBe('Masaüstü cihazın hazır.');
	});

	it('sets contextLine with both project and device', () => {
		const model = deriveEmptyStateModel({
			workingDirectory: '/home/user/project',
			activeDeviceLabel: 'PC',
		});
		expect(model.contextLine).toBe('project ve masaüstü cihazın hazır.');
	});

	it('returns null contextLine when no context', () => {
		const model = deriveEmptyStateModel({});
		expect(model.contextLine).toBeNull();
	});

	it('produces project chip when project exists', () => {
		const model = deriveEmptyStateModel({ workingDirectory: '/app/Runa' });
		expect(model.contextChips).toContain('Proje: Runa');
	});

	it('produces device chip when device exists', () => {
		const model = deriveEmptyStateModel({ activeDeviceLabel: 'PC' });
		expect(model.contextChips).toContain('Cihaz hazır');
	});

	it('produces conversation chip when count > 0', () => {
		const model = deriveEmptyStateModel({ conversationCount: 3 });
		expect(model.contextChips).toContain('3 konuşma');
	});

	it('does not produce conversation chip when count is 0', () => {
		const model = deriveEmptyStateModel({ conversationCount: 0 });
		expect(model.contextChips).not.toContain('0 konuşma');
	});

	it('returns empty chips when no context', () => {
		const model = deriveEmptyStateModel({});
		expect(model.contextChips).toEqual([]);
	});

	it('returns exactly 4 suggestions', () => {
		const model = deriveEmptyStateModel();
		expect(model.suggestions).toHaveLength(4);
	});

	it('every suggestion has non-empty label, description, prompt', () => {
		const model = deriveEmptyStateModel();
		for (const suggestion of model.suggestions) {
			expect(suggestion.label.length).toBeGreaterThan(0);
			expect(suggestion.description.length).toBeGreaterThan(0);
			expect(suggestion.prompt.length).toBeGreaterThan(0);
		}
	});

	it('forbidden technical strings are absent from suggestions', () => {
		const forbidden = [
			'Developer Mode',
			'runtime',
			'metadata',
			'transport',
			'schema',
			'protocol',
			'API key',
		];
		const model = deriveEmptyStateModel();
		const allText = model.suggestions.flatMap((s) => [s.label, s.description, s.prompt]).join(' ');

		for (const term of forbidden) {
			expect(allText, `forbidden term: "${term}"`).not.toContain(term);
		}
	});
});
