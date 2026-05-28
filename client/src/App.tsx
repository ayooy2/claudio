import { useState, useCallback, useRef, useEffect } from 'react';
import Clock from './components/Clock.js';
import Controls from './components/Controls.js';
import { usePlayer, type SongInfo } from './hooks/usePlayer.js';
import { useSocket, useSocketEvent } from './hooks/useSocket.js';
import { useApi } from './hooks/useApi.js';

// ====================== Themes ======================
const themes = {
  DARK: {
    bg: '#0d0a14',
    bgGradient: 'linear-gradient(180deg, #0d0a14 0%, #0a0810 50%, #08060e 100%)',
    surface: 'rgba(0,0,0,0.5)',
    surfaceAlt: 'rgba(0,0,0,0.6)',
    border: 'rgba(255,255,255,0.04)',
    text: 'rgba(255,255,255,0.8)',
    textDim: 'rgba(255,255,255,0.3)',
    textMuted: 'rgba(255,255,255,0.12)',
    green: '#3f6',
    greenDim: 'rgba(51,255,102,0.15)',
    greenDark: 'rgba(51,255,102,0.06)',
    white: '#fff',
    whiteAlpha: 'rgba(255,255,255,0.06)',
    radius: 14,
    radiusSm: 8,
    glow: 'radial-gradient(circle, rgba(51,255,102,0.04) 0%, transparent 70%)',
  },
  LIGHT: {
    bg: '#f5f3f0',
    bgGradient: 'linear-gradient(180deg, #f5f3f0 0%, #edeae5 50%, #e8e5e0 100%)',
    surface: 'rgba(255,255,255,0.7)',
    surfaceAlt: 'rgba(255,255,255,0.85)',
    border: 'rgba(0,0,0,0.06)',
    text: 'rgba(0,0,0,0.75)',
    textDim: 'rgba(0,0,0,0.35)',
    textMuted: 'rgba(0,0,0,0.12)',
    green: '#1a8',
    greenDim: 'rgba(17,170,136,0.12)',
    greenDark: 'rgba(17,170,136,0.05)',
    white: '#111',
    whiteAlpha: 'rgba(0,0,0,0.04)',
    radius: 14,
    radiusSm: 8,
    glow: 'radial-gradient(circle, rgba(17,170,136,0.06) 0%, transparent 70%)',
  },
};

// ====================== Dot Background ======================
function DotField({ theme }: { theme: typeof themes.DARK }) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none', opacity: theme === themes.DARK ? 0.04 : 0.08 }}>
      {Array.from({ length: 400 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: `${(i * 137 + 50) % 100}%`, top: `${(i * 89 + 30) % 100}%`,
          width: 2, height: 2, borderRadius: 1, background: '#000',
        }} />
      ))}
    </div>
  );
}

// ====================== Waveform ======================
function Waveform({ active, green }: { active: boolean; green: string }) {
  const bars = [0.3, 0.6, 1, 0.7, 0.2, 0.5, 0.9, 0.4, 0.8, 0.6, 1, 0.3, 0.7, 0.5, 0.2, 0.9, 0.4, 0.6, 0.3, 0.8];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28, justifyContent: 'center' }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 3, borderRadius: '1px 1px 0 0',
          height: active ? `${h * 28}px` : '3px',
          background: active ? green : 'rgba(128,128,128,0.2)',
          transition: 'height 0.5s ease', opacity: active ? 0.8 : 0.3,
        }} />
      ))}
    </div>
  );
}

// ====================== Progress Bar (clickable) ======================
function ProgressBar({ currentTime, duration, onSeek, green }: {
  currentTime: number; duration: number; onSeek: (pct: number) => void; green: string;
}) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const fmt = (s: number) => {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };
  return (
    <div style={{ padding: '6px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'rgba(128,128,128,0.5)' }}>{fmt(currentTime)}</span>
        <span style={{ fontSize: 10, color: 'rgba(128,128,128,0.5)' }}>{fmt(duration)}</span>
      </div>
      <div
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onSeek((e.clientX - r.left) / r.width);
        }}
        style={{ height: 4, background: 'rgba(128,128,128,0.1)', borderRadius: 2, cursor: 'pointer' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: green, borderRadius: 2, transition: 'width 0.3s linear' }} />
      </div>
    </div>
  );
}

