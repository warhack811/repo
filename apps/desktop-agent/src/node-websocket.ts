import { createHash, randomBytes } from 'node:crypto';
import { type Socket, connect as connectTcp } from 'node:net';
import { connect as connectTls } from 'node:tls';

type NodeWebSocketEventType = 'close' | 'error' | 'message' | 'open';
type NodeWebSocketListener = (event: { readonly data?: string; readonly message?: string }) => void;

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

interface NodeWebSocketListenerRegistration {
	readonly listener: NodeWebSocketListener;
	readonly once: boolean;
}

function createAcceptKey(key: string): string {
	return createHash('sha1').update(`${key}${WS_GUID}`, 'binary').digest('base64');
}

function encodeClientFrame(opcode: number, payload: Buffer): Buffer {
	const mask = randomBytes(4);
	const length = payload.byteLength;
	const headerLength = length < 126 ? 2 : length <= 0xffff ? 4 : 10;
	const header = Buffer.alloc(headerLength);

	header[0] = 0x80 | opcode;
	if (length < 126) {
		header[1] = 0x80 | length;
	} else if (length <= 0xffff) {
		header[1] = 0x80 | 126;
		header.writeUInt16BE(length, 2);
	} else {
		header[1] = 0x80 | 127;
		header.writeBigUInt64BE(BigInt(length), 2);
	}

	const maskedPayload = Buffer.alloc(length);
	for (let index = 0; index < length; index += 1) {
		const payloadByte = payload[index] ?? 0;
		const maskByte = mask[index % 4] ?? 0;
		maskedPayload[index] = payloadByte ^ maskByte;
	}

	return Buffer.concat([header, mask, maskedPayload]);
}

export class NodeWebSocket {
	#buffer = Buffer.alloc(0);
	#closed = false;
	#handshakeComplete = false;
	#listeners = new Map<NodeWebSocketEventType, NodeWebSocketListenerRegistration[]>();
	#socket: Socket;

	constructor(url: string) {
		const target = new URL(url);
		const secure = target.protocol === 'wss:';
		const port = target.port ? Number(target.port) : secure ? 443 : 80;
		const path = `${target.pathname || '/'}${target.search}`;
		const key = randomBytes(16).toString('base64');

		this.#socket = secure
			? connectTls({ host: target.hostname, port, servername: target.hostname })
			: connectTcp({ host: target.hostname, port });

		this.#socket.once('connect', () => {
			this.#socket.write(
				[
					`GET ${path} HTTP/1.1`,
					`Host: ${target.host}`,
					'Upgrade: websocket',
					'Connection: Upgrade',
					`Sec-WebSocket-Key: ${key}`,
					'Sec-WebSocket-Version: 13',
					'\r\n',
				].join('\r\n'),
			);
		});
		this.#socket.on('data', (chunk) =>
			this.#handleData(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk), key),
		);
		this.#socket.on('error', (error) => this.#emit('error', { message: error.message }));
		this.#socket.on('close', () => this.#emitClose());
	}

	addEventListener(
		type: NodeWebSocketEventType,
		listener: NodeWebSocketListener,
		options?: { readonly once?: boolean },
	): void {
		const registrations = this.#listeners.get(type) ?? [];
		registrations.push({ listener, once: options?.once === true });
		this.#listeners.set(type, registrations);
	}

	removeEventListener(type: NodeWebSocketEventType, listener: NodeWebSocketListener): void {
		const registrations = this.#listeners.get(type) ?? [];
		this.#listeners.set(
			type,
			registrations.filter((registration) => registration.listener !== listener),
		);
	}

	close(code = 1000, reason = ''): void {
		if (this.#closed) {
			return;
		}

		const reasonBuffer = Buffer.from(reason);
		const payload = Buffer.alloc(2 + reasonBuffer.byteLength);
		payload.writeUInt16BE(code, 0);
		reasonBuffer.copy(payload, 2);
		this.#socket.write(encodeClientFrame(0x8, payload));
		this.#socket.end();
	}

	send(data: string): void {
		this.#socket.write(encodeClientFrame(0x1, Buffer.from(data)));
	}

	#emit(
		type: NodeWebSocketEventType,
		event: { readonly data?: string; readonly message?: string },
	): void {
		const registrations = this.#listeners.get(type) ?? [];
		const remaining: NodeWebSocketListenerRegistration[] = [];

		for (const registration of registrations) {
			registration.listener(event);
			if (!registration.once) {
				remaining.push(registration);
			}
		}

		this.#listeners.set(type, remaining);
	}

	#emitClose(): void {
		if (this.#closed) {
			return;
		}

		this.#closed = true;
		this.#emit('close', {});
	}

	#handleData(chunk: Buffer, key: string): void {
		this.#buffer = Buffer.concat([this.#buffer, chunk]);

		if (!this.#handshakeComplete) {
			const headerEnd = this.#buffer.indexOf('\r\n\r\n');
			if (headerEnd === -1) {
				return;
			}

			const header = this.#buffer.subarray(0, headerEnd).toString('utf8');
			this.#buffer = this.#buffer.subarray(headerEnd + 4);
			const acceptKey = createAcceptKey(key);

			if (
				!header.startsWith('HTTP/1.1 101') ||
				!header.includes(`Sec-WebSocket-Accept: ${acceptKey}`)
			) {
				this.#emit('error', { message: 'Desktop agent bridge WebSocket handshake failed.' });
				this.#socket.destroy();
				return;
			}

			this.#handshakeComplete = true;
			this.#emit('open', {});
		}

		this.#parseFrames();
	}

	#parseFrames(): void {
		while (this.#buffer.byteLength >= 2) {
			const first = this.#buffer[0] ?? 0;
			const second = this.#buffer[1] ?? 0;
			const opcode = first & 0x0f;
			let offset = 2;
			let length = second & 0x7f;

			if (length === 126) {
				if (this.#buffer.byteLength < offset + 2) {
					return;
				}
				length = this.#buffer.readUInt16BE(offset);
				offset += 2;
			} else if (length === 127) {
				if (this.#buffer.byteLength < offset + 8) {
					return;
				}
				const bigLength = this.#buffer.readBigUInt64BE(offset);
				if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
					this.#emit('error', { message: 'Desktop agent bridge frame is too large.' });
					this.#socket.destroy();
					return;
				}
				length = Number(bigLength);
				offset += 8;
			}

			if (this.#buffer.byteLength < offset + length) {
				return;
			}

			const payload = this.#buffer.subarray(offset, offset + length);
			this.#buffer = this.#buffer.subarray(offset + length);

			if (opcode === 0x1) {
				this.#emit('message', { data: payload.toString('utf8') });
			} else if (opcode === 0x8) {
				this.#socket.end();
				this.#emitClose();
			} else if (opcode === 0x9) {
				this.#socket.write(encodeClientFrame(0xa, payload));
			}
		}
	}
}

export function createNodeWebSocket(url: string): WebSocket {
	return new NodeWebSocket(url) as unknown as WebSocket;
}
