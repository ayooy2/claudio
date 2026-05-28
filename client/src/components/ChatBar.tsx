import { useState } from 'react';

interface Props { onSend: (msg: string) => void; disabled?: boolean }

export default function ChatBar({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const send = () => { if (text.trim() && !disabled) { onSend(text.trim()); setText(''); } };

  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 0 16px' }}>
      {/* Voice button */}
      <button disabled={disabled} style={{
        width: 40, height: 40, borderRadius: 20,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: 'rgba(255,255,255,0.2)', fontSize: 16,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>🎤</button>

      {/* Input */}
      <input
        type="text" value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') send(); }}
        placeholder="Message Claudio…"
        autoComplete="off" disabled={disabled}
        style={{
          flex: 1, padding: '10px 18px', borderRadius: 22,
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.02)',
          color: 'rgba(255,255,255,0.7)', fontSize: 13, outline: 'none',
          letterSpacing: 0.3,
        }}
      />

      {/* Send */}
      <button onClick={send} disabled={disabled || !text.trim()} style={{
        padding: '10px 20px', borderRadius: 22,
        border: '1px solid rgba(255,255,255,0.06)',
        background: text.trim() ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
        color: text.trim() ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)',
        fontSize: 12, cursor: 'pointer', letterSpacing: 1, flexShrink: 0,
        transition: 'all 0.2s',
      }}>SEND</button>
    </div>
  );
}
