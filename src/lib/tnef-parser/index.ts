import { TnefDecoder, pad4 } from './decoder';
import {
  type TnefParseResult,
  type TnefAttachment,
  TNEF_SIGNATURE,
  LVL_MESSAGE,
  LVL_ATTACHMENT,
  ATTR,
  ATTACH_ATTR,
  PT,
  PROP,
} from './types';

export type { TnefParseResult, TnefAttachment };

interface RawAttachment {
  legacyName: string;
  mapiFilename: string;
  mapiLongFilename: string;
  mapiDisplayName: string;
  data: Uint8Array | null;
  mimeType: string;
  extension: string;
  size: number;
}

/** Map Windows codepage number to TextDecoder encoding name */
function codepageToEncoding(cp: number): string {
  const map: Record<number, string> = {
    932: 'shift_jis',
    936: 'gbk',
    949: 'euc-kr',
    950: 'big5',
    1250: 'windows-1250',
    1251: 'windows-1251',
    1252: 'windows-1252',
    1253: 'windows-1253',
    1254: 'windows-1254',
    1255: 'windows-1255',
    1256: 'windows-1256',
    1257: 'windows-1257',
    1258: 'windows-1258',
    65001: 'utf-8',
  };
  return map[cp] || 'shift_jis';
}

/**
 * Parse a winmail.dat (TNEF) file.
 * Works entirely in the browser — no fs or Node.js dependencies.
 */
export function parseTnef(buffer: ArrayBuffer | Uint8Array): TnefParseResult {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const decoder = new TnefDecoder(data);

  // Verify TNEF signature
  const signature = decoder.readUint32LE();
  if (signature !== TNEF_SIGNATURE) {
    throw new Error('Not a valid TNEF (winmail.dat) file');
  }

  // Skip legacy key
  decoder.readUint16LE();

  // Default to shift_jis for ANSI strings; updated if OEM codepage attribute is found
  let ansiEncoding = 'shift_jis';

  let subject = '';
  let from = '';
  let body = '';
  let bodyHtml = '';

  const attachments: RawAttachment[] = [];
  let currentAttachment: RawAttachment | null = null;

  // Parse attributes
  while (decoder.remaining > 0) {
    // Need at least 1 (level) + 4 (attr type) + 4 (length) = 9 bytes
    if (decoder.remaining < 9) break;

    const level = decoder.readUint8();
    // Attribute type is 4 bytes: low 16 bits = attribute ID, high 16 bits = data type
    const attrType = decoder.readUint32LE();
    const attrId = attrType & 0xFFFF;
    const attrLength = decoder.readUint32LE();

    if (attrLength > decoder.remaining) break;

    const attrData = decoder.readBytes(attrLength);

    // Skip checksum (2 bytes)
    if (decoder.remaining >= 2) {
      decoder.readUint16LE();
    }

    if (level === LVL_MESSAGE) {
      switch (attrId) {
        case ATTR.OEM_CODEPAGE: {
          // First 4 bytes = OEM codepage (uint32 LE)
          if (attrData.length >= 4) {
            const cp = new DataView(
              attrData.buffer, attrData.byteOffset, attrData.byteLength
            ).getUint32(0, true);
            ansiEncoding = codepageToEncoding(cp);
          }
          break;
        }
        case ATTR.SUBJECT: {
          // Legacy ANSI subject — may be overwritten by MAPI Unicode subject
          const d = new TnefDecoder(attrData);
          subject = d.decodeAnsiString(attrData, ansiEncoding);
          break;
        }
        case ATTR.FROM: {
          const d = new TnefDecoder(attrData);
          // TRP structure: wTrpidType(2) + cbgrtrp(2) + cch(2) + cb(2) + sender_name + \0 + sender_email + \0
          if (attrData.length >= 8) {
            d.skip(8);
            from = d.decodeAnsiString(attrData.subarray(8), ansiEncoding);
          }
          break;
        }
        case ATTR.BODY: {
          const d = new TnefDecoder(attrData);
          body = d.decodeAnsiString(attrData, ansiEncoding);
          break;
        }
        case ATTR.MAPI_PROPS: {
          // MAPI props contain Unicode strings — always preferred over legacy ANSI
          const parsed = parseMapiProps(attrData, ansiEncoding);
          if (parsed.subject) subject = parsed.subject;
          if (parsed.senderName) from = parsed.senderName;
          if (parsed.senderEmail) {
            from = from ? `${from} <${parsed.senderEmail}>` : parsed.senderEmail;
          }
          if (parsed.body) body = parsed.body;
          if (parsed.bodyHtml) bodyHtml = parsed.bodyHtml;
          break;
        }
      }
    } else if (level === LVL_ATTACHMENT) {
      switch (attrId) {
        case ATTACH_ATTR.REND_DATA: {
          // New attachment starts
          if (currentAttachment) {
            attachments.push(currentAttachment);
          }
          currentAttachment = {
            legacyName: '',
            mapiFilename: '',
            mapiLongFilename: '',
            mapiDisplayName: '',
            data: null,
            mimeType: 'application/octet-stream',
            extension: '',
            size: 0,
          };
          break;
        }
        case ATTACH_ATTR.TITLE: {
          // Legacy ANSI filename (Shift_JIS in Japanese environments)
          if (currentAttachment) {
            const d = new TnefDecoder(attrData);
            currentAttachment.legacyName = d.decodeAnsiString(attrData, ansiEncoding);
          }
          break;
        }
        case ATTACH_ATTR.DATA: {
          if (currentAttachment) {
            currentAttachment.data = attrData;
            currentAttachment.size = attrData.length;
          }
          break;
        }
        case ATTACH_ATTR.MAPI_PROPS: {
          if (currentAttachment) {
            const parsed = parseAttachMapiProps(attrData, ansiEncoding);
            if (parsed.longFilename) currentAttachment.mapiLongFilename = parsed.longFilename;
            if (parsed.filename) currentAttachment.mapiFilename = parsed.filename;
            if (parsed.displayName) currentAttachment.mapiDisplayName = parsed.displayName;
            if (parsed.mimeType) currentAttachment.mimeType = parsed.mimeType;
            if (parsed.extension) currentAttachment.extension = parsed.extension;
            if (parsed.data) {
              currentAttachment.data = parsed.data;
              currentAttachment.size = parsed.data.length;
            }
          }
          break;
        }
      }
    }
  }

  // Push last attachment
  if (currentAttachment) {
    attachments.push(currentAttachment);
  }

  // Build final attachment list with name priority:
  // 1st: MAPI PidTagAttachLongFilename (Unicode)
  // 2nd: MAPI PidTagAttachFilename (Unicode)
  // 3rd: MAPI PidTagDisplayName (Unicode)
  // 4th: attAttachTitle (legacy ANSI / Shift_JIS)
  const finalAttachments: TnefAttachment[] = attachments
    .filter((a) => a.data && a.data.length > 0)
    .map((a) => {
      const name = a.mapiLongFilename || a.mapiFilename || a.mapiDisplayName || a.legacyName || 'attachment';
      return {
        name,
        size: a.size,
        data: a.data!,
        mimeType: a.mimeType !== 'application/octet-stream'
          ? a.mimeType
          : guessMimeType(name, a.extension),
      };
    });

  return { subject, from, body, bodyHtml, attachments: finalAttachments };
}

