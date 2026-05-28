import { useState, useEffect } from 'react';

const DOTS: Record<string, number[][]> = {
  '0': [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
  '1': [[0,0,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
  '2': [[1,1,1],[0,0,1],[1,1,1],[1,0,0],[1,1,1]],
  '3': [[1,1,1],[0,0,1],[1,1,1],[0,0,1],[1,1,1]],
  '4': [[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1]],
  '5': [[1,1,1],[1,0,0],[1,1,1],[0,0,1],[1,1,1]],
  '6': [[1,1,1],[1,0,0],[1,1,1],[1,0,1],[1,1,1]],
  '7': [[1,1,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
  '8': [[1,1,1],[1,0,1],[1,1,1],[1,0,1],[1,1,1]],
  '9': [[1,1,1],[1,0,1],[1,1,1],[0,0,1],[1,1,1]],
};

function Dots({ ch, size = 10, gap = 3, dark = false }: { ch: string; size?: number; gap?: number; dark?: boolean }) {
  const p = DOTS[ch];
  if (!p) return null;
  const onColor = dark ? '#111' : '#fff';
  const offColor = dark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
  return (
    <div style={{ display: 'inline-grid', gridTemplateColumns: `repeat(3, 1fr)`, gap }}>
      {p.flat().map((on, i) => (
        <div key={i} style={{
          width: size, height: size, borderRadius: 2,
          background: on ? onColor : offColor,
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  );
}

export default function Clock({ themeName }: { themeName: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const wd = now.toLocaleDateString('en-US', { weekday: 'long' });
  const dt = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const isDark = themeName === 'DARK';
  const dimColor = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const mutedColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
        <Dots ch={hh[0]} size={12} gap={4} dark={!isDark} />
        <Dots ch={hh[1]} size={12} gap={4} dark={!isDark} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '0 2px' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: isDark ? '#fff' : '#111' }} />
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: isDark ? '#fff' : '#111' }} />
        </div>
        <Dots ch={mm[0]} size={12} gap={4} dark={!isDark} />
        <Dots ch={mm[1]} size={12} gap={4} dark={!isDark} />
      </div>
      <div style={{ color: dimColor, fontSize: 11, letterSpacing: 3, marginTop: 12, fontWeight: 300 }}>{wd}</div>
      <div style={{ color: mutedColor, fontSize: 10, letterSpacing: 1, marginTop: 4 }}>{dt}</div>
    </div>
  );
}
