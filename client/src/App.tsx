import { useState, useCallback, useRef, useEffect } from 'react';
import { usePlayer, type SongInfo } from './hooks/usePlayer.js';
import { useSocket, useSocketEvent } from './hooks/useSocket.js';
import { useApi } from './hooks/useApi.js';

// ====================== Sound Wave Visualization ======================
function SoundWave({ active }: { active: boolean }) {
  const bars = [0.3, 0.6, 1, 0.7, 0.2, 0.5, 0.9, 0.4, 0.8, 0.6, 1, 0.3, 0.7, 0.5, 0.2, 0.9, 0.4, 0.6, 0.3, 0.8, 1, 0.5, 0.7, 0.3, 0.6, 0.9, 0.4, 0.8, 0.5, 0.7];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80, justifyContent: 'center' }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 1,
          height: active ? `${h * 80}px` : '3px',
          background: `rgba(255,255,255,${active ? 0.35 : 0.08})`,
          transition: 'height 0.4s ease',
        }} />
      ))}
    </div>
  );
}

// ====================== APP ======================
export default function App() {
  const [messages, setMessages] = useState<{ role: 'user'|'dj'; text: string; ts: string }[]>([]);
  const [queue, setQueue] = useState<SongInfo[]>([]);
  const [queueIdx, setQueueIdx] = useState(-1);
  const [chatInput, setChatInput] = useState('');
  const [showChat, setShowChat] = useState(false);

  const { audioRef, current, isPlaying, currentTime, duration, volume, isMuted,
    play, togglePlay, toggleMute, setVolume, seek, setCurrentTime, setDuration, setIsPlaying } = usePlayer();
  const { socket } = useSocket();
  const { loading, chat } = useApi();

  // Audio
  const attachAudio = useCallback((el: HTMLAudioElement | null) => {
    audioRef.current = el;
    if (!el) return;
    el.ontimeupdate = () => setCurrentTime(el.currentTime);
    el.ondurationchange = () => setDuration(el.duration || 0);
    el.onended = () => {
      if (queue.length > 1) {
        const n = (queueIdx + 1) % queue.length;
        setQueueIdx(n); setCurrentTime(0); setIsPlaying(true); play(queue[n]);
      }
    };
    el.volume = volume;
  }, [volume, queue, queueIdx, play, setCurrentTime, setDuration, setIsPlaying]);

  const handleToggle = useCallback(() => { if (!current) return; togglePlay(); }, [current, togglePlay]);

  // Chat
  const ts = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const handleSend = useCallback(async (msg: string) => {
    if (!msg.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: msg, ts: ts() }]);
    setChatInput('');
    const result = await chat(msg) as any;
    if (!result) return;
    if (result.say?.length) {
      setMessages(prev => [...prev, ...result.say.map((s: string) => ({ role: 'dj' as const, text: s, ts: ts() }))]);
      if ('speechSynthesis' in window) {
        result.say.forEach((s: string) => {
          const u = new SpeechSynthesisUtterance(s); u.lang = 'zh-CN'; window.speechSynthesis.speak(u);
        });
      }
    }
    if (result.playlist?.length) {
      setQueue(prev => { const nq = [...prev, ...result.playlist]; if (!prev.length) { setQueueIdx(0); play(result.playlist[0]); } return nq; });
    }
  }, [chat, play]);

  // Socket
  useSocketEvent(socket, 'server_event', (data: any) => {
    if (data.data?.message) setMessages(prev => [...prev, { role: 'dj', text: data.data.message, ts: ts() }]);
  });

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') { e.preventDefault(); handleToggle(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleToggle]);

  const fmt = (s: number) => (!s || isNaN(s)) ? '0:00' : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Lyrics
  const getLyrics = () => {
    if (!current) return ['Let me take you to a better place', "I'm gettin' angry but I still love you", 'and I know that this is you'];
    if (current.artist?.includes('周杰伦')) return ['还记得你说家是唯一的城堡', '随着稻香河流继续奔跑', '微微笑 小时候的梦我知道', '不要哭让萤火虫带着你逃跑'];
    if (current.artist?.includes('林俊杰')) return ['修炼爱情的心酸', '学会放好以前的渴望', '我们那些信仰', '要忘记多难'];
    return ['Let me take you to a better place', "I'm gettin' angry but I still love you", 'and I know that this is you'];
  };

  return (
    <div style={{
      maxWidth: 440, margin: '0 auto', height: '100vh',
      background: 'linear-gradient(135deg, #2d3a4a 0%, #1a2a3a 30%, #0f1a2a 60%, #1a2030 100%)',
      color: '#fff', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', sans-serif",
      display: 'flex', flexDirection: 'column', position: 'relative',
    }}>

      {/* Lyrics label top right */}
      <div onClick={() => setShowChat(!showChat)} style={{
        position: 'absolute', top: 16, right: 20, cursor: 'pointer',
        fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: 2,
      }}>lyrics</div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 24px' }}>

        {/* Sound wave visualization */}
        <SoundWave active={isPlaying} />

        {/* Song title */}
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 300, letterSpacing: 3, color: 'rgba(255,255,255,0.85)' }}>
            {current?.name || 'Afterglow'}
          </div>
        </div>

        {/* Artist */}
        <div style={{ marginTop: 6, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>
            {current?.artist || 'Taylor Swift'}
          </div>
        </div>

        {/* Progress */}
        {current && (
          <div style={{ width: '100%', maxWidth: 260, marginTop: 20 }}>
            <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, cursor: 'pointer' }}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'rgba(255,255,255,0.3)', borderRadius: 1, transition: 'width 0.3s linear' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)' }}>{fmt(currentTime)}</span>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)' }}>{fmt(duration)}</span>
            </div>
          </div>
        )}

        {/* Play button — oval, muted */}
        <button onClick={handleToggle} style={{
          width: 50, height: 30, borderRadius: 15, border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)',
          fontSize: 14, marginTop: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{isPlaying ? '⏸' : '▶'}</button>

        {/* Lyrics */}
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          {getLyrics().map((line, i) => (
            <p key={i} style={{
              fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 2, fontWeight: 300, margin: 0,
            }}>{line}</p>
          ))}
        </div>
      </div>

      {/* Chat drawer */}
      {showChat && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: '50%', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#3f6' }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 2 }}>Claudio</span>
            </div>
            <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 14, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
            {messages.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.08)', textAlign: 'center', padding: '40px 0', fontStyle: 'italic', fontSize: 13 }}>— send a message —</div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ padding: '6px 0' }}>
                {m.role === 'dj' ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #334, #223)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>🎵</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Claudio · {m.ts}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, fontWeight: 300 }}>{m.text}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{m.text}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, padding: '10px 20px 16px' }}>
            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && chatInput.trim()) handleSend(chatInput.trim()); }}
              placeholder="Message Claudio…"
              style={{ flex: 1, padding: '10px 14px', borderRadius: 22, border: '1px solid rgba(255,255,255,0.04)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.6)', fontSize: 13, outline: 'none' }} />
            <button onClick={() => handleSend(chatInput)} disabled={loading || !chatInput.trim()} style={{
              padding: '10px 14px', borderRadius: 22, border: 'none',
              background: chatInput.trim() ? 'rgba(51,255,102,0.06)' : 'rgba(255,255,255,0.02)',
              color: chatInput.trim() ? 'rgba(51,255,102,0.4)' : 'rgba(255,255,255,0.1)',
              fontSize: 11, cursor: 'pointer', letterSpacing: 1,
            }}>SEND</button>
          </div>
        </div>
      )}

      <audio ref={attachAudio} preload="auto" />
    </div>
  );
}
