import { useState, useCallback, useRef } from 'react';
import FileDropZone from './FileDropZone';
import ConversionResult, { type ConversionResultItem } from './ConversionResult';

type OutputFormat = 'jpg' | 'png';

interface HeicConverterProps {
  labels: {
    outputFormat: string;
    quality: string;
    dropTitle: string;
    dropDescription: string;
    dropHint: string;
    convertAll: string;
    converting: string;
    download: string;
    downloadAllZip: string;
    clearAll: string;
    originalSize: string;
    convertedSize: string;
    reduction: string;
    increase: string;
    errorNotHeic: string;
    errorConversionFailed: string;
    errorFileTooLarge: string;
    filesSelected: string;
    converted: string;
    pending: string;
    statusConverting: string;
    statusDone: string;
    statusError: string;
  };
}

let idCounter = 0;
function generateId(): string {
  return `heic-${++idCounter}-${Date.now()}`;
}

function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.heic') ||
    name.endsWith('.heif') ||
    file.type === 'image/heic' ||
    file.type === 'image/heif'
  );
}

async function convertHeic(
  file: File,
  format: OutputFormat,
  quality: number,
): Promise<{ blob: Blob; previewUrl: string }> {
  const { heicTo } = await import('heic-to');

  const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const blob = await heicTo({
    blob: file,
    type: mimeType,
    quality: format === 'jpg' ? quality / 100 : undefined,
  });

  const previewUrl = URL.createObjectURL(blob);
  return { blob, previewUrl };
}

export default function HeicConverter({ labels }: HeicConverterProps) {
  const [format, setFormat] = useState<OutputFormat>('jpg');
  const [quality, setQuality] = useState(90);
  const [items, setItems] = useState<ConversionResultItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const downloadUrlsRef = useRef<Map<string, string>>(new Map());

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      const newItems: (ConversionResultItem & { file: File })[] = files.map((file) => {
        const valid = isHeicFile(file);
        return {
          id: generateId(),
          fileName: file.name,
          originalSize: file.size,
          status: valid ? ('pending' as const) : ('error' as const),
          error: valid ? undefined : labels.errorNotHeic,
          file,
        };
      });

      setItems((prev) => [...prev, ...newItems]);

      const validFiles = newItems.filter((item) => item.status === 'pending');
      if (validFiles.length > 0) {
        convertFiles(validFiles, format, quality);
      }
    },
    [format, quality, labels.errorNotHeic],
  );

  const convertFiles = async (
    filesToConvert: (ConversionResultItem & { file: File })[],
    fmt: OutputFormat,
    qual: number,
  ) => {
    setIsConverting(true);

    for (const item of filesToConvert) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'converting' as const } : i)),
      );

      try {
        const { blob, previewUrl } = await convertHeic(item.file, fmt, qual);
        const ext = fmt === 'jpg' ? '.jpg' : '.png';
        const baseName = item.fileName.replace(/\.(heic|heif)$/i, '');
        const outputFileName = `${baseName}${ext}`;
        const downloadUrl = URL.createObjectURL(blob);

        downloadUrlsRef.current.set(item.id, downloadUrl);

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'done' as const,
                  convertedSize: blob.size,
                  previewUrl,
                  downloadUrl,
                  outputFileName,
                }
              : i,
          ),
        );
      } catch {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: 'error' as const, error: labels.errorConversionFailed }
              : i,
          ),
        );
      }
    }

    setIsConverting(false);
  };

  const handleDownload = useCallback((item: ConversionResultItem) => {
    if (!item.downloadUrl || !item.outputFileName) return;
    const a = document.createElement('a');
    a.href = item.downloadUrl;
    a.download = item.outputFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleDownloadAll = useCallback(async () => {
    const completedItems = items.filter((item) => item.status === 'done' && item.downloadUrl);
    if (completedItems.length === 0) return;

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const item of completedItems) {
      if (!item.downloadUrl || !item.outputFileName) continue;
      const response = await fetch(item.downloadUrl);
      const blob = await response.blob();
      zip.file(item.outputFileName, blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted-photos.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [items]);

  const handleClear = useCallback(() => {
    for (const item of items) {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item.downloadUrl) URL.revokeObjectURL(item.downloadUrl);
    }
    downloadUrlsRef.current.clear();
    setItems([]);
  }, [items]);

  return (
    <div className="space-y-6">
      {/* Settings panel */}
      <div className="flex flex-wrap items-end gap-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        {/* Output format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {labels.outputFormat}
          </label>
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
            <button
              onClick={() => setFormat('jpg')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                format === 'jpg'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              JPG
            </button>
            <button
              onClick={() => setFormat('png')}
              className={`px-4 py-2 text-sm font-medium border-l border-gray-300 dark:border-gray-600 transition-colors ${
                format === 'png'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              PNG
            </button>
          </div>
        </div>

        {/* Quality slider (JPG only) */}
        {format === 'jpg' && (
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {labels.quality}: {quality}%
            </label>
            <input
              type="range"
              min={1}
              max={100}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-primary-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1%</span>
              <span>100%</span>
            </div>
          </div>
        )}
      </div>

      {/* Drop zone */}
      <FileDropZone
        accept=".heic,.heif,image/heic,image/heif"
        multiple
        onFilesSelected={handleFilesSelected}
        title={labels.dropTitle}
        description={labels.dropDescription}
        hint={labels.dropHint}
        disabled={isConverting}
      />

      {/* Results */}
      {items.length > 0 && (
        <ConversionResult
          items={items}
          onDownload={handleDownload}
          onDownloadAll={handleDownloadAll}
          onClear={handleClear}
          labels={{
            download: labels.download,
            downloadAllZip: labels.downloadAllZip,
            clearAll: labels.clearAll,
            originalSize: labels.originalSize,
            convertedSize: labels.convertedSize,
            reduction: labels.reduction,
            increase: labels.increase,
            statusConverting: labels.statusConverting,
            statusDone: labels.statusDone,
            statusError: labels.statusError,
            pending: labels.pending,
          }}
        />
      )}
    </div>
  );
}
