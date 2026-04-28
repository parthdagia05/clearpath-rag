import type { DebugData } from '../App';
import type { UploadResponse } from '../types';

interface DebugPanelProps {
  debugData: DebugData | null;
  uploaded: UploadResponse | null;
}

function DebugPanel({ debugData, uploaded }: DebugPanelProps) {
  const meta = debugData?.metadata;
  const sources = debugData?.sources ?? [];
  const flags = meta?.evaluator_flags ?? [];

  return (
    <div className="debug-panel">
      <h3>Debug Panel</h3>

      {uploaded && (
        <div className="document-card">
          <div className="document-title">📄 {uploaded.filename}</div>
          <div className="document-meta">
            <span>document_id:</span> <code>{uploaded.document_id}</code>
          </div>
          <div className="document-meta">
            <span>pages:</span> {uploaded.page_count} ·{' '}
            <span>chunks:</span> {uploaded.chunk_count}
          </div>
          <div className="document-meta">
            <span>embedding:</span> {uploaded.embedding_model}
          </div>
        </div>
      )}

      <div className="debug-grid">
        <div className="debug-item">
          <span className="debug-label">Model</span>
          <span className="debug-value">{meta?.model_used ?? '—'}</span>
        </div>
        <div className="debug-item">
          <span className="debug-label">Classification</span>
          <span className="debug-value">{meta?.classification ?? '—'}</span>
        </div>
        <div className="debug-item">
          <span className="debug-label">Refused</span>
          <span className="debug-value">
            {meta == null ? '—' : meta.refused ? 'yes' : 'no'}
          </span>
        </div>
        <div className="debug-item">
          <span className="debug-label">Tokens In / Out</span>
          <span className="debug-value">
            {meta?.tokens.input ?? '—'} / {meta?.tokens.output ?? '—'}
          </span>
        </div>
        <div className="debug-item">
          <span className="debug-label">Latency</span>
          <span className="debug-value">
            {meta?.latency_ms != null ? `${meta.latency_ms}ms` : '—'}
          </span>
        </div>
        <div className="debug-item">
          <span className="debug-label">Chunks Retrieved</span>
          <span className="debug-value">{meta?.chunks_retrieved ?? '—'}</span>
        </div>
        <div className="debug-item">
          <span className="debug-label">Evaluator Flags</span>
          <span className="debug-value">
            {flags.length > 0 ? flags.join(', ') : '—'}
          </span>
        </div>
      </div>

      {sources.length > 0 && (
        <>
          <h3 className="sources-heading">Citations</h3>
          <div className="sources-list">
            {sources.map((src, i) => (
              <div key={i} className="source-item">
                <span className="source-doc">
                  {src.page != null ? `Page ${src.page}` : 'Document'} ·{' '}
                  <span className="source-score">
                    score {src.relevance_score.toFixed(3)}
                  </span>
                </span>
                <p className="source-excerpt">"{src.excerpt}"</p>
              </div>
            ))}
          </div>
        </>
      )}

      {flags.length > 0 && !flags.includes('refusal') && (
        <div className="evaluator-warning">
          ⚠ Low retrieval confidence — answer may be ungrounded.
        </div>
      )}
    </div>
  );
}

export default DebugPanel;
