import { useState, useCallback, useRef, useEffect } from 'react';
import { usePlayer, type SongInfo } from './hooks/usePlayer.js';
import { useSocket, useSocketEvent } from './hooks/useSocket.js';
import { useApi } from './hooks/useApi.js';

const C = {
  bg: '#0d0a14', surface: 'rgba(0,0,0,0.5)', surfaceAlt: 'rgba(0,0,0,0.6)',
  border: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.8)',
  textDim: 'rgba(255,255,255,0.3)', textMuted: 'rgba(255,255,255,0.12)',
  green: '#3f6', greenDim: 'rgba(51,255,102,0.15)', greenDark: 'rgba(51,255,102,0.06)',
  white: '#fff', whiteAlpha: 'rgba(255,255,255,0.06)',
  radius: 14, radiusSm: 8,
  gradient: 'linear-gradient(180deg, #0d0a14 0%, #0a0810 50%, #08060e 100%)',
} as const;

const PAGE_NAMES = ['Feed', 'Music', 'Player', 'Genres', 'Comments', 'Settings'] as const;
const PAGE_ICONS = ['📰', '🎤', '🎵', '🎸', '💬', '⚙️'] as const;

// ====================== i18n ======================
type Lang = 'zh' | 'en';
const T: Record<Lang, Record<string, string>> = {
  zh: {
    feed: '动态', music: '音乐', player: '播放器', genres: '风格', comments: '评论', settings: '设置',
    nowPlaying: '正在播放', paused: '已暂停', queueEmpty: '队列为空', noUpdates: '暂无更新',
    noComments: '暂无评论', sendMsg: '发消息...', audioQuality: '音质', playMode: '播放模式',
    playbackOrder: '播放顺序', downloadQuality: '下载质量', sleepTimer: '睡眠定时',
    language: '语言', connected: '已连接', live: '直播中', browseByStyle: '选择音乐风格',
    appConfig: '应用配置', shuffle: '随机', random: '随机', high320: '高质量 (320kbps)',
    flac: 'FLAC', off: '关闭', autoplay: '自动播放', preloadNext: '预加载下一首',
    djStyle: 'DJ 风格', warm: '温暖', cool: '冷静', energetic: '活力',
    messageClaudio: '跟 Claudio 说点什么...',
  },
  en: {
    feed: 'Feed', music: 'Music', player: 'Player', genres: 'Genres', comments: 'Comments', settings: 'Settings',
    nowPlaying: 'Now Playing', paused: 'Paused', queueEmpty: 'Queue empty', noUpdates: 'No updates yet',
    noComments: 'No comments yet', sendMsg: 'Send a message...', audioQuality: 'Audio Quality', playMode: 'Play Mode',
    playbackOrder: 'Playback Order', downloadQuality: 'Download Quality', sleepTimer: 'Sleep Timer',
    language: 'Language', connected: 'Connected', live: 'LIVE', browseByStyle: 'Browse by style',
    appConfig: 'App configuration', shuffle: 'Shuffle', random: 'Random', high320: 'High (320kbps)',
    flac: 'FLAC', off: 'Off', autoplay: 'Auto Play', preloadNext: 'Preload Next',
    djStyle: 'DJ Style', warm: 'Warm', cool: 'Cool', energetic: 'Energetic',
    messageClaudio: 'Message Claudio...',
  },
};

