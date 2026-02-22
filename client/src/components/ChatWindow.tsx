import { useState, useRef, useEffect } from 'react';
import type { DebugData } from '../App';
import { sendMessage } from '../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hasWarning?: boolean;
}

interface ChatWindowProps {
  onDebugUpdate: (data: DebugData | null) => void;
}

function ChatWindow({ onDebugUpdate }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendMessage(text, conversationId);

      // Track conversation ID across turns
      setConversationId(response.conversation_id);

      const hasWarning = response.metadata.evaluator_flags.length > 0;

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.answer, hasWarning },
      ]);

      onDebugUpdate({
        metadata: response.metadata,
        sources: response.sources,
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error: Could not reach the server.' },
      ]);
      onDebugUpdate(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-window">
      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-state">
            <p>👋 How can we help you today?</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <span className="message-label">
              {msg.role === 'user' ? 'You' : 'ClearPath'}
            </span>
            <p>{msg.content}</p>
            {msg.hasWarning && (
              <div className="warning-box">
                ⚠ Low confidence — please verify with support.
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="message message-assistant">
            <span className="message-label">ClearPath</span>
            <p className="typing-indicator">Thinking…</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input
          type="text"
          placeholder="Type your message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatWindow;
