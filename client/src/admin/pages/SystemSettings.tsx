import { useState } from 'react';

export default function SystemSettings() {
  const [apiConfig, setApiConfig] = useState({
    neteaseApi: 'http://localhost:3000',
    brainApi: 'https://api.deepseek.com/anthropic',
    brainModel: 'deepseek-chat',
  });

  const [systemInfo] = useState({
    version: '2.0.0',
    nodeVersion: 'v24.14.1',
    uptime: '2h 30m',
    memoryUsage: '128 MB',
    diskUsage: '2.5 GB',
  });

  return (
    <div>
      {/* API Configuration */}
      <div style={{
        background: 'rgba(0,0,0,0.3)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)', padding: '20px', marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>API 配置</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>网易云音乐 API</label>
            <input
              type="text" value={apiConfig.neteaseApi}
              onChange={e => setApiConfig(prev => ({ ...prev, neteaseApi: e.target.value }))}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>AI 模型 API</label>
            <input
              type="text" value={apiConfig.brainApi}
              onChange={e => setApiConfig(prev => ({ ...prev, brainApi: e.target.value }))}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>AI 模型</label>
            <input
              type="text" value={apiConfig.brainModel}
              onChange={e => setApiConfig(prev => ({ ...prev, brainModel: e.target.value }))}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                color: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* System Info */}
      <div style={{
        background: 'rgba(0,0,0,0.3)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)', padding: '20px', marginBottom: 16,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>系统信息</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{
            padding: '10px 20px', borderRadius: 8,
            border: '1px solid rgba(51,255,102,0.2)', background: 'rgba(51,255,102,0.08)',
            color: '#3f6', fontSize: 12, cursor: 'pointer',
          }}>备份数据</button>
          <button style={{
            padding: '10px 20px', borderRadius: 8,
            border: '1px solid rgba(255,102,102,0.2)', background: 'rgba(255,102,102,0.08)',
            color: '#ff6666', fontSize: 12, cursor: 'pointer',
          }}>清理缓存</button>
          <button style={{
            padding: '10px 20px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
            color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer',
          }}>导出配置</button>
        </div>
      </div>
    </div>
  );
}
