import { formatBytes } from '@/lib/utils';

export const MAX_DOCUMENT_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export function validateDocumentFile(file: File): string | null {
  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    return `File size exceeds 10MB limit (selected: ${formatBytes(file.size)})`;
  }
  if (!ALLOWED_DOCUMENT_TYPES.includes(file.type)) {
    return 'Only PDF, JPEG, and PNG files are supported';
  }
  return null;
}