// ====================== Chat Message ======================
function MsgBubble({ msg, theme }: { msg: { role: 'user' | 'dj'; text: string; ts: string }; theme: typeof themes.DARK }) {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isDj = msg.role === 'dj';

  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 1.0; u.pitch = 1.0;
    // Pick best Chinese voice
    const voices = synth.getVoices();
    const zh = voices.find(v => v.lang.startsWith('zh-CN')) || voices.find(v => v.lang.startsWith('zh'));
    if (zh) u.voice = zh;
    synth.speak(u);
    synthRef.current = synth;
  };

  // Auto-speak DJ messages on mount
  useEffect(() => {
    if (isDj) speak(msg.text);
  }, []);

  const replay = () => {
    if (!isDj) return;
    speak(msg.text);
  };

  if (isDj) {
    return (
      <div style={{ display: 'flex', gap: 10, padding: '8px 0', alignItems: 'flex-start' }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
          background: theme === themes.DARK ? 'linear-gradient(135deg, #1a1a2e, #0f0f1a)' : 'linear-gradient(135deg, #ddd, #ccc)',
          border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>🎵</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: theme.surfaceAlt, borderRadius: theme.radiusSm, padding: '8px 12px', border: `1px solid ${theme.border}` }}>
            <div style={{ color: theme.text, fontSize: 12, lineHeight: 1.7, fontWeight: 300 }}>{msg.text}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, paddingLeft: 4 }}>
            <span style={{ color: 'rgba(128,128,128,0.4)', fontSize: 9 }}>{msg.ts}</span>
            <button onClick={replay} style={{ background: 'none', border: 'none', color: theme.textDim, fontSize: 9, cursor: 'pointer', padding: 0, letterSpacing: 1 }}>REPLAY</button>
          </div>
        </div>
      </div>
    );
  }

  // User message — right aligned
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 0' }}>
      <div style={{ maxWidth: '80%' }}>
        <div style={{
          background: theme.greenDark, borderRadius: theme.radiusSm,
          padding: '8px 12px', border: `1px solid rgba(51,255,102,0.1)`,
        }}>
          <div style={{ color: theme.text, fontSize: 12, lineHeight: 1.6, fontWeight: 300 }}>{msg.text}</div>
        </div>
        <div style={{ textAlign: 'right', marginTop: 2, paddingRight: 4 }}>
          <span style={{ color: 'rgba(128,128,128,0.4)', fontSize: 9 }}>{msg.ts}</span>
        </div>
      </div>
    </div>
  );
}

// ====================== Pixel Text ======================
const pixelStyle: React.CSSProperties = {
  fontFamily: "'Courier New', monospace", fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' as const,
};

