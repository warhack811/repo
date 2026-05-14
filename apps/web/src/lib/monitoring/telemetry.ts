import type { TransportErrorCode } from '../transport/error-catalog.js';

export type TelemetryMetricName =
	| 'bundle_loaded'
	| 'cls'
	| 'fid'
	| 'inp'
	| 'lcp'
	| 'search_evidence_latency'
	| 'stream_latency'
	| 'time_to_first_token'
	| 'tool_call_duration'
	| 'transport_error'
	| 'ttfb';

type TelemetryAttributes = Readonly<Record<string, string | number | boolean | null>>;

type TelemetryPayload = Readonly<{
	attributes?: TelemetryAttributes;
	name: TelemetryMetricName;
	timestamp: string;
	value?: number;
}>;

type MetricEntry = PerformanceEntry &
	Readonly<{
		hadRecentInput?: boolean;
		processingStart?: number;
		responseStart?: number;
		value?: number;
	}>;

const telemetryEndpoint = import.meta.env['VITE_RUNA_TELEMETRY_ENDPOINT'] as string | undefined;
let hasStartedWebVitalsMonitoring = false;

function getNavigationEntry(): PerformanceNavigationTiming | null {
	const navigationEntry = performance.getEntriesByType('navigation')[0];
	return navigationEntry instanceof PerformanceNavigationTiming ? navigationEntry : null;
}

export function reportTelemetryEvent(
	name: TelemetryMetricName,
	value?: number,
	attributes?: TelemetryAttributes,
): void {
	if (!telemetryEndpoint) {
		return;
	}

	const payload: TelemetryPayload = {
		attributes,
		name,
		timestamp: new Date().toISOString(),
		value,
	};
	const body = JSON.stringify(payload);

	if (navigator.sendBeacon) {
		const blob = new Blob([body], { type: 'application/json' });

		if (navigator.sendBeacon(telemetryEndpoint, blob)) {
			return;
		}
	}

	void fetch(telemetryEndpoint, {
		body,
		headers: { 'content-type': 'application/json' },
		keepalive: true,
		method: 'POST',
	}).catch((error: unknown) => {
		console.error('Runa telemetry submit failed.', error);
	});
}

export function reportTransportErrorMetric(code: TransportErrorCode): void {
	reportTelemetryEvent('transport_error', undefined, { code });
}

export function startWebVitalsMonitoring(): void {
	if (hasStartedWebVitalsMonitoring || typeof window === 'undefined') {
		return;
	}

	hasStartedWebVitalsMonitoring = true;
	reportTelemetryEvent('bundle_loaded');

	window.addEventListener(
		'load',
		() => {
			const navigationEntry = getNavigationEntry();

			if (navigationEntry) {
				reportTelemetryEvent('ttfb', navigationEntry.responseStart);
			}
		},
		{ once: true },
	);

	if (typeof PerformanceObserver === 'undefined') {
		return;
	}

	let cumulativeLayoutShift = 0;
	let longestInteraction = 0;

	try {
		const lcpObserver = new PerformanceObserver((entryList) => {
			for (const entry of entryList.getEntries() as MetricEntry[]) {
				reportTelemetryEvent('lcp', entry.startTime);
			}
		});
		lcpObserver.observe({ buffered: true, type: 'largest-contentful-paint' });
	} catch (error: unknown) {
		console.error('Runa LCP observer failed.', error);
	}

	try {
		const clsObserver = new PerformanceObserver((entryList) => {
			for (const entry of entryList.getEntries() as MetricEntry[]) {
				if (entry.hadRecentInput === true) {
					continue;
				}

				cumulativeLayoutShift += entry.value ?? 0;
				reportTelemetryEvent('cls', cumulativeLayoutShift);
			}
		});
		clsObserver.observe({ buffered: true, type: 'layout-shift' });
	} catch (error: unknown) {
		console.error('Runa CLS observer failed.', error);
	}

	try {
		const fidObserver = new PerformanceObserver((entryList) => {
			for (const entry of entryList.getEntries() as MetricEntry[]) {
				if (entry.name !== 'first-input' || entry.processingStart === undefined) {
					continue;
				}

				reportTelemetryEvent('fid', entry.processingStart - entry.startTime);
			}
		});
		fidObserver.observe({ buffered: true, type: 'first-input' });
	} catch (error: unknown) {
		console.error('Runa FID observer failed.', error);
	}

	try {
		const interactionObserver = new PerformanceObserver((entryList) => {
			for (const entry of entryList.getEntries() as MetricEntry[]) {
				const duration = entry.duration;

				if (duration > longestInteraction) {
					longestInteraction = duration;
					reportTelemetryEvent('inp', longestInteraction);
				}
			}
		});
		const eventObserverOptions: PerformanceObserverInit & { durationThreshold?: number } = {
			buffered: true,
			durationThreshold: 40,
			type: 'event',
		};
		interactionObserver.observe(eventObserverOptions);
	} catch (error: unknown) {
		console.error('Runa INP observer failed.', error);
	}
}
