/** Parsed result from a TNEF (winmail.dat) file */
export interface TnefParseResult {
  subject: string;
  from: string;
  body: string;
  bodyHtml: string;
  attachments: TnefAttachment[];
}

/** A single attachment extracted from a TNEF file */
export interface TnefAttachment {
  name: string;
  size: number;
  data: Uint8Array;
  mimeType: string;
}

/** TNEF attribute levels */
export const LVL_MESSAGE = 0x01;
export const LVL_ATTACHMENT = 0x02;

/** TNEF signature */
export const TNEF_SIGNATURE = 0x223e9f78;

/** TNEF message-level attribute IDs */
export const ATTR = {
  FROM: 0x8000,
  SUBJECT: 0x8004,
  DATE_SENT: 0x8005,
  BODY: 0x800c,
  MAPI_PROPS: 0x9003,
  RECIP_TABLE: 0x9006,
  OEM_CODEPAGE: 0x9007,
} as const;

/** TNEF attachment-level attribute IDs */
export const ATTACH_ATTR = {
  REND_DATA: 0x9002,
  DATA: 0x800f,
  TITLE: 0x8010,
  META_FILE: 0x8011,
  CREATE_DATE: 0x8012,
  MODIFY_DATE: 0x8013,
  MAPI_PROPS: 0x9005,
} as const;

/** MAPI property types */
export const PT = {
  SHORT: 0x0002,
  LONG: 0x0003,
  BOOLEAN: 0x000b,
  STRING8: 0x001e,
  UNICODE: 0x001f,
  SYSTIME: 0x0040,
  BINARY: 0x0102,
  MV_STRING8: 0x101e,
  MV_UNICODE: 0x101f,
  MV_BINARY: 0x1102,
} as const;

/** MAPI property IDs */
export const PROP = {
  SUBJECT: 0x0037,
  SENDER_NAME: 0x0c1a,
  SENDER_EMAIL: 0x0c1f,
  SENT_REPR_NAME: 0x0042,
  SENT_REPR_EMAIL: 0x0065,
  BODY: 0x1000,
  BODY_HTML: 0x1013,
  DISPLAY_NAME: 0x3001,
  ATTACH_DATA_BIN: 0x3701,
  ATTACH_FILENAME: 0x3704,
  ATTACH_LONG_FILENAME: 0x3707,
  ATTACH_EXTENSION: 0x3703,
  ATTACH_MIME_TAG: 0x370e,
  ATTACH_SIZE: 0x0e20,
} as const;