interface MapiResult {
  subject?: string;
  senderName?: string;
  senderEmail?: string;
  body?: string;
  bodyHtml?: string;
}

interface AttachMapiResult {
  filename?: string;
  longFilename?: string;
  displayName?: string;
  mimeType?: string;
  extension?: string;
  data?: Uint8Array;
}

function parseMapiProps(data: Uint8Array, ansiEncoding: string): MapiResult {
  const result: MapiResult = {};
  try {
    const d = new TnefDecoder(data);
    const count = d.readUint32LE();

    for (let i = 0; i < count && d.remaining > 4; i++) {
      const propType = d.readUint16LE();
      const propId = d.readUint16LE();

      // Skip named properties (ID >= 0x8000)
      if (propId >= 0x8000) {
        skipNamedPropHeader(d);
      }

      const value = readPropValue(d, propType, ansiEncoding);
      if (value === null) break;

      switch (propId) {
        case PROP.SUBJECT:
          if (typeof value === 'string') result.subject = value;
          break;
        case PROP.SENDER_NAME:
        case PROP.SENT_REPR_NAME:
          if (typeof value === 'string' && !result.senderName) result.senderName = value;
          break;
        case PROP.SENDER_EMAIL:
        case PROP.SENT_REPR_EMAIL:
          if (typeof value === 'string' && !result.senderEmail) result.senderEmail = value;
          break;
        case PROP.BODY:
          if (typeof value === 'string') result.body = value;
          break;
        case PROP.BODY_HTML:
          if (value instanceof Uint8Array) {
            result.bodyHtml = new TextDecoder('utf-8').decode(value);
          } else if (typeof value === 'string') {
            result.bodyHtml = value;
          }
          break;
      }
    }
  } catch {
    // Best-effort parsing — return what we got
  }
  return result;
}

