import { FileHandle, open } from "fs/promises";

export interface IHiWriter {
	string(value: string, encoding?: BufferEncoding, offset?: number): number | Promise<number>;
	int(value: number, size: number, offset?: number): number | Promise<number>;
	uint(value: number, size: number, offset?: number): number | Promise<number>;
	int8(value: number, offset?: number): number | Promise<number>;
	uint8(value: number, offset?: number): number | Promise<number>;
	int16(value: number, offset?: number): number | Promise<number>;
	uint16(value: number, offset?: number): number | Promise<number>;
	int32(value: number, offset?: number): number | Promise<number>;
	uint32(value: number, offset?: number): number | Promise<number>;
	int64(value: bigint, offset?: number): number | Promise<number>;
	uint64(value: bigint, offset?: number): number | Promise<number>;
	float(value: number, offset?: number): number | Promise<number>;
	double(value: number, offset?: number): number | Promise<number>;
	bytes(value: Buffer, offset?: number): number | Promise<number>;

	seek(offset: number): void;
	setPosition(position: number): void;
	getPosition(): number;
}

function validateInt(value: number, size: number) {
	if (Math.floor(value) !== value) {
		throw new Error(`invalid integer value: ${value}`);
	} else if (size < 1 || size > 6 || Math.floor(size) !== size) {
		throw new Error(`invalid size: ${size} (expected: 1-6)`);
	} else if (value > 2 ** (size * 8) / 2 - 1 || value < -(2 ** (size * 8) / 2 - 1)) {
		throw new Error(`invalid ${size * 8}-bit integer value: ${value}`);
	}
}

function validateUInt(value: number, size: number) {
	if (value < 0 || Math.floor(value) !== value) {
		throw new Error(`invalid unsigned-integer value: ${value}`);
	} else if (size < 1 || size > 6 || Math.floor(size) !== size) {
		throw new Error(`invalid size: ${size} (expected: 1-6)`);
	} else if (value > 2 ** (size * 8) - 1) {
		throw new Error(`invalid ${size * 8}-bit unsigned-integer value: ${value}`);
	}
}

class HiFileWriter implements IHiWriter {
	handle: FileHandle;
	endian: 'BE' | 'LE';
	private position: number;

	constructor(handle: FileHandle, endian?: 'BE' | 'LE') {
		this.handle = handle;
		this.endian = endian ?? 'BE';
		this.position = 0;
	}

	async string(value: string, encoding: BufferEncoding = 'utf8', offset = this.position) {
		const { bytesWritten } = await this.handle.write(value, offset, encoding);
		this.position = offset + bytesWritten;
		return bytesWritten;
	}

	async int(value: number, size: number, offset: number = this.position) {
		validateInt(value, size);

		const buffer = Buffer.alloc(size);
		if (this.endian === 'BE') {
			buffer.writeIntBE(value, 0x00, size);
		} else {
			buffer.writeIntLE(value, 0x00, size);
		}

		return await this.bytes(buffer, offset);
	}

	async uint(value: number, size: number, offset: number = this.position) {
		validateUInt(value, size);

		const buffer = Buffer.alloc(size);
		if (this.endian === 'BE') {
			buffer.writeUIntBE(value, 0x00, size);
		} else {
			buffer.writeUIntLE(value, 0x00, size);
		}

		return await this.bytes(buffer, offset);
	}

	async int8(value: number, offset: number = this.position) { return await this.int(value, 1, offset); }

	async uint8(value: number, offset: number = this.position) { return await this.uint(value, 1, offset); }

	async int16(value: number, offset: number = this.position) { return await this.int(value, 2, offset); }

	async uint16(value: number, offset: number = this.position) { return await this.uint(value, 2, offset); }

	async int32(value: number, offset: number = this.position) { return await this.int(value, 4, offset); }

	async uint32(value: number, offset: number = this.position) { return await this.uint(value, 4, offset); }

	async int64(value: bigint, offset: number = this.position) {
		if (value < 0) {
			throw new Error(`invalid 64-bit integer value: ${value}`);
		}

		const buffer = Buffer.alloc(8);
		if (this.endian === 'BE') {
			buffer.writeBigInt64BE(value, 0x00);
		} else {
			buffer.writeBigInt64LE(value, 0x00);
		}

		return await this.bytes(buffer, offset);
	}

	async uint64(value: bigint, offset: number = this.position) {
		const buffer = Buffer.alloc(8);
		if (this.endian === 'BE') {
			buffer.writeBigUint64BE(value, 0x00);
		} else {
			buffer.writeBigUint64LE(value, 0x00);
		}

		return await this.bytes(buffer, offset);
	}

	async float(value: number, offset: number = this.position) {
		// handle invalid value?
		const buffer = Buffer.alloc(4);
		if (this.endian === 'BE') {
			buffer.writeFloatBE(value, 0x00);
		} else {
			buffer.writeFloatLE(value, 0x00);
		}

		return await this.bytes(buffer, offset);
	}

	async double(value: number, offset: number = this.position) {
		const buffer = Buffer.alloc(8);
		if (this.endian === 'BE') {
			buffer.writeDoubleBE(value, 0x00);
		} else {
			buffer.writeDoubleLE(value, 0x00);
		}

		return await this.bytes(buffer, offset);
	}

	async bytes(value: Buffer, offset = this.position) {
		const { bytesWritten } = await this.handle.write(value, offset);
		this.position = offset + bytesWritten;
		return bytesWritten;
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
}

class HiBufferWriter implements IHiWriter {
	protected buffer: Buffer;
	protected endian: 'BE' | 'LE';
	protected position: number = 0;

