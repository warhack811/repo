import path from 'node:path';
import { FuseV1Options, FuseVersion, flipFuses } from '@electron/fuses';

function resolveExecutablePath(appOutDir, packager) {
	const executableName =
		packager.platform?.buildConfigurationKey === 'win'
			? `${packager.appInfo.productFilename}.exe`
			: packager.appInfo.productFilename;

	return path.join(appOutDir, executableName);
}

export default async function applyFuses({ appOutDir, packager }) {
	const executablePath = resolveExecutablePath(appOutDir, packager);

	await flipFuses(executablePath, {
		version: FuseVersion.V1,
		[FuseV1Options.RunAsNode]: false,
		[FuseV1Options.EnableCookieEncryption]: true,
		[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
		[FuseV1Options.EnableNodeCliInspectArguments]: false,
		[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
		[FuseV1Options.OnlyLoadAppFromAsar]: true,
		[FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
		[FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
	});
}
