import { execFile } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

export interface DesktopAgentScreenshotPayload {
	readonly base64_data: string;
	readonly byte_length: number;
	readonly format: 'png';
	readonly mime_type: 'image/png';
}

function buildSafeEnvironment(): NodeJS.ProcessEnv {
	const allowedKeys = [
		'COMSPEC',
		'HOME',
		'LANG',
		'LC_ALL',
		'PATH',
		'PATHEXT',
		'SYSTEMROOT',
		'TEMP',
		'TMP',
		'USERPROFILE',
		'WINDIR',
	] as const;
	const safeEnvironment: NodeJS.ProcessEnv = {};

	for (const key of allowedKeys) {
		const value = process.env[key];

		if (value !== undefined) {
			safeEnvironment[key] = value;
		}
	}

	return safeEnvironment;
}

function buildCaptureScript(outputPath: string): string {
	const escapedOutputPath = outputPath.replace(/'/g, "''");

	return [
		"Add-Type -AssemblyName System.Windows.Forms",
		"Add-Type -AssemblyName System.Drawing",
		"$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen",
		"$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height",
		"$graphics = [System.Drawing.Graphics]::FromImage($bitmap)",
		"$graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bitmap.Size)",
		`$bitmap.Save('${escapedOutputPath}', [System.Drawing.Imaging.ImageFormat]::Png)`,
		"$graphics.Dispose()",
		"$bitmap.Dispose()",
	].join('\n');
}

function validatePngBuffer(buffer: Buffer): void {
	if (buffer.byteLength === 0) {
		throw new Error('Desktop agent screenshot capture returned an empty buffer.');
	}

	const isPng = PNG_SIGNATURE.every((byte, index) => buffer[index] === byte);

	if (!isPng) {
		throw new Error('Desktop agent screenshot capture did not produce a PNG image.');
	}
}

export async function captureDesktopScreenshot(): Promise<DesktopAgentScreenshotPayload> {
	if (process.platform !== 'win32') {
		throw new Error('Desktop agent screenshot capture is currently supported only on Windows.');
	}

	const outputPath = join(tmpdir(), `runa-desktop-agent-${Date.now()}-${Math.random()}.png`);

	try {
		await execFileAsync(
			'powershell.exe',
			['-NoProfile', '-NonInteractive', '-STA', '-Command', buildCaptureScript(outputPath)],
			{
				encoding: 'utf8',
				env: buildSafeEnvironment(),
				maxBuffer: 16_384,
				windowsHide: true,
			},
		);
		const screenshotBuffer = await readFile(outputPath);
		validatePngBuffer(screenshotBuffer);

		return {
			base64_data: screenshotBuffer.toString('base64'),
			byte_length: screenshotBuffer.byteLength,
			format: 'png',
			mime_type: 'image/png',
		};
	} finally {
		await rm(outputPath, {
			force: true,
		}).catch(() => undefined);
	}
}
