/** Binary reader for TNEF data using Uint8Array */
export class TnefDecoder {
  private data: Uint8Array;
  private view: DataView;
  private pos: number;

  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.pos = 0;
  }

  get offset(): number {
    return this.pos;
  }

  get remaining(): number {
    return this.data.length - this.pos;
  }

  readUint8(): number {
    if (this.pos >= this.data.length) throw new Error('Unexpected end of data');
    return this.data[this.pos++];
  }

  readUint16LE(): number {
    if (this.pos + 2 > this.data.length) throw new Error('Unexpected end of data');
    const val = this.view.getUint16(this.pos, true);
    this.pos += 2;
    return val;
  }

  readUint32LE(): number {
    if (this.pos + 4 > this.data.length) throw new Error('Unexpected end of data');
    const val = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return val;
  }

  readBytes(length: number): Uint8Array {
    if (this.pos + length > this.data.length) throw new Error('Unexpected end of data');
    const slice = this.data.slice(this.pos, this.pos + length);
    this.pos += length;
    return slice;
  }

  skip(length: number): void {
    this.pos += length;
    if (this.pos > this.data.length) this.pos = this.data.length;
  }

  /** Decode null-terminated ANSI string */
  decodeAnsiString(bytes: Uint8Array): string {
    let end = bytes.indexOf(0);
    if (end === -1) end = bytes.length;
    const decoder = new TextDecoder('windows-1252');
    return decoder.decode(bytes.subarray(0, end));
  }

  /** Decode UTF-16LE string */
  decodeUnicodeString(bytes: Uint8Array): string {
    // Remove trailing null terminator if present
    let len = bytes.length;
    if (len >= 2 && bytes[len - 1] === 0 && bytes[len - 2] === 0) {
      len -= 2;
    }
    const decoder = new TextDecoder('utf-16le');
    return decoder.decode(bytes.subarray(0, len));
  }
}

/** Pad a size to the next 4-byte boundary */
export function pad4(n: number): number {
  return (n + 3) & ~3;
}
