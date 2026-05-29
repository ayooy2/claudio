import { useState, useCallback, useRef, useEffect } from 'react';
import { usePlayer, type SongInfo } from './hooks/usePlayer.js';
import { useSocket, useSocketEvent } from './hooks/useSocket.js';
import { useApi } from './hooks/useApi.js';

// ====================== Colors ======================
const C = {
  bg: '#0d0a14', surface: 'rgba(0,0,0,0.5)', surfaceAlt: 'rgba(0,0,0,0.6)',
  border: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.8)',
  textDim: 'rgba(255,255,255,0.3)', textMuted: 'rgba(255,255,255,0.12)',
  green: '#3f6', greenDim: 'rgba(51,255,102,0.15)', greenDark: 'rgba(51,255,102,0.06)',
  white: '#fff', whiteAlpha: 'rgba(255,255,255,0.06)', radius: 14, radiusSm: 8,
} as const;

// ====================== Mini Player ======================
function MiniPlayer({ song, isPlaying, onToggle, onClick }: {
  song: SongInfo; isPlaying: boolean; onToggle: () => void; onClick: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
      background: 'rgba(13,10,20,0.95)', backdropFilter: 'blur(20px)',
      borderTop: `1px solid ${C.border}`, cursor: 'pointer',
      height: 56, flexShrink: 0,
    }} onClick={onClick}>
      <div style={{
        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
        background: 'linear-gradient(135deg, #334, #223)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
      }}>🎵</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{song.name}</div>
        <div style={{ fontSize: 11, color: C.textDim }}>{song.artist}</div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }} style={{
        background: 'none', border: 'none', color: C.green, fontSize: 22, cursor: 'pointer', padding: 4,
      }}>{isPlaying ? '⏸' : '▶'}</button>
    </div>
  );
}

// ====================== Player Page ======================
function PlayerPage({ current, isPlaying, currentTime, duration, volume, isMuted,
  onToggle, onPrev, onNext, onSeek, onVolumeChange, onMute }: {
  current: SongInfo | null; isPlaying: boolean; currentTime: number; duration: number;
  volume: number; isMuted: boolean;
  onToggle: () => void; onPrev: () => void; onNext: () => void;
  onSeek: (pct: number) => void; onVolumeChange: (v: number) => void; onMute: () => void;
}) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const fmt = (s: number) => (!s || isNaN(s)) ? '0:00' : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const bars = [0.3,0.6,1,0.7,0.2,0.5,0.9,0.4,0.8,0.6,1,0.3,0.7,0.5,0.2,0.9,0.4,0.6,0.3,0.8];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ fontSize: 10, letterSpacing: 3, color: isPlaying ? C.green : C.textDim, marginBottom: 20, textTransform: 'uppercase', fontWeight: 600 }}>
        {isPlaying ? 'Now Playing' : 'Paused'}
      </div>

      <div style={{
        width: 200, height: 200, borderRadius: 20, marginBottom: 20, flexShrink: 0,
        background: 'linear-gradient(135deg, #1a1a2e, #0f0f1a, #533483)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50,
        boxShadow: isPlaying ? '0 0 60px rgba(51,255,102,0.15)' : 'none',
        animation: isPlaying ? 'spin 20s linear infinite' : 'none',
      }}>🎵</div>

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 600, color: C.white }}>{current?.name || 'Claudio 电台'}</div>
        <div style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>{current?.artist || '准备好开始音乐之旅'}</div>
      </div>

      <div style={{ width: '100%', maxWidth: 280, marginBottom: 12 }}>
        <div style={{ height: 3, background: C.whiteAlpha, borderRadius: 2, cursor: 'pointer' }}
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onSeek((e.clientX - r.left) / r.width); }}>
          <div style={{ width: `${pct}%`, height: '100%', background: C.green, borderRadius: 2, transition: 'width 0.3s linear' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
          <span style={{ fontSize: 9, color: C.textMuted }}>{fmt(currentTime)}</span>
          <span style={{ fontSize: 9, color: C.textMuted }}>{fmt(duration)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 14 }}>
        <button onClick={onPrev} style={{ background: 'none', border: 'none', color: C.textDim, fontSize: 20, cursor: 'pointer' }}>⏮</button>
        <button onClick={onToggle} style={{ background: 'none', border: 'none', color: C.green, fontSize: 26, cursor: 'pointer' }}>{isPlaying ? '⏸' : '▶'}</button>
        <button onClick={onNext} style={{ background: 'none', border: 'none', color: C.textDim, fontSize: 20, cursor: 'pointer' }}>⏭</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onMute} style={{ background: 'none', border: 'none', color: isMuted ? C.green : C.textMuted, fontSize: 14, cursor: 'pointer' }}>{isMuted ? '🔇' : '🔊'}</button>
        <input type="range" min={0} max={100} value={isMuted ? 0 : Math.round(volume * 100)}
          onChange={e => onVolumeChange(Number(e.target.value) / 100)}
          style={{ width: 100, accentColor: C.green, height: 2 }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 18, marginTop: 14 }}>
        {bars.map((h, i) => (
          <div key={i} style={{
            width: 3, borderRadius: '1px 1px 0 0',
            height: isPlaying ? `${h * 18}px` : '2px',
            background: isPlaying ? C.green : 'rgba(128,128,128,0.2)',
            transition: 'height 0.5s ease', opacity: isPlaying ? 0.8 : 0.3,
          }} />
        ))}
      </div>
    </div>
  );
}