function parseAttachMapiProps(data: Uint8Array, ansiEncoding: string): AttachMapiResult {
  const result: AttachMapiResult = {};
  try {
    const d = new TnefDecoder(data);
    const count = d.readUint32LE();

    for (let i = 0; i < count && d.remaining > 4; i++) {
      const propType = d.readUint16LE();
      const propId = d.readUint16LE();

      if (propId >= 0x8000) {
        skipNamedPropHeader(d);
      }

      const value = readPropValue(d, propType, ansiEncoding);
      if (value === null) break;

      switch (propId) {
        case PROP.ATTACH_FILENAME:
          if (typeof value === 'string') result.filename = value;
          break;
        case PROP.ATTACH_LONG_FILENAME:
          if (typeof value === 'string') result.longFilename = value;
          break;
        case PROP.DISPLAY_NAME:
          if (typeof value === 'string') result.displayName = value;
          break;
        case PROP.ATTACH_MIME_TAG:
          if (typeof value === 'string') result.mimeType = value;
          break;
        case PROP.ATTACH_EXTENSION:
          if (typeof value === 'string') result.extension = value;
          break;
        case PROP.ATTACH_DATA_BIN:
          if (value instanceof Uint8Array) result.data = value;
          break;
      }
    }
  } catch {
    // Best-effort parsing
  }
  return result;
}

function skipNamedPropHeader(d: TnefDecoder): void {
  // GUID (16 bytes)
  d.skip(16);
  // Kind (4 bytes)
  const kind = d.readUint32LE();
  if (kind === 0) {
    // Named by ID
    d.skip(4);
  } else {
    // Named by string
    const nameLen = d.readUint32LE();
    d.skip(pad4(nameLen));
  }
}

function readPropValue(
  d: TnefDecoder,
  propType: number,
  ansiEncoding: string,
): string | number | Uint8Array | null {
  try {
    switch (propType) {
      case PT.SHORT: {
        const val = d.readUint16LE();
        d.skip(2); // padding
        return val;
      }
      case PT.LONG:
      case PT.BOOLEAN: {
        return d.readUint32LE();
      }
      case PT.SYSTIME: {
        d.skip(8);
        return 0;
      }
      case PT.STRING8: {
        // Count of values (always 1 for single-value)
        const count = d.readUint32LE();
        if (count !== 1) {
          // Multi-value or unexpected — skip
          for (let j = 0; j < count; j++) {
            const len = d.readUint32LE();
            d.skip(pad4(len));
          }
          return null;
        }
        const len = d.readUint32LE();
        const bytes = d.readBytes(len);
        d.skip(pad4(len) - len);
        return d.decodeAnsiString(bytes, ansiEncoding);
      }
      case PT.UNICODE: {
        const count = d.readUint32LE();
        if (count !== 1) {
          for (let j = 0; j < count; j++) {
            const len = d.readUint32LE();
            d.skip(pad4(len));
          }
          return null;
        }
        const len = d.readUint32LE();
        const bytes = d.readBytes(len);
        d.skip(pad4(len) - len);
        return d.decodeUnicodeString(bytes);
      }
      case PT.BINARY: {
        const count = d.readUint32LE();
        if (count !== 1) {
          for (let j = 0; j < count; j++) {
            const len = d.readUint32LE();
            d.skip(pad4(len));
          }
          return null;
        }
        const len = d.readUint32LE();
        const bytes = d.readBytes(len);
        d.skip(pad4(len) - len);
        return bytes;
      }
      case PT.MV_STRING8:
      case PT.MV_UNICODE:
      case PT.MV_BINARY: {
        const count = d.readUint32LE();
        for (let j = 0; j < count; j++) {
          const len = d.readUint32LE();
          d.skip(pad4(len));
        }
        return null;
      }
      default: {
        // Unknown type — try to read as 4-byte value
        if (d.remaining >= 4) {
          d.skip(4);
        }
        return null;
      }
    }
  } catch {
    return null;
  }
}

function guessMimeType(name: string, ext: string): string {
  const e = (ext || name.split('.').pop() || '').toLowerCase().replace('.', '');
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    txt: 'text/plain',
    html: 'text/html',
    htm: 'text/html',
    csv: 'text/csv',
    xml: 'text/xml',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
    eml: 'message/rfc822',
    msg: 'application/vnd.ms-outlook',
    ics: 'text/calendar',
    vcf: 'text/vcard',
  };
  return map[e] || 'application/octet-stream';
}
