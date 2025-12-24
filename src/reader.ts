import { FileHandle, open } from "fs/promises";

export interface IHiFileReader {
	string(length: number, encoding?: BufferEncoding, offset?: number): Promise<string>;
	int(length: number, offset?: number): Promise<number>;
	uint(length: number, offset?: number): Promise<number>;
	int8(offset?: number): Promise<number>;
	uint8(offset?: number): Promise<number>;
	int16(offset?: number): Promise<number>;
	uint16(offset?: number): Promise<number>;
	int32(offset?: number): Promise<number>;
	uint32(offset?: number): Promise<number>;
	int64(offset?: number): Promise<bigint>;
	uint64(offset?: number): Promise<bigint>;
	float(offset?: number): Promise<number>;
	double(offset?: number): Promise<number>;
	bytes(length: number, offset?: number): Promise<Buffer>;

	seek(offset: number): void;
	setPosition(position: number): void;
	getPosition(): number;
	getSize(): Promise<number>;
}

export interface IHiBufferReader {
	string(length: number, encoding?: BufferEncoding, offset?: number): string;
	int(length: number, offset?: number): number;
	uint(length: number, offset?: number): number;
	int8(offset?: number): number;
	uint8(offset?: number): number;
	int16(offset?: number): number;
	uint16(offset?: number): number;
	int32(offset?: number): number;
	uint32(offset?: number): number;
	int64(offset?: number): bigint;
	uint64(offset?: number): bigint;
	float(offset?: number): number;
	double(offset?: number): number;
	bytes(length: number, offset?: number): Buffer;

	seek(offset: number): void;
	setPosition(position: number): void;
	getPosition(): number;
	getSize(): number;
}

class HiFileReader implements IHiFileReader {
	private handle: FileHandle;
	private endian: 'BE' | 'LE';
	private position: number;

	constructor(handle: FileHandle, endian?: 'BE' | 'LE') {
		this.handle = handle;
		this.endian = endian ?? 'BE';
		this.position = 0;
	}

	async string(length: number, encoding: BufferEncoding = 'utf8', offset = this.position) {
		const buffer = await this.bytes(length, offset);
		const result = buffer.toString(encoding, 0x00, length);
		return result;
	}

	async int(length: number, offset: number = this.position) {
		const buffer = await this.bytes(length, offset);
		const result = this.endian === 'BE' ? buffer.readIntBE(0x00, length) : buffer.readIntLE(0x00, length);
		return result;
	}

	async uint(length: number, offset: number = this.position) {
		const buffer = await this.bytes(length, offset);
		const result = this.endian === 'BE' ? buffer.readUIntBE(0x00, length) : buffer.readUIntLE(0x00, length);
		return result;
	}

	async int8(offset: number = this.position) { return await this.int(1, offset); }

	async uint8(offset: number = this.position) { return await this.uint(1, offset); }

	async int16(offset: number = this.position) { return await this.int(2, offset); }

	async uint16(offset: number = this.position) { return await this.uint(2, offset); }

	async int32(offset: number = this.position) { return await this.int(4, offset); }

	async uint32(offset: number = this.position) { return await this.uint(4, offset); }

	async int64(offset: number = this.position) {
		const buffer = await this.bytes(8, offset);
		const result = this.endian === 'BE' ? buffer.readBigInt64BE(0x00) : buffer.readBigInt64LE(0x00);
		return result;
	}

	async uint64(offset: number = this.position) {
		const buffer = await this.bytes(8, offset);
		const result = this.endian === 'BE' ? buffer.readBigUInt64BE(0x00) : buffer.readBigUInt64LE(0x00);
		return result;
	}

	async float(offset: number = this.position) {
		const buffer = await this.bytes(4, offset);
		const result = this.endian === 'BE' ? buffer.readFloatBE(0x00) : buffer.readFloatLE(0x00);
		return result;
	}

	async double(offset: number = this.position) {
		const buffer = await this.bytes(8, offset);
		const result = this.endian === 'BE' ? buffer.readDoubleBE(0x00) : buffer.readDoubleLE(0x00);
		return result;
	}