	constructor(buffer: Buffer, endian?: 'BE' | 'LE') {
		this.buffer = buffer;
		this.endian = endian ?? 'BE';
	}

	protected checkLength(byteCount: number) {
		if (this.position + byteCount > this.buffer.length) {
			throw new Error(`buffer isn't large enough: overflow of ${byteCount} bytes`);
		}
	}

	string(value: string, encoding: BufferEncoding = 'utf8', offset: number = this.position) {
		const buffer = Buffer.from(value, encoding);
		this.checkLength(buffer.length);
		this.buffer.fill(buffer, offset, offset + buffer.length);
		this.position = offset + buffer.length;
		return buffer.length;
	}

	int(value: number, size: number, offset: number = this.position) {
		validateInt(value, size);
		this.checkLength(size);
		this.position = this.endian === 'BE' ? this.buffer.writeIntBE(value, offset, size) : this.buffer.writeIntLE(value, offset, size);
		return size;
	}

	uint(value: number, size: number, offset: number = this.position) {
		validateUInt(value, size);
		this.checkLength(size);
		this.position = this.endian === 'BE' ? this.buffer.writeUIntBE(value, offset, size) : this.buffer.writeUIntLE(value, offset, size);
		return size;
	}

	int8(value: number, offset: number = this.position) { return this.int(value, 1, offset); }

	uint8(value: number, offset: number = this.position) { return this.uint(value, 1, offset); }

	int16(value: number, offset: number = this.position) { return this.int(value, 2, offset); }

	uint16(value: number, offset: number = this.position) { return this.uint(value, 2, offset); }

	int32(value: number, offset: number = this.position) { return this.int(value, 4, offset); }

	uint32(value: number, offset: number = this.position) { return this.uint(value, 4, offset); }

	int64(value: bigint, offset: number = this.position) {
		this.checkLength(8);
		this.position = this.endian === 'BE' ? this.buffer.writeBigInt64BE(value, offset) : this.buffer.writeBigInt64LE(value, offset);
		return 8;
	}

	uint64(value: bigint, offset: number = this.position) {
		this.checkLength(8);
		this.position = this.endian === 'BE' ? this.buffer.writeBigUInt64BE(value, offset) : this.buffer.writeBigUInt64LE(value, offset);
		return 8;
	}

	float(value: number, offset: number = this.position) {
		this.checkLength(4);
		this.position = this.endian === 'BE' ? this.buffer.writeFloatBE(value, offset) : this.buffer.writeFloatLE(value, offset);
		return 4;
	}

	double(value: number, offset: number = this.position) {
		this.checkLength(8);
		this.position = this.endian === 'BE' ? this.buffer.writeDoubleBE(value, offset) : this.buffer.writeDoubleLE(value, offset);
		return 8;
	}

	bytes(value: Buffer, offset: number = this.position) {
		// TODO: test
		this.checkLength(value.length);
		this.buffer.fill(value, offset, offset + value.length);
		this.position = offset + value.length;
		return value.length;
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

	getBuffer() {
		return this.buffer;
	}
}

class HiGrowableBufferWriter extends HiBufferWriter implements IHiWriter {
	private chunkSize: number;
	private size: number = 0;

	constructor(endian?: 'BE' | 'LE', chunkSize?: number) {
		super(Buffer.alloc(chunkSize ?? 1024), endian);
		this.chunkSize = chunkSize ?? 1024;
	}

	protected checkLength(byteCount: number) {
		// TODO: test
		while (this.position + byteCount > this.buffer.length) {
			this.buffer = Buffer.concat([this.buffer, Buffer.alloc(this.chunkSize)]);
		}

		if (this.position + byteCount > this.size) {
			this.size = this.position + byteCount;
		}
	}

	getSize() {
		return this.size;
	}

	getBuffer() {
		return Buffer.from(this.buffer.subarray(0, this.size));
	}
}

type Args1 = [filePath: string, options?: { endian?: 'BE' | 'LE', }];
type Args2 = [handle: FileHandle, options?: { endian?: 'BE' | 'LE', }];
type Args3 = [options: { fixedSize: number, endian?: 'BE' | 'LE' }];
type Args4 = [options?: { chunkSize?: number, endian?: 'BE' | 'LE' }];

export function createWriter(...args: Args1): Promise<HiFileWriter>;
export function createWriter(...args: Args2): HiFileWriter;
export function createWriter(...args: Args3): HiBufferWriter;
export function createWriter(...args: Args3): HiGrowableBufferWriter;
export function createWriter(): HiGrowableBufferWriter;
export function createWriter(...args: Args1 | Args2 | Args3 | Args4) {
	if (typeof args[0] === 'string') {
		const [a0, a1] = args as Args1;
		return open(a0).then(x => new HiFileWriter(x, a1?.endian));
	} else if (args[0] !== undefined && !('fixedSize' in args[0])) {
		const [a0, a1] = args as Args2;
		return new HiFileWriter(a0, a1?.endian);
	} else if (args[0] !== undefined && 'fixedSize' in args[0]) {
		const [a0] = args as Args3;
		return new HiBufferWriter(Buffer.alloc(a0.fixedSize), a0.endian);
	} else {
		const [a0] = args as Args4;
		return new HiGrowableBufferWriter(a0?.endian, a0?.chunkSize);
	}
}