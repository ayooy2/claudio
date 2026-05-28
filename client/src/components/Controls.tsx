interface Props {
  isPlaying: boolean; isMuted: boolean; hasTrack: boolean; volume: number;
  onToggle: () => void; onPrev: () => void; onNext: () => void;
  onStop: () => void; onMute: () => void; onVolumeChange: (v: number) => void;
  green: string;
}

export default function Controls({ isPlaying, isMuted, hasTrack, volume, onToggle, onPrev, onNext, onStop, onMute, onVolumeChange, green }: Props) {
  const btn = (active = false): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px',
    color: active ? green : 'rgba(128,128,128,0.4)',
    fontSize: 18, transition: 'color 0.2s', lineHeight: 1,
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, padding: '8px 0 4px' }}>
      <button style={btn()} onClick={onPrev} title="上一曲 (←)">⏮</button>
      <button style={btn(isPlaying)} onClick={onToggle} title="播放/暂停 (空格)">{isPlaying ? '⏸' : '▶'}</button>
      <button style={btn()} onClick={onNext} title="下一曲 (→)">⏭</button>
      <button style={btn()} onClick={onStop} title="停止 (S)">⏹</button>
      <button style={btn(isMuted)} onClick={onMute} title="静音 (M)">{isMuted ? '🔇' : '🔊'}</button>
      <div style={{ marginLeft: 10 }}>
        <input type="range" min={0} max={100}
          value={isMuted ? 0 : Math.round(volume * 100)}
          onChange={e => onVolumeChange(Number(e.target.value) / 100)}
          style={{ width: 64, accentColor: green, opacity: 0.7, height: 2 }} />
      </div>
    </div>
  );
}