// ====================== APP ======================
export default function App() {
  interface ChatMsg { role: 'user' | 'dj'; text: string; ts: string }
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [queue, setQueue] = useState<SongInfo[]>([]);
  const [queueIdx, setQueueIdx] = useState(-1);
  const [themeName, setThemeName] = useState<'DARK' | 'LIGHT'>('DARK');
  const [voiceListening, setVoiceListening] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const theme = themes[themeName];

  const { audioRef, current, isPlaying, currentTime, duration, volume, isMuted,
    play, togglePlay, toggleMute, setVolume, seek, setCurrentTime, setDuration, setIsPlaying } = usePlayer();
  const { socket, connected } = useSocket();
  const { loading, chat } = useApi();
  const inputRef = useRef<HTMLInputElement>(null);

  // Preload speech voices
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    synth.getVoices(); // trigger load
    synth.onvoiceschanged = () => { synth.getVoices(); };
  }, []);

  // ===== Audio setup =====
  const attachAudio = useCallback((el: HTMLAudioElement | null) => {
    audioRef.current = el;
    if (!el) return;
    el.ontimeupdate = () => setCurrentTime(el.currentTime);
    el.ondurationchange = () => setDuration(el.duration || 0);
    el.onended = () => handleNext();
    el.onerror = () => {};
    el.volume = volume;
  }, [volume]);

  // ===== Keyboard shortcuts =====
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.code) {
        case 'Space': e.preventDefault(); handleToggle(); break;
        case 'ArrowLeft': handlePrev(); break;
        case 'ArrowRight': handleNext(); break;
        case 'KeyM': toggleMute(); break;
        case 'KeyS': handleStop(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isPlaying, queue, queueIdx, current]);

  // ===== Playback =====
  const handleToggle = useCallback(() => { if (!current) return; togglePlay(); }, [current, togglePlay]);
  const handleNext = useCallback(() => {
    if (queue.length <= 1) return;
    const n = (queueIdx + 1) % queue.length;
    setQueueIdx(n); setCurrentTime(0); setIsPlaying(true); play(queue[n]);
  }, [queue, queueIdx, play, setCurrentTime, setIsPlaying]);
  const handlePrev = useCallback(() => {
    if (queue.length <= 1) return;
    const p = queueIdx <= 0 ? queue.length - 1 : queueIdx - 1;
    setQueueIdx(p); setCurrentTime(0); setIsPlaying(true); play(queue[p]);
  }, [queue, queueIdx, play, setCurrentTime, setIsPlaying]);
  const handleStop = useCallback(() => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setQueue([]); setQueueIdx(-1); setIsPlaying(false);
  }, [setIsPlaying]);

  // ===== Chat =====
  const ts = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  const playTTS = useCallback((urls: string[]) => {
    if (!urls.length) return;
    ttsAudioRef.current?.pause();
    const a = new Audio(); a.volume = 0.7; ttsAudioRef.current = a;
    let i = 0;
    const next = () => { if (i >= urls.length) return; a.src = urls[i]; a.play().catch(() => { i++; next(); }); i++; };
    a.onended = next; a.onerror = () => { i++; next(); }; next();
  }, []);

  const sendMsg = useCallback(async (msg: string) => {
    if (!msg.trim()) return;
    // Record user message
    setMessages(prev => [...prev, { role: 'user', text: msg.trim(), ts: ts() }]);
    const result = await chat(msg.trim()) as any;
    if (!result) return;
    if (result.say?.length) {
      setMessages(prev => [...prev, ...result.say.map((s: string) => ({ role: 'dj' as const, text: s, ts: ts() }))]);
      if (result.audioUrls?.length) playTTS(result.audioUrls);
    }
    if (result.playlist?.length) {
      setQueue(prev => {
        const nq = [...prev, ...result.playlist];
        if (prev.length === 0) { setQueueIdx(0); play(result.playlist[0]); }
        return nq;
      });
    }
  }, [chat, play]);

  // Auto-scroll to bottom on new messages
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = useCallback(() => {
    sendMsg(chatInput);
    setChatInput('');
  }, [chatInput, sendMsg]);

  // ===== Voice input =====
  const toggleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('浏览器不支持语音识别'); return; }

    if (voiceListening) {
      setVoiceListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setChatInput(prev => prev + transcript);
      setVoiceListening(false);
      inputRef.current?.focus();
    };
    recognition.onerror = () => setVoiceListening(false);
    recognition.onend = () => setVoiceListening(false);

    recognition.start();
    setVoiceListening(true);
  }, [voiceListening]);

  // ===== Socket events =====
  useSocketEvent(socket, 'server_event', (data: any) => {
    if (data.data?.message) setMessages(prev => [...prev, { role: 'dj', text: data.data.message, ts: ts() }]);
  });

  // ===== Display queue (real tracks only) =====
  const realQueue = queue.filter(Boolean);
  const displaySlots = realQueue.length > 0 ? realQueue.slice(0, 5) : [];

  return (
    <div style={{
      maxWidth: 440, margin: '0 auto', minHeight: '100vh',
      background: theme.bgGradient, color: theme.white,
      padding: '0 20px 16px',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
      position: 'relative',
    }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: 300, height: 300, background: theme.glow, pointerEvents: 'none' }} />

      {/* ===== NAV BAR ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 0 8px' }}>
        <span style={{ ...pixelStyle, fontSize: 16, color: theme.text, opacity: 0.9 }}>Claudio</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setLoginOpen(!loginOpen)} style={{
            ...pixelStyle, fontSize: 9, padding: '4px 10px', borderRadius: theme.radiusSm,
            background: loginOpen ? theme.white : theme.whiteAlpha,
            border: loginOpen ? 'none' : `1px solid ${theme.border}`,
            color: loginOpen ? (themeName === 'DARK' ? '#000' : '#000') : theme.textDim, cursor: 'pointer',
          }}>LOGIN</button>
          <button onClick={() => setThemeName('DARK')} style={{
            ...pixelStyle, fontSize: 9, padding: '4px 10px', borderRadius: theme.radiusSm,
            background: themeName === 'DARK' ? theme.white : theme.whiteAlpha,
            border: themeName === 'DARK' ? 'none' : `1px solid ${theme.border}`,
            color: themeName === 'DARK' ? '#000' : theme.textDim, cursor: 'pointer',
          }}>DARK</button>
          <button onClick={() => setThemeName('LIGHT')} style={{
            ...pixelStyle, fontSize: 9, padding: '4px 10px', borderRadius: theme.radiusSm,
            background: themeName === 'LIGHT' ? theme.white : theme.whiteAlpha,
            border: themeName === 'LIGHT' ? 'none' : `1px solid ${theme.border}`,
            color: themeName === 'LIGHT' ? '#000' : theme.textDim, cursor: 'pointer',
          }}>LIGHT</button>
        </div>
      </div>

      {/* ===== CLOCK ===== */}
      <div style={{
        position: 'relative', borderRadius: theme.radius,
        background: theme.surface, border: `1px solid ${theme.border}`,
        padding: '32px 20px 20px', marginBottom: 12, overflow: 'hidden',
      }}>
        <DotField theme={theme} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <Clock themeName={themeName} />
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isPlaying ? theme.green : 'rgba(128,128,128,0.3)', display: 'inline-block' }} />
              <span style={{ color: isPlaying ? theme.text : theme.textDim, fontSize: 10, letterSpacing: 4, fontWeight: 600 }}>
                {isPlaying ? 'ON AIR' : 'STANDBY'}
              </span>
            </span>
          </div>
          {/* Login notification */}
          {loginOpen && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 10, color: theme.textDim, background: theme.whiteAlpha, padding: '4px 10px', borderRadius: theme.radiusSm }}>
                Login via Netease API (port 3000)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ===== CONTROLS ===== */}
      <Controls
        isPlaying={isPlaying} isMuted={isMuted} hasTrack={!!current} volume={volume}
        onToggle={handleToggle} onPrev={handlePrev} onNext={handleNext}
        onStop={handleStop} onMute={toggleMute} onVolumeChange={setVolume}
        green={theme.green}
      />

      {/* ===== WAVEFORM + PROGRESS ===== */}
      <div style={{ padding: '4px 0' }}>
        <Waveform active={isPlaying} green={theme.green} />
        <ProgressBar currentTime={currentTime} duration={duration} onSeek={seek} green={theme.green} />
      </div>

      {/* ===== QUEUE ===== */}
      <div style={{
        borderRadius: theme.radius, background: theme.surfaceAlt,
        border: `1px solid ${theme.border}`, padding: '14px 16px', marginBottom: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ ...pixelStyle, fontSize: 10, color: theme.textDim }}>PLAYING</span>
          <span style={{ ...pixelStyle, fontSize: 10, color: theme.textDim }}>{displaySlots.length} TRACKS</span>
        </div>
        {displaySlots.length === 0 ? (
          <div style={{ color: theme.textMuted, fontSize: 12, padding: '8px 0', textAlign: 'center' }}>
            — queue empty —
          </div>
        ) : (
          displaySlots.map((s, i) => (
            <div key={s.id || i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
              borderRadius: theme.radiusSm, paddingLeft: 10, paddingRight: 10,
              background: i === queueIdx ? theme.greenDark : 'transparent',
            }}>
              <span style={{ width: 18, fontSize: 10, color: i === queueIdx ? theme.green : theme.textMuted, textAlign: 'right' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ flex: 1, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: i === queueIdx ? theme.green : theme.textDim, fontWeight: i === queueIdx ? 500 : 300 }}>
                {s.name}
              </span>
              <span style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100, color: i === queueIdx ? 'rgba(51,255,102,0.5)' : theme.textMuted }}>
                {s.artist}
              </span>
              {i === queueIdx && <span style={{ color: theme.green, fontSize: 10 }}>▶</span>}
            </div>
          ))
        )}
      </div>

      {/* ===== DJ CHAT ===== */}
      <div style={{
        borderRadius: theme.radius, background: theme.surfaceAlt,
        border: `1px solid ${theme.border}`, padding: '14px 16px', marginBottom: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isPlaying ? theme.green : 'rgba(128,128,128,0.3)', display: 'inline-block' }} />
            <span style={{ ...pixelStyle, fontSize: 10, color: theme.text }}>Claudio</span>
          </span>
          <span style={{ ...pixelStyle, fontSize: 9, color: isPlaying ? theme.green : theme.textDim }}>
            {isPlaying ? '● LIVE' : 'IDLE'}
          </span>
        </div>
        <div style={{ maxHeight: 240, overflow: 'auto' }}>
          {messages.length === 0 && (
            <div style={{ color: theme.textMuted, fontSize: 12, padding: '12px 0', textAlign: 'center', fontStyle: 'italic' }}>
              — waiting for your message —
            </div>
          )}
          {messages.map((m, i) => <MsgBubble key={i} msg={m} theme={theme} />)}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ===== INPUT ===== */}
      <div style={{ display: 'flex', gap: 8, padding: '6px 0 10px' }}>
        <button onClick={toggleVoice} disabled={loading} style={{
          width: 42, height: 42, borderRadius: 21,
          background: voiceListening ? theme.greenDim : theme.whiteAlpha,
          border: `1px solid ${voiceListening ? theme.green : theme.border}`,
          color: voiceListening ? theme.green : theme.textDim, fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          transition: 'all 0.2s',
        }} title="语音输入">{voiceListening ? '●' : '🎤'}</button>

        <input
          ref={inputRef}
          type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
          placeholder="Message Claudio…"
          autoComplete="off" disabled={loading}
          style={{
            flex: 1, padding: '10px 16px', borderRadius: 22,
            border: `1px solid ${theme.border}`, background: theme.whiteAlpha,
            color: theme.text, fontSize: 13, outline: 'none', letterSpacing: 0.3,
          }}
        />

        <button onClick={handleSend} disabled={loading || !chatInput.trim()} style={{
          padding: '10px 18px', borderRadius: 22,
          border: `1px solid ${chatInput.trim() ? theme.green : theme.border}`,
          background: chatInput.trim() ? theme.greenDim : theme.whiteAlpha,
          color: chatInput.trim() ? theme.green : theme.textMuted,
          fontSize: 11, cursor: 'pointer', letterSpacing: 2, fontWeight: 600, flexShrink: 0,
          transition: 'all 0.2s',
        }}>SEND</button>
      </div>

      {/* ===== FOOTER ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 4px 12px' }}>
        <span style={{ ...pixelStyle, fontSize: 8, color: theme.textMuted }}>CLAUDIO FM</span>
        <span style={{ ...pixelStyle, fontSize: 8, color: theme.textMuted }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: connected ? theme.green : 'rgba(255,80,80,0.6)',
            display: 'inline-block', marginRight: 4,
          }} />
          {connected ? 'CONNECTED' : 'OFFLINE'}
        </span>
      </div>

      <audio ref={attachAudio} preload="auto" />
    </div>
  );
}
