import { useState, useRef, useEffect } from 'react';
import { Send, Crown } from 'lucide-react';
import { useMessages } from '@/lib/hooks';
import { sendChatMessage } from '@/lib/gameApi';
import { useToast } from './Toast';

interface ChatProps {
  gameId: string;
  senderToken: string;
  selfName: string;
  selfType: 'player' | 'moderator';
}

export function Chat({
  gameId,
  senderToken,
  selfName,
  selfType,
}: ChatProps) {
  const { messages } = useMessages(gameId);
  const { show } = useToast();

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();

    if (!trimmed || sending) return;

    setSending(true);

    try {
      await sendChatMessage(gameId, senderToken, trimmed);
      setText('');
    } catch (e) {
      show(
        e instanceof Error ? e.message : 'Failed to send message',
        'error'
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-1">
        {messages.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-4">
            No messages yet. Say hi!
          </p>
        ) : (
          messages.map((m) => {
            const isSelf =
              m.sender_name === selfName && m.sender_type === selfType;

            return (
              <div
                key={m.id}
                className={`flex flex-col ${
                  isSelf ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-1 mb-0.5 px-1">
                  {m.sender_type === 'moderator' && (
                    <Crown className="w-3 h-3 text-amber-400" />
                  )}
                  <span
                    className={`text-[11px] font-semibold ${
                      m.sender_type === 'moderator'
                        ? 'text-amber-400'
                        : 'text-blue-400'
                    }`}
                  >
                    {isSelf ? 'You' : m.sender_name}
                  </span>
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm break-words ${
                    isSelf
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                  }`}
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={listEndRef} />
      </div>

      <div className="flex-shrink-0 flex items-center gap-2 mt-2 pt-2 border-t border-slate-800/60">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={500}
          disabled={sending}
          className="flex-1 min-w-0 px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm placeholder-slate-600 focus:border-blue-500 focus:outline-none transition-colors"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="flex-shrink-0 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
