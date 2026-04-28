/**
 * Create placeholder icon files for Electron app
 * Creates a 256x256 PNG icon as required by electron-builder
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const buildDir = path.join(__dirname, '../build');

// Create a valid 256x256 PNG file
// This is a minimal PNG with a purple gradient
function createPNG(width, height) {
	// PNG header
	const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

	// IHDR chunk
	const ihdrData = Buffer.alloc(13);
	ihdrData.writeUInt32BE(width, 0); // width
	ihdrData.writeUInt32BE(height, 4); // height
	ihdrData.writeUInt8(8, 8); // bit depth
	ihdrData.writeUInt8(2, 9); // color type (RGB)
	ihdrData.writeUInt8(0, 10); // compression
	ihdrData.writeUInt8(0, 11); // filter
	ihdrData.writeUInt8(0, 12); // interlace

	const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
	const ihdr = Buffer.concat([
		Buffer.from([0, 0, 0, 13]), // length
		Buffer.from('IHDR'),
		ihdrData,
		uint32ToBuffer(ihdrCrc)
	]);

	// IDAT chunk - raw pixel data with zlib compression
	const rawData = [];
	for (let y = 0; y < height; y++) {
		rawData.push(0); // filter byte
		for (let x = 0; x < width; x++) {
			// Purple gradient
			const r = Math.floor(102 + (x / width) * 50);
			const g = Math.floor(126 + (x / width) * 30);
			const b = Math.floor(234);
			rawData.push(r, g, b);
		}
	}

	const rawBuffer = Buffer.from(rawData);
	const compressed = deflate(rawBuffer);

	const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
	const idat = Buffer.concat([
		uint32ToBuffer(compressed.length),
		Buffer.from('IDAT'),
		compressed,
		uint32ToBuffer(idatCrc)
	]);

	// IEND chunk
	const iendCrc = crc32(Buffer.from('IEND'));
	const iend = Buffer.concat([
		Buffer.from([0, 0, 0, 0]),
		Buffer.from('IEND'),
		uint32ToBuffer(iendCrc)
	]);

	return Buffer.concat([signature, ihdr, idat, iend]);
}

function uint32ToBuffer(n) {
	const buf = Buffer.alloc(4);
	buf.writeUInt32BE(n >>> 0, 0);
	return buf;
}

// Simple CRC32 implementation
function crc32(data) {
	let crc = 0xffffffff;
	const table = [];

	for (let i = 0; i < 256; i++) {
		let c = i;
		for (let j = 0; j < 8; j++) {
			c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
		}
		table[i] = c;
	}

	for (let i = 0; i < data.length; i++) {
		crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
	}

	return (crc ^ 0xffffffff) >>> 0;
}

// Simple deflate (store only, no compression)
function deflate(data) {
	const chunks = [];
	const maxBlock = 65535;

	for (let i = 0; i < data.length; i += maxBlock) {
		const chunk = data.slice(i, Math.min(i + maxBlock, data.length));
		const isLast = i + maxBlock >= data.length;
		const header = Buffer.alloc(5);
		header.writeUInt8(isLast ? 1 : 0, 0);
		header.writeUInt16LE(chunk.length, 1);
		header.writeUInt16LE(chunk.length ^ 0xffff, 3);
		chunks.push(header, chunk);
	}

	// Add zlib header and checksum
	const zlibHeader = Buffer.from([0x78, 0x01]);
	const adler = adler32(data);
	const checksum = Buffer.alloc(4);
	checksum.writeUInt32BE(adler, 0);

	return Buffer.concat([zlibHeader, ...chunks, checksum]);
}

// Adler32 checksum
function adler32(data) {
	let a = 1, b = 0;
	for (let i = 0; i < data.length; i++) {
		a = (a + data[i]) % 65521;
		b = (b + a) % 65521;
	}
	return (b << 16) | a;
}

function ensureDir(dirPath) {
	if (!fs.existsSync(dirPath)) {
		fs.mkdirSync(dirPath, { recursive: true });
	}
}

async function createIcons() {
	ensureDir(buildDir);

	// Create 256x256 PNG
	const png256 = createPNG(256, 256);
	fs.writeFileSync(path.join(buildDir, 'icon.png'), png256);

	// Create ICO file with the 256x256 PNG embedded
	const pngSize = png256.length;
	const icoHeader = Buffer.alloc(6);
	icoHeader.writeUInt16LE(0, 0); // Reserved
	icoHeader.writeUInt16LE(1, 2); // ICO type
	icoHeader.writeUInt16LE(1, 4); // 1 image

	const icoEntry = Buffer.alloc(16);
	icoEntry.writeUInt8(0, 0); // width (0 = 256)
	icoEntry.writeUInt8(0, 1); // height (0 = 256)
	icoEntry.writeUInt8(0, 2); // palette size
	icoEntry.writeUInt8(0, 3); // reserved
	icoEntry.writeUInt16LE(1, 4); // color planes
	icoEntry.writeUInt16LE(32, 6); // bits per pixel
	icoEntry.writeUInt32LE(pngSize, 8); // image size
	icoEntry.writeUInt32LE(22, 12); // offset to image data

	const icoData = Buffer.concat([icoHeader, icoEntry, png256]);
	fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoData);

	console.log('Icons created in', buildDir);
	console.log('- icon.png (256x256 PNG)');
	console.log('- icon.ico (256x256 ICO)');
}

createIcons().catch(console.error);
