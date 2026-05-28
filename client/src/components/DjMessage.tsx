import { useEffect, useRef } from 'react';

interface Props { text: string; autoSpeak?: boolean }

// Preload Chinese voices
let voicesReady = false;
let bestVoice: SpeechSynthesisVoice | null = null;

function ensureVoices(): Promise<SpeechSynthesisVoice | null> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) return resolve(null);
    const synth = window.speechSynthesis;
    const voices = synth.getVoices();
    if (voices.length > 0 && voicesReady) {
      return resolve(bestVoice);
    }
    synth.onvoiceschanged = () => {
      const all = synth.getVoices();
      bestVoice = all.find(v => v.lang.startsWith('zh-CN')) || all.find(v => v.lang.startsWith('zh')) || null;
      voicesReady = true;
      resolve(bestVoice);
    };
  });
}

export default function DjMessage({ text, autoSpeak = false }: Props) {
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const spokenRef = useRef(false);

  useEffect(() => {
    if (!autoSpeak || spokenRef.current || !text) return;
    spokenRef.current = true;

    ensureVoices().then(voice => {
      if (!('speechSynthesis' in window)) return;
      synthRef.current = window.speechSynthesis;
      synthRef.current.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN'; u.rate = 1.0; u.pitch = 1.0;
      if (voice) u.voice = voice;
      synthRef.current.speak(u);
    });
  }, [text, autoSpeak]);

  const replay = () => {
    if (!('speechSynthesis' in window)) return;
    synthRef.current = window.speechSynthesis;
    synthRef.current.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 1.0;
    if (bestVoice) u.voice = bestVoice;
    synthRef.current.speak(u);
  };

  if (!text) return null;

  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div style={{ display: 'flex', gap: 10, padding: '12px 0' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'linear-gradient(135deg, #334, #223)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, flexShrink: 0,
        border: '1px solid rgba(255,255,255,0.08)',
      }}>🎵</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 500 }}>Claudio</span>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>{ts}</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 1.6, fontWeight: 300 }}>{text}</div>
        <button onClick={replay} style={{
          marginTop: 4, background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.2)', fontSize: 10, cursor: 'pointer', padding: 0,
        }}>↺ replay</button>
      </div>
    </div>
  );
}
