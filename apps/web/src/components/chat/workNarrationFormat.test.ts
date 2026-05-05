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
		expect(
			formatWorkDetail(
				'Reads text from the connected desktop agent clipboard through an approval-gated bridge, returning a bounded redaction-aware payload.',
			),
		).toBe('Bağlı masaüstü panosundaki metin güvenli sınırlar içinde okunur.');
		expect(formatWorkDetail('Approval rejected for Ekran görüntüsü.')).toBe(
			'Onay reddedildi: Ekran görüntüsü.',
		);
		expect(
			formatWorkDetail(
				'Writes text to the connected desktop agent clipboard through an explicit approval-gated bridge path.',
			),
		).toBe('Bağlı masaüstü panosuna metin yazılır.');
	});

	it('formats tool and state chips consistently', () => {
		expect(formatWorkToolLabel('desktop.screenshot')).toBe('Ekran görüntüsü');
		expect(formatWorkToolLabel('desktop.clipboard.write')).toBe('Pano yazma');
		expect(formatWorkStateLabel('paused')).toBe('bekliyor');
		expect(formatWorkStateLabel('success')).toBe('tamamlandı');
	});
});
