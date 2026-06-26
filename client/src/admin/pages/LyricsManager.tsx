import { useState } from 'react';

interface LyricLine {
  time: number;
  text: string;
}

export default function LyricsManager() {
  const [selectedSong, setSelectedSong] = useState<string>('');
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [editing, setEditing] = useState(false);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const parsed = parseLRC(content);
      setLyrics(parsed);
      setEditing(true);
    };
    reader.readAsText(file);
  };

  const parseLRC = (content: string): LyricLine[] => {
    const lines = content.split('\n');
    const result: LyricLine[] = [];

    for (const line of lines) {
      const match = line.match(/\[(\d+):(\d+)\.(\d+)\](.*)/);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const ms = parseInt(match[3], 10);
        const time = minutes * 60 + seconds + ms / (match[3].length === 2 ? 100 : 1000);
        result.push({ time, text: match[4].trim() });
      }
    }

    return result;
  };

  const fmtTime = (s: number): string => {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };

  const handleSave = () => {
    // Save lyrics to API
    setEditing(false);
  };

  return (
    <div>
      {/* Upload area */}
      <div style={{
        background: 'rgba(0,0,0,0.3)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)', padding: '24px',
        marginBottom: 16, textAlign: 'center',
      }}>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
          上传 LRC 格式歌词文件
        </div>
        <label style={{
          display: 'inline-block', padding: '10px 20px', borderRadius: 8,
          border: '1px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.03)',
          color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer',
        }}>
          选择文件
          <input type="file" accept=".lrc" onChange={handleUpload} style={{ display: 'none' }} />
        </label>
      </div>

      {/* Lyrics editor */}
      {editing && (
        <div style={{
          background: 'rgba(0,0,0,0.3)', borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.06)', padding: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>歌词编辑器</h3>
            <button onClick={handleSave} style={{
              padding: '6px 14px', borderRadius: 8,
              border: '1px solid rgba(51,255,102,0.2)', background: 'rgba(51,255,102,0.08)',
              color: '#3f6', fontSize: 12, cursor: 'pointer',
            }}>保存</button>
          </div>

          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {lyrics.map((line, i) => (
              <div key={i} style={{
                display: 'flex', gap: 12, padding: '8px 0',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', minWidth: 60 }}>{fmtTime(line.time)}</span>
                <input
                  type="text" value={line.text}
                  onChange={e => {
                    const newLyrics = [...lyrics];
                    newLyrics[i].text = e.target.value;
                    setLyrics(newLyrics);
                  }}
                  style={{
                    flex: 1, padding: '4px 8px', borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)',
                    color: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!editing && (
        <div style={{
          background: 'rgba(0,0,0,0.3)', borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.06)', padding: '40px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 20, marginBottom: 12, opacity: 0.3 }}>📝</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
            上传 LRC 文件开始编辑歌词
          </div>
        </div>
      )}
    </div>
  );
}
