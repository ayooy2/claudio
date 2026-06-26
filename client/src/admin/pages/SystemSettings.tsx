import { useState } from 'react';

export default function SystemSettings() {
  const [apiConfig, setApiConfig] = useState({
    neteaseApi: 'http://localhost:3000',
    brainApi: 'https://api.deepseek.com',
    brainModel: 'deepseek-chat',
  });

  const [systemInfo] = useState({
    version: '2.0.0',
    nodeVersion: 'v24.14.1',
    uptime: '2h 30m',
    memoryUsage: '128 MB',
    diskUsage: '2.5 GB',
  });

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleClearCache = () => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('claudio_'));
      keys.forEach(k => localStorage.removeItem(k));
      setMessage({ type: 'success', text: `已清理 ${keys.length} 个缓存项` });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: '清理缓存失败' });
      setTimeout(() => setMessage(null), 3000);
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
      setMessage({ type: 'success', text: '配置已导出' });
      setTimeout(() => setMessage(null), 3000);
    } catch {
      setMessage({ type: 'error', text: '导出配置失败' });
      setTimeout(() => setMessage(null), 3000);
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

      {/* API Configuration */}
      <div style={{
        background: 'rgba(0,0,0,0.3)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)', padding: '20px', marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>API 配置</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {([
            { key: 'neteaseApi' as const, label: '网易云音乐 API' },
            { key: 'brainApi' as const, label: 'AI 模型 API' },
            { key: 'brainModel' as const, label: 'AI 模型' },
          ]).map(field => (
            <div key={field.key}>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>{field.label}</label>
              <input
                type="text" value={apiConfig[field.key]}
                onChange={e => setApiConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                  color: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* System Info */}
      <div style={{
        background: 'rgba(0,0,0,0.3)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)', padding: '20px', marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>系统信息</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {Object.entries(systemInfo).map(([key, value]) => (
            <div key={key} style={{
              padding: '12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>{value}</div>
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
