interface ConversionResultItem {
  id: string;
  fileName: string;
  originalSize: number;
  convertedSize?: number;
  status: 'pending' | 'converting' | 'done' | 'error';
  error?: string;
  previewUrl?: string;
  downloadUrl?: string;
  outputFileName?: string;
}

interface ConversionResultProps {
  items: ConversionResultItem[];
  onDownload: (item: ConversionResultItem) => void;
  onDownloadAll: () => void;
  onClear: () => void;
  labels: {
    download: string;
    downloadAllZip: string;
    clearAll: string;
    originalSize: string;
    convertedSize: string;
    reduction: string;
    increase: string;
    statusConverting: string;
    statusDone: string;
    statusError: string;
    pending: string;
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export type { ConversionResultItem };

export default function ConversionResult({
  items,
  onDownload,
  onDownloadAll,
  onClear,
  labels,
}: ConversionResultProps) {
  const completedItems = items.filter((item) => item.status === 'done');
  const hasCompleted = completedItems.length > 0;
  const allDone = items.every((item) => item.status === 'done' || item.status === 'error');

  return (
    <div className="mt-6 space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {completedItems.length}/{items.length}{' '}
          {labels.statusDone.toLowerCase()}
        </p>
        <div className="flex gap-2">
          {hasCompleted && items.length > 1 && (
            <button
              onClick={onDownloadAll}
              disabled={!allDone}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {labels.downloadAllZip}
            </button>
          )}
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            {labels.clearAll}
          </button>
        </div>
      </div>

      {/* Results list */}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
          >
            {/* Preview thumbnail */}
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
              {item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt={item.fileName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <svg className="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                </div>
              )}
            </div>

            {/* File info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                {item.outputFileName || item.fileName}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                <span>
                  {labels.originalSize}: {formatFileSize(item.originalSize)}
                </span>
                {item.convertedSize != null && (
                  <>
                    <span>
                      {labels.convertedSize}: {formatFileSize(item.convertedSize)}
                    </span>
                    {(() => {
                      const diff = item.originalSize - item.convertedSize;
                      const pct = Math.abs(Math.round((diff / item.originalSize) * 100));
                      if (diff > 0) {
                        return <span className="text-green-600 dark:text-green-400">-{pct}% {labels.reduction}</span>;
                      } else if (diff < 0) {
                        return <span className="text-orange-500 dark:text-orange-400">+{pct}% {labels.increase}</span>;
                      }
                      return null;
                    })()}
                  </>
                )}
              </div>
              {item.error && (
                <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{item.error}</p>
              )}
            </div>

            {/* Status / Action */}
            <div className="shrink-0">
              {item.status === 'pending' && (
                <span className="text-xs text-gray-400 dark:text-gray-500">{labels.pending}</span>
              )}
              {item.status === 'converting' && (
                <div className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {labels.statusConverting}
                </div>
              )}
              {item.status === 'done' && (
                <button
                  onClick={() => onDownload(item)}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 dark:bg-primary-950 dark:text-primary-300 dark:hover:bg-primary-900 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  {labels.download}
                </button>
              )}
              {item.status === 'error' && (
                <span className="text-xs font-medium text-red-600 dark:text-red-400">{labels.statusError}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
