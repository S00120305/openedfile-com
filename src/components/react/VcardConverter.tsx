import { useState, useCallback } from 'react';
import FileDropZone from './FileDropZone';

interface VcardConverterProps {
  labels: {
    dropTitle: string;
    dropDescription: string;
    dropHint: string;
    downloadCsv: string;
    clearAll: string;
    errorNotVcf: string;
    errorParseFailed: string;
    contactsFound: string;
    name: string;
    email: string;
    phone: string;
    address: string;
    organization: string;
    noContacts: string;
    parsing: string;
  };
}

interface Contact {
  name: string;
  email: string;
  phone: string;
  address: string;
  organization: string;
}

function extractProperty(card: any, prop: string): string {
  try {
    const p = card.get(prop);
    if (!p) return '';
    if (Array.isArray(p)) {
      return p.map((item: any) => {
        const val = item.valueOf();
        if (Array.isArray(val)) return val.filter(Boolean).join(' ');
        return String(val || '');
      }).filter(Boolean).join('; ');
    }
    const val = p.valueOf();
    if (Array.isArray(val)) return val.filter(Boolean).join(' ');
    return String(val || '');
  } catch {
    return '';
  }
}

function extractName(card: any): string {
  // Try FN (formatted name) first
  const fn = extractProperty(card, 'fn');
  if (fn) return fn;

  // Fall back to N (structured name)
  try {
    const n = card.get('n');
    if (n) {
      const val = n.valueOf();
      if (Array.isArray(val)) {
        // N format: family;given;middle;prefix;suffix
        return val.filter(Boolean).join(' ').trim();
      }
      return String(val || '');
    }
  } catch {
    // ignore
  }

  return '';
}

export default function VcardConverter({ labels }: VcardConverterProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setError(null);
      setContacts([]);
      setIsParsing(true);

      try {
        const text = await file.text();

        // Basic VCF validation
        if (!text.includes('BEGIN:VCARD')) {
          setError(labels.errorNotVcf);
          setIsParsing(false);
          return;
        }

        const vCard = (await import('vcf')).default;

        // Split into individual vCard blocks
        const vcardBlocks = text.split(/(?=BEGIN:VCARD)/i).filter(block =>
          block.trim().toUpperCase().startsWith('BEGIN:VCARD')
        );

        const parsed: Contact[] = [];

        for (const block of vcardBlocks) {
          try {
            const card = new vCard().parse(block.trim());

            const contact: Contact = {
              name: extractName(card),
              email: extractProperty(card, 'email'),
              phone: extractProperty(card, 'tel'),
              address: extractProperty(card, 'adr'),
              organization: extractProperty(card, 'org'),
            };

            // Only add contacts with at least a name or email
            if (contact.name || contact.email) {
              parsed.push(contact);
            }
          } catch {
            // Skip individual invalid cards
          }
        }

        if (parsed.length === 0) {
          setError(labels.errorParseFailed);
        } else {
          setContacts(parsed);
        }
      } catch {
        setError(labels.errorParseFailed);
      } finally {
        setIsParsing(false);
      }
    },
    [labels],
  );

  const handleDownloadCsv = useCallback(() => {
    if (contacts.length === 0) return;

    const headers = [labels.name, labels.email, labels.phone, labels.address, labels.organization];

    const escapeCsvField = (field: string): string => {
      if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const rows = contacts.map(c => [
      escapeCsvField(c.name),
      escapeCsvField(c.email),
      escapeCsvField(c.phone),
      escapeCsvField(c.address),
      escapeCsvField(c.organization),
    ].join(','));

    // UTF-8 BOM + header + data rows
    const bom = '\uFEFF';
    const csv = bom + headers.map(escapeCsvField).join(',') + '\n' + rows.join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [contacts, labels]);

  const handleClear = useCallback(() => {
    setContacts([]);
    setError(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <FileDropZone
        accept=".vcf,.vcard"
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
      {contacts.length > 0 && (
        <div className="space-y-4">
          {/* Action bar */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {contacts.length} {labels.contactsFound}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {labels.downloadCsv}
              </button>
              <button
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                {labels.clearAll}
              </button>
            </div>
          </div>

          {/* Contacts table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{labels.name}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{labels.email}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{labels.phone}</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{labels.address}</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{labels.organization}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {contacts.map((contact, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{contact.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 break-all">{contact.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{contact.phone || '—'}</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{contact.address || '—'}</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{contact.organization || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
