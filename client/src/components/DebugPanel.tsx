import type { DebugInfo } from '../App';

interface DebugPanelProps {
  debugInfo: DebugInfo | null;
}

function DebugPanel({ debugInfo }: DebugPanelProps) {
  return (
    <div className="debug-panel">
      <h3>Debug Panel</h3>
      <div className="debug-grid">
        <div className="debug-item">
          <span className="debug-label">Model Used</span>
          <span className="debug-value">{debugInfo?.model ?? '—'}</span>
        </div>
        <div className="debug-item">
          <span className="debug-label">Tokens Used</span>
          <span className="debug-value">{debugInfo?.tokensUsed ?? '—'}</span>
        </div>
        <div className="debug-item">
          <span className="debug-label">Latency</span>
          <span className="debug-value">
            {debugInfo?.latencyMs != null ? `${debugInfo.latencyMs}ms` : '—'}
          </span>
        </div>
        <div className="debug-item">
          <span className="debug-label">Evaluator Flag</span>
          <span className="debug-value">{debugInfo?.evaluatorFlag ?? '—'}</span>
        </div>
      </div>
    </div>
  );
}

export default DebugPanel;
