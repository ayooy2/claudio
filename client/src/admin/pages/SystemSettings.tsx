import { useState, useRef, useEffect } from 'react';
import { apiUrl } from '../../lib/api.js';

export default function SystemSettings() {
  const [systemInfo, setSystemInfo] = useState({
    version: '2.0.0',
    apiStatus: '检测中...',
    totalSongs: '-',
    totalPlaylists: '-',
    totalPlays: '-',
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (msgTimerRef.current) clearTimeout(msgTimerRef.current); }, []);

  // 获取真实系统信息
  useEffect(() => {
    const ctrl = new AbortController();

    fetch(apiUrl('/api/playlist'), { signal: ctrl.signal }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }).then(data => {
      setSystemInfo(prev => ({ ...prev, totalSongs: String(data.total || 0), apiStatus: '正常' }));
    }).catch(() => {
      setSystemInfo(prev => ({ ...prev, apiStatus: '异常' }));
    });

    fetch(apiUrl('/api/playlists'), { signal: ctrl.signal }).then(r => r.json()).then(data => {
      setSystemInfo(prev => ({ ...prev, totalPlaylists: String(Array.isArray(data) ? data.length : 0) }));
    }).catch(() => {});

    fetch(apiUrl('/api/plays/recent?limit=1000'), { signal: ctrl.signal }).then(r => r.json()).then(data => {
      setSystemInfo(prev => ({ ...prev, totalPlays: String(Array.isArray(data) ? data.length : 0) }));
    }).catch(() => {});

    return () => ctrl.abort();
  }, []);

  const showTempMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    msgTimerRef.current = setTimeout(() => { setMessage(null); msgTimerRef.current = null; }, 3000);
  };

  const handleClearCache = () => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('claudio_'));
      keys.forEach(k => localStorage.removeItem(k));
      showTempMessage('success', `已清理 ${keys.length} 个缓存项`);
    } catch {
      showTempMessage('error', '清理缓存失败');
    }
  };

  const handleExportConfig = () => {
    try {
      const config: Record<string, unknown> = {};
      Object.keys(localStorage).filter(k => k.startsWith('claudio_')).forEach(k => {
        try { config[k] = JSON.parse(localStorage.getItem(k) || ''); } catch { config[k] = localStorage.getItem(k); }
      });
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `claudio-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      showTempMessage('success', '配置已导出');
    } catch {
      showTempMessage('error', '导出配置失败');
    }
  };

  return (
    <div>
      {message && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 8,
          background: message.type === 'success' ? 'rgba(51,255,102,0.1)' : 'rgba(255,80,80,0.1)',
          border: `1px solid ${message.type === 'success' ? 'rgba(51,255,102,0.3)' : 'rgba(255,80,80,0.3)'}`,
          color: message.type === 'success' ? '#3f6' : '#ff6666', fontSize: 13,
        }}>{message.text}</div>
      )}

      {/* System Info */}
      <div style={{
        background: 'rgba(0,0,0,0.3)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)', padding: '20px', marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>系统信息</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {([
            { label: '版本', value: systemInfo.version },
            { label: 'API 状态', value: systemInfo.apiStatus },
            { label: '音乐总数', value: systemInfo.totalSongs },
            { label: '歌单数量', value: systemInfo.totalPlaylists },
            { label: '播放记录', value: systemInfo.totalPlays },
          ]).map(item => (
            <div key={item.label} style={{
              padding: '12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{
        background: 'rgba(0,0,0,0.3)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)', padding: '20px',
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>系统操作</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={handleClearCache} style={{
            padding: '10px 20px', borderRadius: 8,
            border: '1px solid rgba(255,102,102,0.2)', background: 'rgba(255,102,102,0.08)',
            color: '#ff6666', fontSize: 12, cursor: 'pointer',
          }}>清理缓存</button>
          <button onClick={handleExportConfig} style={{
            padding: '10px 20px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer',
          }}>导出配置</button>
        </div>
      </div>
    </div>
  );
}
