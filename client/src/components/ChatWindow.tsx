import { useState, useRef, useEffect } from 'react';
import type { DebugData } from '../App';
import type { UploadResponse } from '../types';
import { sendMessage } from '../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  refused?: boolean;
  hasWarning?: boolean;
}

interface ChatWindowProps {
  uploaded: UploadResponse | null;
  onDebugUpdate: (data: DebugData | null) => void;
  resetSignal: number;
}

function ChatWindow({ uploaded, onDebugUpdate, resetSignal }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(
    uploaded?.conversation_id
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    setConversationId(uploaded?.conversation_id);
    setInput('');
  }, [resetSignal, uploaded?.document_id, uploaded?.conversation_id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading || !uploaded) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendMessage(text, uploaded.document_id, conversationId);
      setConversationId(response.conversation_id);

      const flagsMinusRefusal = response.metadata.evaluator_flags.filter(
        (f) => f !== 'refusal'
      );
      const hasWarning = flagsMinusRefusal.length > 0;

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          refused: response.metadata.refused,
          hasWarning,
        },
      ]);

      onDebugUpdate({
        metadata: response.metadata,
        sources: response.sources,
      });
    } catch (err: any) {
      const data = err?.response?.data;
      let errorMsg = 'Error: Could not reach the server.';
      if (data?.code === 'DOCUMENT_NOT_FOUND') {
        errorMsg =
          'Document expired or server restarted. Please re-upload the PDF.';
      } else if (data?.error) {
        errorMsg = `Error: ${data.error}`;
      }
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: errorMsg },
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

  const disabled = !uploaded || loading;

  return (
    <div className="chat-window">
      <div className="messages">
        {!uploaded && (
          <div className="empty-state">
            <p>👋 Upload a PDF above to start chatting.</p>
          </div>
        )}
        {uploaded && messages.length === 0 && (
          <div className="empty-state">
            <p>
              Ready to answer questions about <b>{uploaded.filename}</b>.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`message message-${msg.role}${
              msg.refused ? ' message-refused' : ''
            }`}
          >
            <span className="message-label">
              {msg.role === 'user' ? 'You' : 'PDF Assistant'}
            </span>
            <p>{msg.content}</p>
            {msg.hasWarning && (
              <div className="warning-box">
                ⚠ Low retrieval confidence — verify against the source excerpts.
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="message message-assistant">
            <span className="message-label">PDF Assistant</span>
            <p className="typing-indicator">Thinking…</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <input
          type="text"
          placeholder={
            uploaded
              ? 'Ask a question about the PDF…'
              : 'Upload a PDF to enable chat'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <button onClick={handleSend} disabled={disabled || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatWindow;
