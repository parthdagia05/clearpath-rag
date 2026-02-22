import ChatWindow from './components/ChatWindow';
import DebugPanel from './components/DebugPanel';
import { useState } from 'react';
import './App.css';

export interface DebugInfo {
  model: string;
  tokensUsed: number;
  latencyMs: number;
  evaluatorFlag: string;
}

function App() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>ClearPath Support</h1>
      </header>
      <main className="app-main">
        <ChatWindow onDebugUpdate={setDebugInfo} />
        <DebugPanel debugInfo={debugInfo} />
      </main>
    </div>
  );
}

export default App;