// ====================== Feed Page ======================
function FeedPage() {
  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: C.white, marginBottom: 4 }}>Feed</h2>
      <p style={{ fontSize: 12, color: C.textDim, marginBottom: 20 }}>What's new</p>
      <div style={{ color: C.textMuted, textAlign: 'center', padding: '40px 0', fontStyle: 'italic', fontSize: 13 }}>
        — no updates —
      </div>
    </div>
  );
}

// ====================== Music Page ======================
function MusicPage({ queue, queueIdx }: { queue: SongInfo[]; queueIdx: number }) {
  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: C.white, marginBottom: 4 }}>Music</h2>
      <p style={{ fontSize: 12, color: C.textDim, marginBottom: 20 }}>Your playlist</p>
      {queue.length === 0 ? (
        <div style={{ color: C.textMuted, textAlign: 'center', padding: '40px 0', fontStyle: 'italic', fontSize: 13 }}>
          — queue empty —
        </div>
      ) : (
        queue.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ width: 20, fontSize: 11, color: i === queueIdx ? C.green : C.textMuted, textAlign: 'right', fontWeight: 600 }}>{String(i + 1).padStart(2, '0')}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: i === queueIdx ? C.green : C.text, fontWeight: i === queueIdx ? 500 : 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
              <div style={{ fontSize: 11, color: i === queueIdx ? 'rgba(51,255,102,0.5)' : C.textMuted }}>{s.artist}</div>
            </div>
            {i === queueIdx && <span style={{ color: C.green, fontSize: 10 }}>▶</span>}
          </div>
        ))
      )}
    </div>
  );
}

