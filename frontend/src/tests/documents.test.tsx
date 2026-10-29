import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DocumentUploadModal } from '@/features/documents/DocumentUploadModal';
import { DocumentReviewModal } from '@/features/documents/DocumentReviewModal';
import { DocumentResponse } from '@/types/document';

describe('Document Management', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects files larger than 10MB in DocumentUploadModal', async () => {
    const mockSuccess = vi.fn();
    const mockClose = vi.fn();

    render(
      <DocumentUploadModal
        isOpen={true}
        onClose={mockClose}
        caseId="case-1"
        onSuccess={mockSuccess}
      />
    );

    // Create an oversized synthetic file (11MB)
    const largeBlob = new Blob([new Uint8Array(11 * 1024 * 1024)], { type: 'application/pdf' });
    const largeFile = new File([largeBlob], 'large-document.pdf', { type: 'application/pdf' });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    expect(await screen.findByText(/File size exceeds 10MB limit/i)).toBeInTheDocument();
  });

  it('rejects unsupported file formats in DocumentUploadModal', async () => {
    const mockSuccess = vi.fn();
    const mockClose = vi.fn();

    render(
      <DocumentUploadModal
        isOpen={true}
        onClose={mockClose}
        caseId="case-1"
        onSuccess={mockSuccess}
      />
    );

    const txtFile = new File(['sample content'], 'test.txt', { type: 'text/plain' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [txtFile] } });

    expect(
      await screen.findByText(/Only PDF, JPEG, and PNG files are supported/i)
    ).toBeInTheDocument();
  });

  it('allows staff to accept document in DocumentReviewModal', async () => {
    const mockSuccess = vi.fn();
    const mockClose = vi.fn();

    const sampleDoc: DocumentResponse = {
      id: 'doc-1',
      caseId: 'case-1',
      documentType: 'IDENTITY_EVIDENCE',
      status: 'PENDING_REVIEW',
      currentVersion: 1,
      filename: 'passport.pdf',
      contentType: 'application/pdf',
      size: 10240,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/auth/csrf')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ headerName: 'X-XSRF-TOKEN', token: 'token' }),
        });
      }
      if (url.includes('/status')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ...sampleDoc, status: 'ACCEPTED' }),
        });
      }
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });

    render(
      <DocumentReviewModal
        isOpen={true}
        onClose={mockClose}
        caseId="case-1"
        document={sampleDoc}
        onSuccess={mockSuccess}
      />
    );

    const acceptBtn = screen.getByRole('button', { name: /Accept Document/i });
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACCEPTED' })
      );
      expect(mockClose).toHaveBeenCalled();
    });
  });
});
