import { useState } from 'react';
import ChatWindow from './components/ChatWindow';
import DebugPanel from './components/DebugPanel';
import PdfUpload from './components/PdfUpload';
import { deleteDocument } from './services/api';
import type { QueryMetadata, Source, UploadResponse } from './types';
import './App.css';

export interface DebugData {
  metadata: QueryMetadata;
  sources: Source[];
}

function App() {
  const [uploaded, setUploaded] = useState<UploadResponse | null>(null);
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [resetCounter, setResetCounter] = useState(0);

  const handleUploaded = (info: UploadResponse) => {
    setUploaded(info);
    setDebugData(null);
    setResetCounter((c) => c + 1);
  };

  const handleReset = async () => {
    if (uploaded) {
      try {
        await deleteDocument(uploaded.document_id);
      } catch {
        // best-effort; server may have already evicted
      }
    }
    setUploaded(null);
    setDebugData(null);
    setResetCounter((c) => c + 1);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>PDF Chat</h1>
        <span className="app-subtitle">
          Ask questions about any PDF — answers strictly grounded in the document.
        </span>
      </header>
      <main className="app-main">
        <div className="left-pane">
          <PdfUpload
            uploaded={uploaded}
            onUploaded={handleUploaded}
            onReset={handleReset}
          />
          <ChatWindow
            uploaded={uploaded}
            onDebugUpdate={setDebugData}
            resetSignal={resetCounter}
          />
        </div>
        <DebugPanel debugData={debugData} uploaded={uploaded} />
      </main>
    </div>
  );
}

export default App;
