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

/**
 * Simple vCard parser that handles vCard 2.1, 3.0, and 4.0.
 * vCard is a text format with BEGIN:VCARD / END:VCARD blocks,
 * each line being PROPERTY;PARAM=VALUE:DATA
 */
function parseVcardFile(text: string): Contact[] {
  const contacts: Contact[] = [];

  // Normalize line endings and unfold continuation lines
  // (RFC 6350: a line starting with space or tab is a continuation)
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const unfolded = normalized.replace(/\n[ \t]/g, '');

  // Extract individual vCard blocks
  const blockRegex = /BEGIN:VCARD\n([\s\S]*?)END:VCARD/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(unfolded)) !== null) {
    const block = match[1];
    const lines = block.split('\n').filter(l => l.trim());

    const emails: string[] = [];
    const phones: string[] = [];
    const addresses: string[] = [];
    const orgs: string[] = [];
    let fn = '';
    let n = '';

    for (const line of lines) {
      // Split into property name (with params) and value
      // Handle properties like "TEL;TYPE=CELL:090-1234-5678"
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const propPart = line.substring(0, colonIdx);
      const value = line.substring(colonIdx + 1).trim();
      if (!value) continue;

      // Extract the base property name (before any ;PARAM)
      const propName = propPart.split(';')[0].toUpperCase();

      switch (propName) {
        case 'FN':
          fn = value;
          break;
        case 'N': {
          // N:Family;Given;Middle;Prefix;Suffix
          const parts = value.split(';').map(s => s.trim()).filter(Boolean);
          if (parts.length > 0) {
            n = parts.join(' ');
          }
          break;
        }
        case 'EMAIL':
          emails.push(value);
          break;
        case 'TEL':
          phones.push(value);
          break;
        case 'ADR': {
          // ADR:;;Street;City;State;Zip;Country
          const adrParts = value.split(';').map(s => s.trim()).filter(Boolean);
          if (adrParts.length > 0) {
            addresses.push(adrParts.join(' '));
          }
          break;
        }
        case 'ORG':
          // ORG can have multiple levels: Company;Division;Department
          orgs.push(value.split(';').map(s => s.trim()).filter(Boolean).join(' '));
          break;
      }
    }

    const contact: Contact = {
      name: fn || n,
      email: emails.join('; '),
      phone: phones.join('; '),
      address: addresses.join('; '),
      organization: orgs.join('; '),
    };

    // Only add contacts with at least a name or email
    if (contact.name || contact.email) {
      contacts.push(contact);
    }
  }

  return contacts;
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

        const parsed = parseVcardFile(text);

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
