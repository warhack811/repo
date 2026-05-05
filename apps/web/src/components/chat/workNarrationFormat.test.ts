import { describe, expect, it } from 'vitest';

import {
	formatWorkDetail,
	formatWorkStateLabel,
	formatWorkSummary,
	formatWorkTimelineLabel,
	formatWorkToolLabel,
} from './workNarrationFormat.js';

describe('work narration formatting', () => {
	it('formats persisted English timeline labels into user-facing copy', () => {
		expect(formatWorkTimelineLabel('Run started')).toBe('Runa işi başlattı');
		expect(formatWorkTimelineLabel('Approval requested for desktop.screenshot')).toBe(
			'Ekran görüntüsü için onay bekleniyor',
		);
	});

	it('formats persisted summary and detail text', () => {
		expect(formatWorkSummary('Timeline shows approval wait for desktop screenshot.')).toBe(
			'Runa ekran görüntüsü için onay bekliyor.',
		);
		expect(
			formatWorkDetail(
				'Captures a screenshot of the server host desktop and returns the image as base64-encoded PNG data.',
			),
		).toBe('Ekrandaki görünür bilgileri yakalamak için ekran görüntüsü alınır.');
	});

	it('formats tool and state chips consistently', () => {
		expect(formatWorkToolLabel('desktop.screenshot')).toBe('Ekran görüntüsü');
		expect(formatWorkStateLabel('paused')).toBe('bekliyor');
		expect(formatWorkStateLabel('success')).toBe('tamamlandı');
	});
});