// ====================== Genres Page ======================
function GenresPage() {
  const items = ['Dubstep', 'Country', 'Hip Hop/Rap', 'Jazz', 'Ambient', 'Rock', 'Classical', 'Electronic'];
  const icons = ['🎸', '🤠', '🎤', '🎷', '🌀', '🎸', '🎻', '🎹'];
  const colors = ['140,80,200', '180,120,60', '200,80,80', '255,180,50', '100,200,200', '200,60,60', '120,200,120', '180,100,255'];

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: C.white, marginBottom: 4 }}>Genres</h2>
      <p style={{ fontSize: 12, color: C.textDim, marginBottom: 20 }}>Browse by style</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {items.map((g, i) => (
          <div key={i} style={{
            padding: '18px 14px', borderRadius: C.radiusSm,
            background: `linear-gradient(135deg, rgba(${colors[i]},0.12), rgba(0,0,0,0.3))`,
            border: `1px solid ${C.border}`, cursor: 'pointer', textAlign: 'center',
          }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>{icons[i]}</div>
            <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{g}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ====================== Comments Page ======================
function CommentsPage({ messages }: { messages: { role: string; text: string; ts: string }[] }) {
  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: C.white, marginBottom: 4 }}>Comments</h2>
      <p style={{ fontSize: 12, color: C.textDim, marginBottom: 20 }}>Share your thoughts</p>
      {messages.filter(m => m.role === 'dj').length === 0 ? (
        <div style={{ color: C.textMuted, textAlign: 'center', padding: '40px 0', fontStyle: 'italic', fontSize: 13 }}>
          — no comments yet —
        </div>
      ) : (
        messages.filter(m => m.role === 'dj').map((m, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, padding: '10px 0',
            borderBottom: `1px solid ${C.border}`,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #334, #223)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
            }}>🎵</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>Claudio</span>
                <span style={{ fontSize: 9, color: C.textMuted }}>{m.ts}</span>
              </div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>{m.text}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ====================== Settings Page ======================
function SettingsPage() {
  const items = [
    { label: 'Audio Quality', value: 'High (320kbps)' },
    { label: 'Play Mode', value: 'Shuffle' },
    { label: 'Playback Order', value: 'Random' },
    { label: 'Download Quality', value: 'FLAC' },
    { label: 'Sleep Timer', value: 'Off' },
  ];
  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: C.white, marginBottom: 4 }}>Settings</h2>
      <p style={{ fontSize: 12, color: C.textDim, marginBottom: 20 }}>App configuration</p>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: 13, color: C.text }}>{item.label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: C.textDim }}>{item.value}</span>
            <span style={{ fontSize: 14, color: C.textMuted }}>›</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ====================== Horizontal Scroll ======================
const PAGE_NAMES = ['Feed', 'Music', 'Player', 'Genres', 'Comments', 'Settings'];

function HorizontalScroller({ activePage, onSwipe }: { activePage: number; onSwipe: (idx: number) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchStartScrollLeft = useRef(0);

  // Swipe detection
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartScrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff < 0 && activePage < PAGE_NAMES.length - 1) onSwipe(activePage + 1);
      if (diff > 0 && activePage > 0) onSwipe(activePage - 1);
    }
  };

  // Scroll to active page
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: activePage * 440, behavior: 'smooth' });
    }
  }, [activePage]);

  return (
    <div
      ref={scrollRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch', flex: 1,
      }}
    >
      <style>{`::-webkit-scrollbar { display: none; }`}</style>
      {PAGE_NAMES.map((name, i) => (
        <div key={name} style={{
          minWidth: '100%', scrollSnapAlign: 'start',
          display: 'flex', flexDirection: 'column',
        }} />
      ))}
    </div>
  );
}

// ====================== Page Dots ======================
function PageDots({ active, total, onDotClick }: { active: number; total: number; onDotClick: (i: number) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '6px 0 2px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} onClick={() => onDotClick(i)} style={{
          width: active === i ? 16 : 6, height: 6, borderRadius: 3,
          background: active === i ? C.green : C.textMuted,
          transition: 'all 0.3s', cursor: 'pointer',
        }} />
      ))}
    </div>
  );
}

