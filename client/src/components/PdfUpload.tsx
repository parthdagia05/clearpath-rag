import { useRef, useState } from 'react';
import type { UploadResponse } from '../types';
import { uploadPdf } from '../services/api';

interface PdfUploadProps {
  uploaded: UploadResponse | null;
  onUploaded: (info: UploadResponse) => void;
  onReset: () => void;
}

function PdfUpload({ uploaded, onUploaded, onReset }: PdfUploadProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are accepted.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('PDF must be 15MB or smaller.');
      return;
    }
    setLoading(true);
    try {
      const info = await uploadPdf(file);
      onUploaded(info);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        'Upload failed. Check the server.';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (uploaded) {
    return (
      <div className="upload-card uploaded">
        <div className="upload-row">
          <div>
            <div className="upload-filename" title={uploaded.filename}>
              📄 {uploaded.filename}
            </div>
            <div className="upload-meta">
              {uploaded.page_count} page{uploaded.page_count === 1 ? '' : 's'} ·{' '}
              {uploaded.chunk_count} chunks · model: {uploaded.embedding_model}
            </div>
          </div>
          <button className="upload-reset" onClick={onReset} disabled={loading}>
            Upload another PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-card">
      <div
        className={`drop-zone${dragOver ? ' drag-over' : ''}${
          loading ? ' loading' : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !loading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={onPick}
          style={{ display: 'none' }}
        />
        {loading ? (
          <>
            <div className="drop-title">Processing PDF…</div>
            <div className="drop-sub">
              Extracting pages, chunking, embedding. This can take 10–30s on first upload.
            </div>
          </>
        ) : (
          <>
            <div className="drop-title">📥 Drop a PDF here, or click to choose</div>
            <div className="drop-sub">Max 15MB · text-based PDFs only (no OCR)</div>
          </>
        )}
      </div>
      {error && <div className="upload-error">⚠ {error}</div>}
    </div>
  );
}

export default PdfUpload;
