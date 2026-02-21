import { useState, useCallback, useRef, useEffect } from 'react';
import FileDropZone from './FileDropZone';
import { parseTnef, type TnefParseResult, type TnefAttachment } from '../../lib/tnef-parser';

interface WinmailConverterProps {
  labels: {
    dropTitle: string;
    dropDescription: string;
    dropHint: string;
    download: string;
    downloadAllZip: string;
    clearAll: string;
    errorNotTnef: string;
    errorParseFailed: string;
    subject: string;
    from: string;
    bodyText: string;
    bodyHtml: string;
    attachments: string;
    noAttachments: string;
    noBody: string;
    fileName: string;
    fileSize: string;
    parsing: string;
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function sanitizeHtml(html: string): string {
  // Lazy import of DOMPurify would be ideal, but we need it synchronously
  // Use a basic sanitizer as fallback; DOMPurify is loaded dynamically below
  return html;
}

export default function WinmailConverter({ labels }: WinmailConverterProps) {
  const [result, setResult] = useState<TnefParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [showHtml, setShowHtml] = useState(false);
  const [sanitizedHtml, setSanitizedHtml] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sanitize HTML when result changes
  useEffect(() => {
    if (result?.bodyHtml) {
      import('dompurify').then((mod) => {
        const DOMPurify = mod.default;
        const clean = DOMPurify.sanitize(result.bodyHtml, {
          ALLOW_TAGS: [
            'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'a', 'ul', 'ol', 'li',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody',
            'tr', 'td', 'th', 'div', 'span', 'img', 'blockquote', 'pre', 'code', 'hr',
          ],
          ALLOW_ATTR: ['href', 'src', 'alt', 'title', 'style', 'class', 'width', 'height', 'colspan', 'rowspan'],
          FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
        });
        setSanitizedHtml(clean);
      });
    }
  }, [result?.bodyHtml]);

  // Write sanitized HTML to sandbox iframe
  useEffect(() => {
    if (showHtml && sanitizedHtml && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #333; padding: 16px; margin: 0; line-height: 1.6; }
          img { max-width: 100%; height: auto; }
          a { color: #2563eb; }
          table { border-collapse: collapse; } td, th { border: 1px solid #ddd; padding: 4px 8px; }
        </style></head><body>${sanitizedHtml}</body></html>`);
        doc.close();
      }
    }
  }, [showHtml, sanitizedHtml]);

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setError(null);
      setResult(null);
      setShowHtml(false);
      setSanitizedHtml('');
      setIsParsing(true);

      try {
        const buffer = await file.arrayBuffer();
        const parsed = parseTnef(buffer);
        setResult(parsed);
      } catch (err) {
        const message = err instanceof Error ? err.message : '';
        if (message.includes('Not a valid TNEF')) {
          setError(labels.errorNotTnef);
        } else {
          setError(labels.errorParseFailed);
        }
      } finally {
        setIsParsing(false);
      }
    },
    [labels],
  );

  const handleDownloadAttachment = useCallback((attachment: TnefAttachment) => {
    const blob = new Blob([attachment.data], { type: attachment.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (!result || result.attachments.length === 0) return;

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const att of result.attachments) {
      zip.file(att.name, att.data);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'winmail-attachments.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  const handleClear = useCallback(() => {
    setResult(null);
    setError(null);
    setShowHtml(false);
    setSanitizedHtml('');
  }, []);

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <FileDropZone
        accept=".dat"
        multiple={false}
        onFilesSelected={handleFilesSelected}
        title={labels.dropTitle}
        description={labels.dropDescription}
        hint={labels.dropHint}
        disabled={isParsing}
      />

      {/* Parsing indicator */}
      {isParsing && (
        <div className="flex items-center justify-center gap-2 py-8 text-primary-600 dark:text-primary-400">
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-medium">{labels.parsing}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/50">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <p className="text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Email metadata */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            {result.subject && (
              <div className="mb-3">
                <span className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">{labels.subject}</span>
                <p className="mt-0.5 text-base font-semibold text-gray-900 dark:text-white">{result.subject}</p>
              </div>
            )}
            {result.from && (
              <div>
                <span className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">{labels.from}</span>
                <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">{result.from}</p>
              </div>
            )}
          </div>

          {/* Body */}
          {(result.body || result.bodyHtml) && (
            <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
              {/* Tab headers */}
              {result.body && result.bodyHtml && (
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowHtml(false)}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                      !showHtml
                        ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {labels.bodyText}
                  </button>
                  <button
                    onClick={() => setShowHtml(true)}
                    className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                      showHtml
                        ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {labels.bodyHtml}
                  </button>
                </div>
              )}

              <div className="p-5">
                {!showHtml && result.body ? (
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
                    {result.body}
                  </pre>
                ) : showHtml && sanitizedHtml ? (
                  <iframe
                    ref={iframeRef}
                    sandbox="allow-popups"
                    title="Email content"
                    className="w-full min-h-[200px] rounded-lg border border-gray-100 bg-white dark:border-gray-600"
                    style={{ height: '400px' }}
                  />
                ) : result.body ? (
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
                    {result.body}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">{labels.noBody}</p>
                )}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {labels.attachments} ({result.attachments.length})
              </h3>
              <div className="flex gap-2">
                {result.attachments.length > 1 && (
                  <button
                    onClick={handleDownloadAll}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    {labels.downloadAllZip}
                  </button>
                )}
                <button
                  onClick={handleClear}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                  {labels.clearAll}
                </button>
              </div>
            </div>

            {result.attachments.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                {labels.noAttachments}
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {result.attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    {/* File type icon */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700">
                      <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                      </svg>
                    </div>
                    {/* File info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{att.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(att.size)}</p>
                    </div>
                    {/* Download button */}
                    <button
                      onClick={() => handleDownloadAttachment(att)}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 dark:bg-primary-950 dark:text-primary-300 dark:hover:bg-primary-900 transition-colors"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      {labels.download}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
