import type { DebugData } from '../App';

interface DebugPanelProps {
  debugData: DebugData | null;
}

function DebugPanel({ debugData }: DebugPanelProps) {
  const meta = debugData?.metadata;
  const sources = debugData?.sources ?? [];
  const flags = meta?.evaluator_flags ?? [];

  return (
    <div className="debug-panel">
      <h3>Debug Panel</h3>

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
          <span className="debug-label">Tokens In</span>
          <span className="debug-value">{meta?.tokens.input ?? '—'}</span>
        </div>
        <div className="debug-item">
          <span className="debug-label">Tokens Out</span>
          <span className="debug-value">{meta?.tokens.output ?? '—'}</span>
        </div>
        <div className="debug-item">
          <span className="debug-label">Latency</span>
          <span className="debug-value">
            {meta?.latency_ms != null ? `${meta.latency_ms}ms` : '—'}
          </span>
        </div>
        <div className="debug-item">
          <span className="debug-label">Chunks Retrieved</span>
          <span className="debug-value">
            {meta?.chunks_retrieved ?? '—'}
          </span>
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
          <h3 className="sources-heading">Sources</h3>
          <div className="sources-list">
            {sources.map((src, i) => (
              <div key={i} className="source-item">
                <span className="source-doc">{src.document}</span>
                <div className="source-details">
                  <span>Page: {src.page ?? 'N/A'}</span>
                  <span>Score: {src.relevance_score.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {flags.length > 0 && (
        <div className="evaluator-warning">
          ⚠ Low confidence — please verify with support.
        </div>
      )}
    </div>
  );
}

export default DebugPanel;