// ====================== APP ======================
export default function App() {
  const [activePage, setActivePage] = useState(2); // Player is default
  const [messages, setMessages] = useState<{ role: 'user'|'dj'; text: string; ts: string }[]>([]);
  const [queue, setQueue] = useState<SongInfo[]>([]);
  const [queueIdx, setQueueIdx] = useState(-1);
  const [chatInput, setChatInput] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [lang, setLang] = useState<Lang>('zh');
  const [autoPlay, setAutoPlay] = useState(true);
  const [preloadNext, setPreloadNext] = useState(true);

  const t = (key: string) => T[lang][key] || key;

  const scrollRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const voiceListeningRef = useRef(false);

  const { audioRef, current, isPlaying, currentTime, duration, volume, isMuted,
    play, togglePlay, toggleMute, setVolume, seek, setCurrentTime, setDuration, setIsPlaying } = usePlayer();
  const { socket } = useSocket();
  const { loading, chat } = useApi();

  // ===== Audio =====
  const attachAudio = useCallback((el: HTMLAudioElement | null) => {
    audioRef.current = el;
    if (!el) return;
    el.ontimeupdate = () => setCurrentTime(el.currentTime);
    el.ondurationchange = () => setDuration(el.duration || 0);
    el.onended = () => {
      if (queue.length > 1) {
        const n = (queueIdx + 1) % queue.length;
        setQueueIdx(n); setCurrentTime(0); setIsPlaying(true);
        play(queue[n]);
      }
    };
    el.volume = volume;
  }, [volume, queue, queueIdx, play, setCurrentTime, setDuration, setIsPlaying]);

  const handleToggle = useCallback(() => {
    if (!current) return;
    togglePlay();
  }, [current, togglePlay]);

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
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    setQueue([]); setQueueIdx(-1); setIsPlaying(false);
  }, [setIsPlaying]);

  const handleSeek = useCallback((pct: number) => {
    if (audioRef.current) audioRef.current.currentTime = (audioRef.current.duration || 0) * pct;
  }, []);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }, [setVolume]);

  // ===== Chat =====
  const ts = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  const handleSend = useCallback(async (msg: string) => {
    if (!msg.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text: msg, ts: ts() }]);
    setChatInput('');

    const result = await chat(msg) as any;
    if (!result) return;
    if (result.say?.length) {
      setMessages(prev => [...prev, ...result.say.map((s: string) => ({ role: 'dj' as const, text: s, ts: ts() }))]);
      // Auto-speak DJ messages
      if ('speechSynthesis' in window) {
        result.say.forEach((s: string) => {
          const u = new SpeechSynthesisUtterance(s);
          u.lang = 'zh-CN'; u.rate = 1.0;
          const voices = window.speechSynthesis.getVoices();
          const zh = voices.find(v => v.lang.startsWith('zh'));
          if (zh) u.voice = zh;
          window.speechSynthesis.speak(u);
        });
      }
    }
    if (result.playlist?.length) {
      setQueue(prev => {
        const nq = [...prev, ...result.playlist];
        if (!prev.length) { setQueueIdx(0); play(result.playlist[0]); }
        return nq;
      });
    }
  }, [chat, play]);

  // ===== Voice input =====
  const handleVoice = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert('浏览器不支持语音'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN'; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event: any) => {
      setChatInput(prev => prev + event.results[0][0].transcript);
    };
    recognition.start();
  }, []);

  // ===== Genre select =====
  const handleGenreSelect = useCallback((genre: string) => {
    setSelectedGenre(genre);
    handleSend(`想听${genre}类型的歌`);
  }, [handleSend]);

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
  }, [handleToggle, handlePrev, handleNext, toggleMute, handleStop]);

  // ===== Scroll sync =====
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ left: activePage * scrollRef.current.clientWidth, behavior: 'smooth' });
    }
  }, [activePage]);

  // ===== Auto-scroll chat =====
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ===== Socket =====
  useSocketEvent(socket, 'server_event', (data: any) => {
    if (data.data?.message) setMessages(prev => [...prev, { role: 'dj', text: data.data.message, ts: ts() }]);
  });

  // ===== Helpers =====
  const showMini = !!current && activePage !== 2;
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const fmt = (s: number) => (!s || isNaN(s)) ? '0:00' : `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const bars = [0.3,0.6,1,0.7,0.2,0.5,0.9,0.4,0.8,0.6,1,0.3,0.7,0.5,0.2,0.9,0.4,0.6,0.3,0.8];

  const genres = ['Dubstep', 'Country', 'Hip Hop/Rap', 'Jazz', 'Ambient', 'Rock', 'Classical', 'Electronic'];
  const genreIcons = ['🎸', '🤠', '🎤', '🎷', '🌀', '🎸', '🎻', '🎹'];
  const genreColors = ['140,80,200', '180,120,60', '200,80,80', '255,180,50', '100,200,200', '200,60,60', '120,200,120', '180,100,255'];

  return (
    <div style={{
      maxWidth: 440, margin: '0 auto', height: '100vh',
      background: C.gradient, color: C.white,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* ===== Header ===== */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px 8px', flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, fontFamily: "'Courier New', monospace" }}>Claudio</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setLoginOpen(!loginOpen)} style={{
            fontSize: 9, padding: '4px 10px', borderRadius: C.radiusSm,
            background: loginOpen ? C.white : C.whiteAlpha,
            border: 'none', color: loginOpen ? '#000' : C.textDim,
            letterSpacing: 2, fontWeight: 700, cursor: 'pointer',
          }}>LOGIN</button>
          <button style={{
            fontSize: 9, padding: '4px 10px', borderRadius: C.radiusSm,
            background: C.white, color: '#000',
            letterSpacing: 2, fontWeight: 700, cursor: 'pointer', border: 'none',
          }}>DARK</button>
        </div>
      </div>

      {/* ===== Horizontal scroll pages ===== */}
      <div
        ref={scrollRef}
        style={{
          flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory', scrollbarWidth: 'none', minHeight: 0,
        }}
      >
        <style>{`::-webkit-scrollbar { display: none; }`}</style>

        {/* --- PAGE 0: Feed --- */}
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start', overflow: 'auto', padding: '20px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.white, marginBottom: 4 }}>{t('feed')}</h2>
          <p style={{ fontSize: 12, color: C.textDim, marginBottom: 20 }}>What's new</p>
          <div style={{ color: C.textMuted, textAlign: 'center', padding: '40px 0', fontStyle: 'italic', fontSize: 13 }}>— {t('noUpdates')} —</div>
        </div>

        {/* --- PAGE 1: Music (queue) --- */}
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start', overflow: 'auto', padding: '20px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.white, marginBottom: 4 }}>{t('music')}</h2>
          <p style={{ fontSize: 12, color: C.textDim, marginBottom: 20 }}>Your playlist</p>
          {queue.length === 0 ? (
            <div style={{ color: C.textMuted, textAlign: 'center', padding: '40px 0', fontStyle: 'italic', fontSize: 13 }}>— {t('queueEmpty')} —</div>
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

        {/* --- PAGE 2: Player (full screen) --- */}
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px 24px' }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: isPlaying ? C.green : C.textDim, marginBottom: 20, textTransform: 'uppercase', fontWeight: 600 }}>
            {isPlaying ? t('nowPlaying') : t('paused')}
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

          {/* Progress */}
          <div style={{ width: '100%', maxWidth: 280, marginBottom: 12 }}>
            <div style={{ height: 3, background: C.whiteAlpha, borderRadius: 2, cursor: 'pointer' }}
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); handleSeek((e.clientX - r.left) / r.width); }}>
              <div style={{ width: `${pct}%`, height: '100%', background: C.green, borderRadius: 2, transition: 'width 0.3s linear' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
              <span style={{ fontSize: 9, color: C.textMuted }}>{fmt(currentTime)}</span>
              <span style={{ fontSize: 9, color: C.textMuted }}>{fmt(duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 14 }}>
            <button onClick={handlePrev} style={{ background: 'none', border: 'none', color: C.textDim, fontSize: 20, cursor: 'pointer' }}>⏮</button>
            <button onClick={handleToggle} style={{ background: 'none', border: 'none', color: C.green, fontSize: 26, cursor: 'pointer' }}>{isPlaying ? '⏸' : '▶'}</button>
            <button onClick={handleNext} style={{ background: 'none', border: 'none', color: C.textDim, fontSize: 20, cursor: 'pointer' }}>⏭</button>
          </div>

          {/* Volume */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={toggleMute} style={{ background: 'none', border: 'none', color: isMuted ? C.green : C.textMuted, fontSize: 14, cursor: 'pointer' }}>{isMuted ? '🔇' : '🔊'}</button>
            <input type="range" min={0} max={100} value={isMuted ? 0 : Math.round(volume * 100)}
              onChange={e => handleVolumeChange(Number(e.target.value) / 100)}
              style={{ width: 100, accentColor: C.green, height: 2 }} />
          </div>

          {/* Waveform */}
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

        {/* --- PAGE 3: Genres --- */}
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start', overflow: 'auto', padding: '20px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.white, marginBottom: 4 }}>{t('genres')}</h2>
          <p style={{ fontSize: 12, color: C.textDim, marginBottom: 20 }}>{t('browseByStyle')}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {genres.map((g, i) => (
              <div key={i} onClick={() => handleGenreSelect(g)} style={{
                padding: '18px 14px', borderRadius: C.radiusSm,
                background: selectedGenre === g
                  ? `linear-gradient(135deg, rgba(${genreColors[i]},0.3), rgba(51,255,102,0.1))`
                  : `linear-gradient(135deg, rgba(${genreColors[i]},0.12), rgba(0,0,0,0.3))`,
                border: selectedGenre === g ? `1px solid ${C.green}` : `1px solid ${C.border}`,
                cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{genreIcons[i]}</div>
                <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{g}</div>
              </div>
            ))}
          </div>
        </div>

        {/* --- PAGE 4: Comments (chat) --- */}
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: C.white, margin: 0 }}>{t('comments')}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: C.green, letterSpacing: 2, fontWeight: 600 }}>{t('live')}</span>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '0 20px' }}>
            {messages.length === 0 && (
              <div style={{ color: C.textMuted, textAlign: 'center', padding: '40px 0', fontStyle: 'italic', fontSize: 13 }}>— {t('noComments')} —</div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ padding: '8px 0' }}>
                {m.role === 'dj' ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, #334, #223)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🎵</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>Claudio</span>
                        <span style={{ fontSize: 10, color: C.textMuted }}>{m.ts}</span>
                      </div>
                      <div style={{ background: C.surfaceAlt, borderRadius: C.radiusSm, padding: '10px 12px', border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, fontWeight: 300 }}>{m.text}</div>
                      </div>
                      <button style={{ marginTop: 3, background: 'none', border: 'none', color: C.textMuted, fontSize: 9, cursor: 'pointer', padding: 0 }}>↺ replay</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ maxWidth: '80%' }}>
                      <div style={{ background: C.greenDark, borderRadius: C.radiusSm, padding: '10px 12px', border: `1px solid rgba(51,255,102,0.1)` }}>
                        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{m.text}</div>
                      </div>
                      <div style={{ textAlign: 'right', marginTop: 2, paddingRight: 4 }}>
                        <span style={{ fontSize: 10, color: C.textMuted }}>{m.ts}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 20px 14px', borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
            <button onClick={handleVoice} style={{
              width: 36, height: 36, borderRadius: 18, flexShrink: 0,
              background: C.whiteAlpha, border: `1px solid ${C.border}`,
              color: C.textDim, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>🎤</button>
            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && chatInput.trim()) handleSend(chatInput.trim()); }}
              placeholder={t('messageClaudio')}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 22, border: `1px solid ${C.border}`, background: C.whiteAlpha, color: C.text, fontSize: 13, outline: 'none' }} />
            <button onClick={() => handleSend(chatInput)} disabled={loading || !chatInput.trim()} style={{
              padding: '10px 16px', borderRadius: 22,
              border: `1px solid ${chatInput.trim() ? C.green : C.border}`,
              background: chatInput.trim() ? C.greenDim : C.whiteAlpha,
              color: chatInput.trim() ? C.green : C.textMuted,
              fontSize: 12, cursor: 'pointer', letterSpacing: 2, fontWeight: 600,
            }}>SEND</button>
          </div>
        </div>

        {/* --- PAGE 5: Settings --- */}
        <div style={{ minWidth: '100%', scrollSnapAlign: 'start', overflow: 'auto', padding: '20px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.white, marginBottom: 4 }}>{t('settings')}</h2>
          <p style={{ fontSize: 12, color: C.textDim, marginBottom: 20 }}>{t('appConfig')}</p>

          {/* Language switch */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: C.text }}>{t('language')}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setLang('zh')} style={{
                padding: '5px 14px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: lang === 'zh' ? C.white : C.whiteAlpha,
                border: 'none', color: lang === 'zh' ? '#000' : C.textDim,
              }}>中文</button>
              <button onClick={() => setLang('en')} style={{
                padding: '5px 14px', borderRadius: 16, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: lang === 'en' ? C.white : C.whiteAlpha,
                border: 'none', color: lang === 'en' ? '#000' : C.textDim,
              }}>English</button>
            </div>
          </div>

          {/* Audio quality */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: C.text }}>{t('audioQuality')}</span>
            <span style={{ fontSize: 12, color: C.textDim }}>{t('high320')}</span>
          </div>

          {/* Play mode */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: C.text }}>{t('playMode')}</span>
            <span style={{ fontSize: 12, color: C.textDim }}>{t('shuffle')}</span>
          </div>

          {/* Download quality */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: C.text }}>{t('downloadQuality')}</span>
            <span style={{ fontSize: 12, color: C.textDim }}>{t('flac')}</span>
          </div>

          {/* Sleep timer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: C.text }}>{t('sleepTimer')}</span>
            <span style={{ fontSize: 12, color: C.textDim }}>{t('off')}</span>
          </div>

          {/* Autoplay toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: C.text }}>{t('autoplay')}</span>
            <button onClick={() => setAutoPlay(!autoPlay)} style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: autoPlay ? C.green : 'rgba(255,255,255,0.1)',
              transition: 'background 0.2s', position: 'relative',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: autoPlay ? 22 : 2, transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {/* Preload toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, color: C.text }}>{t('preloadNext')}</span>
            <button onClick={() => setPreloadNext(!preloadNext)} style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: preloadNext ? C.green : 'rgba(255,255,255,0.1)',
              transition: 'background 0.2s', position: 'relative',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: preloadNext ? 22 : 2, transition: 'left 0.2s',
              }} />
            </button>
          </div>

          {/* Status */}
          <div style={{ marginTop: 24, padding: '16px', borderRadius: C.radiusSm, background: C.surface, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.green, marginBottom: 8 }}>{t('connected')}</div>
            <div style={{ fontSize: 12, color: C.textDim }}>Claudio AI Radio v2.0</div>
          </div>
        </div>
      </div>

      {/* ===== Page dots ===== */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '6px 0 2px', flexShrink: 0 }}>
        {PAGE_NAMES.map((_, i) => (
          <div key={i} onClick={() => setActivePage(i)} style={{
            width: activePage === i ? 16 : 6, height: 6, borderRadius: 3,
            background: activePage === i ? C.green : C.textMuted,
            transition: 'all 0.3s', cursor: 'pointer',
          }} />
        ))}
      </div>

      {/* ===== Mini player (hide on Player page) ===== */}
      {showMini && current && (
        <div onClick={() => setActivePage(2)} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
          background: 'rgba(13,10,20,0.95)', backdropFilter: 'blur(20px)',
          borderTop: `1px solid ${C.border}`, cursor: 'pointer', height: 56, flexShrink: 0,
        }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(135deg, #334, #223)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎵</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{current.name}</div>
            <div style={{ fontSize: 11, color: C.textDim }}>{current.artist}</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); handleToggle(); }} style={{
            background: 'none', border: 'none', color: C.green, fontSize: 22, cursor: 'pointer', padding: 4,
          }}>{isPlaying ? '⏸' : '▶'}</button>
        </div>
      )}

      {/* ===== Bottom tab bar ===== */}
      <div style={{
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '6px 0 10px', flexShrink: 0,
        background: 'rgba(13,10,20,0.95)', backdropFilter: 'blur(20px)',
        borderTop: `1px solid ${C.border}`,
      }}>
        {PAGE_NAMES.map((name, i) => (
          <button key={name} onClick={() => setActivePage(i)} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <span style={{ fontSize: activePage === i ? 18 : 14, opacity: activePage === i ? 1 : 0.4, transition: 'all 0.2s' }}>
              {PAGE_ICONS[i]}
            </span>
            <span style={{ fontSize: 8, color: activePage === i ? C.green : C.textMuted, letterSpacing: 1, fontWeight: 600, textTransform: 'uppercase' }}>
              {t([name.toLowerCase()])}
            </span>
          </button>
        ))}
      </div>

      <audio ref={attachAudio} preload="auto" />
    </div>
  );
}
