import ChatWindow from './components/ChatWindow';
import DebugPanel from './components/DebugPanel';
import { useState } from 'react';
import type { QueryMetadata, Source } from './types';
import './App.css';

export interface DebugData {
  metadata: QueryMetadata;
  sources: Source[];
}

function App() {
  const [debugData, setDebugData] = useState<DebugData | null>(null);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>ClearPath Support</h1>
      </header>
      <main className="app-main">
        <ChatWindow onDebugUpdate={setDebugData} />
        <DebugPanel debugData={debugData} />
      </main>
    </div>
  );
}

export default App;