// ====================== APP ======================
export default function App() {
  const [activePage, setActivePage] = useState(2); // Player is page index 2
  const [messages, setMessages] = useState<{ role: 'user'|'dj'; text: string; ts: string }[]>([]);
  const [queue, setQueue] = useState<SongInfo[]>([]);
  const [queueIdx, setQueueIdx] = useState(-1);
  const [chatInput, setChatInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { audioRef, current, isPlaying, currentTime, duration, volume, isMuted,
    play, togglePlay, toggleMute, setVolume, seek, setCurrentTime, setDuration, setIsPlaying } = usePlayer();
  const { socket } = useSocket();
  const { loading, chat } = useApi();

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

  const ts = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const handleSend = useCallback(async (msg: string) => {
    setMessages(prev => [...prev, { role: 'user', text: msg, ts: ts() }]);
    const result = await chat(msg) as any;
    if (!result) return;
    if (result.say?.length) {
      setMessages(prev => [...prev, ...result.say.map((s: string) => ({ role: 'dj' as const, text: s, ts: ts() }))]);
      if ('speechSynthesis' in window) {
        result.say.forEach((s: string) => { const u = new SpeechSynthesisUtterance(s); u.lang = 'zh-CN'; window.speechSynthesis.speak(u); });
      }
    }
    if (result.playlist?.length) {
      setQueue(prev => { const nq = [...prev, ...result.playlist]; if (!prev.length) { setQueueIdx(0); play(result.playlist[0]); } return nq; });
    }
  }, [chat, play]);

  // Scroll to page
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: activePage * 440, behavior: 'smooth' });
    }
  }, [activePage]);

  // Swipe handler
  const handleScrollEnd = useCallback(() => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth);
    if (idx !== activePage) setActivePage(idx);
  }, [activePage]);

  useSocketEvent(socket, 'server_event', (data: any) => {
    if (data.data?.message) setMessages(prev => [...prev, { role: 'dj', text: data.data.message, ts: ts() }]);
  });

  const showMini = !!current && activePage !== 2; // Hide on Player page (index 2)

  return (
    <div style={{
      maxWidth: 440, margin: '0 auto', height: '100vh',
      background: 'linear-gradient(180deg, #0d0a14 0%, #0a0810 50%, #08060e 100%)',
      color: C.white,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 8px', flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, fontFamily: "'Courier New', monospace" }}>Claudio</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={{ fontSize: 9, padding: '4px 10px', borderRadius: C.radiusSm, background: C.whiteAlpha, border: `1px solid ${C.border}`, color: C.textDim, letterSpacing: 2, fontWeight: 700 }}>LOGIN</button>
          <button style={{ fontSize: 9, padding: '4px 10px', borderRadius: C.radiusSm, background: C.white, color: '#000', letterSpacing: 2, fontWeight: 700 }}>DARK</button>
        </div>
      </div>

      {/* Horizontal pages */}
      <div
        ref={scrollRef}
        onScroll={handleScrollEnd}
        style={{
          flex: 1, display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', minHeight: 0,
        }}
      >
        <style>{`::-webkit-scrollbar { display: none; }`}</style>

        {/* Feed */}
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start', overflow: 'auto' }}>
          <FeedPage />
        </div>
        {/* Music */}
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start', overflow: 'auto' }}>
          <MusicPage queue={queue} queueIdx={queueIdx} />
        </div>
        {/* Player */}
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start', overflow: 'hidden' }}>
          <PlayerPage current={current} isPlaying={isPlaying} currentTime={currentTime} duration={duration}
            volume={volume} isMuted={isMuted} onToggle={handleToggle} onPrev={handlePrev} onNext={handleNext}
            onSeek={seek} onVolumeChange={setVolume} onMute={toggleMute} />
        </div>
        {/* Genres */}
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start', overflow: 'auto' }}>
          <GenresPage />
        </div>
        {/* Comments */}
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start', overflow: 'auto' }}>
          <CommentsPage messages={messages} />
        </div>
        {/* Settings */}
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start', overflow: 'auto' }}>
          <SettingsPage />
        </div>
      </div>

      {/* Page dots */}
      <PageDots active={activePage} total={PAGE_NAMES.length} onDotClick={setActivePage} />

      {/* Mini Player (hide on Player page) */}
      {showMini && current && (
        <MiniPlayer song={current} isPlaying={isPlaying} onToggle={handleToggle} onClick={() => setActivePage(2)} />
      )}

      {/* Bottom tabs */}
      <div style={{
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '6px 0 10px', flexShrink: 0,
        background: 'rgba(13,10,20,0.95)', backdropFilter: 'blur(20px)',
        borderTop: `1px solid ${C.border}`,
      }}>
        {PAGE_NAMES.map((name, i) => (
          <button key={name} onClick={() => setActivePage(i)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px',
            display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2,
          }}>
            <span style={{ fontSize: activePage === i ? 18 : 14, opacity: activePage === i ? 1 : 0.4, transition: 'all 0.2s' }}>
              {['📰','🎤','🎵','🎸','💬','⚙️'][i]}
            </span>
            <span style={{
              fontSize: 8, color: activePage === i ? C.green : C.textMuted,
              letterSpacing: 1, fontWeight: 600, textTransform: 'uppercase' as const,
            }}>{name}</span>
          </button>
        ))}
      </div>

      {/* Chat input (only on Comments page) */}
      {activePage === 4 && (
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px 12px', borderTop: `1px solid ${C.border}`, flexShrink: 0, background: 'rgba(13,10,20,0.95)' }}>
          <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && chatInput.trim()) { handleSend(chatInput.trim()); setChatInput(''); } }}
            placeholder="Message Claudio…"
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 22,
              border: `1px solid ${C.border}`, background: C.whiteAlpha,
              color: C.text, fontSize: 13, outline: 'none',
            }} />
          <button onClick={() => { if (chatInput.trim()) { handleSend(chatInput.trim()); setChatInput(''); } }} disabled={loading || !chatInput.trim()} style={{
            padding: '10px 16px', borderRadius: 22,
            border: `1px solid ${chatInput.trim() ? C.green : C.border}`,
            background: chatInput.trim() ? C.greenDim : C.whiteAlpha,
            color: chatInput.trim() ? C.green : C.textMuted,
            fontSize: 12, cursor: 'pointer', letterSpacing: 2, fontWeight: 600,
          }}>SEND</button>
        </div>
      )}

      <audio ref={attachAudio} preload="auto" />
    </div>
  );
}