	async bytes(length: number, offset = this.position) {
		const buffer = Buffer.alloc(length);
		const { bytesRead } = await this.handle.read({ offset: 0x00, position: offset, length: length, buffer });
		if (length !== bytesRead) {
			throw new Error(`attempted an out-of-bounds read (start=0x${this.position.toString(16).toUpperCase()}, length=${length})`);
		} else {
			this.position = offset + length;
			return buffer;
		}
	}

	seek(offset: number) {
		this.position += offset;
		if (this.position < 0) {
			this.position = 0;
		}
	}

	setPosition(offset: number) {
		this.position = offset;
	}

	getPosition() {
		return this.position;
	}

	async getSize() {
		return (await this.handle.stat()).size;
	}
}

class HiBufferReader implements IHiBufferReader {
	buffer: Buffer;
	endian: 'BE' | 'LE';
	private position: number;

	constructor(buffer: Buffer, endian?: 'BE' | 'LE') {
		this.buffer = buffer;
		this.endian = endian ?? 'BE';
		this.position = 0;
	}

	string(length: number, encoding: BufferEncoding = 'utf8', offset: number = this.position,) {
		const result = this.buffer.toString(encoding, offset, this.position + length)
		this.position = offset + length;
		return result;
	}

	int(length: number, offset: number = this.position) {
		const result = this.endian === 'BE' ? this.buffer.readIntBE(offset, length) : this.buffer.readIntLE(offset, length);
		this.position = offset + length;
		return result;
	}

	uint(length: number, offset: number = this.position) {
		const result = this.endian === 'BE' ? this.buffer.readUIntBE(offset, length) : this.buffer.readUIntLE(offset, length);
		this.position = offset + length;
		return result;
	}

	int8(offset: number = this.position) { return this.int(1, offset); }

	uint8(offset: number = this.position) { return this.uint(1, offset); }

	int16(offset: number = this.position) { return this.int(2, offset); }

	uint16(offset: number = this.position) { return this.uint(2, offset); }

	int32(offset: number = this.position) { return this.int(4, offset); }

	uint32(offset: number = this.position) { return this.uint(4, offset); }

	int64(offset: number = this.position) {
		const result = this.endian === 'BE' ? this.buffer.readBigInt64BE(offset) : this.buffer.readBigInt64LE(offset);
		this.position = offset + 8;
		return result;
	}

	uint64(offset: number = this.position) {
		const result = this.endian === 'BE' ? this.buffer.readBigUInt64BE(offset) : this.buffer.readBigUInt64LE(offset);
		this.position = offset + 8;
		return result;
	}

	float(offset: number = this.position) {
		const result = this.endian === 'BE' ? this.buffer.readFloatBE(offset) : this.buffer.readFloatLE(offset);
		this.position = offset + 4;
		return result;
	}

	double(offset: number = this.position) {
		const result = this.endian === 'BE' ? this.buffer.readDoubleBE(offset) : this.buffer.readDoubleBE(offset);
		this.position = offset + 8;
		return result;
	}

	bytes(length: number, offset: number = this.position) {
		const result = this.buffer.subarray(offset, offset + length);
		this.position = offset + length;
		return result;
	}

	push(buffer: Buffer) {
		this.buffer = Buffer.concat([this.buffer, buffer]);
	}

	seek(offset: number) {
		this.position += offset;
		if (this.position < 0) {
			this.position = 0;
		} else if (this.position > this.buffer.length - 1) {
			this.position = this.buffer.length - 1;
		}
	}

	setPosition(position: number) {
		this.position = position;
		if (this.position < 0) {
			this.position = 0;
		} else if (this.position > this.buffer.length - 1) {
			this.position = this.buffer.length - 1;
		}
	}

	getPosition() {
		return this.position;
	}

	getSize() {
		return this.buffer.length;
	}
}

export function createReader(filePath: string, endian?: 'BE' | 'LE'): Promise<HiFileReader>;
export function createReader(handle: FileHandle, endian?: 'BE' | 'LE'): HiFileReader;
export function createReader(buffer: Buffer, endian?: 'BE' | 'LE'): HiBufferReader;
export function createReader(arg: string | FileHandle | Buffer, endian: 'BE' | 'LE' = 'BE') {
		if (typeof arg === 'string') {
			return open(arg).then(x => new HiFileReader(x, endian));
		} else if (Buffer.isBuffer(arg)) {
			return new HiBufferReader(arg, endian);
		} else {
			return new HiFileReader(arg, endian);
		}
}