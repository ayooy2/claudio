import type { AdminPage } from '../AdminApp.js';

interface Props {
  active: AdminPage;
  onChange: (page: AdminPage) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const MENU_ITEMS: { key: AdminPage; icon: string; label: string; desc: string }[] = [
  { key: 'dashboard', icon: '📊', label: '仪表盘', desc: '系统状态概览' },
  { key: 'music', icon: '🎵', label: '音乐库', desc: '管理所有歌曲' },
  { key: 'playlist', icon: '📋', label: '歌单管理', desc: '创建和编辑歌单' },
  { key: 'lyrics', icon: '📝', label: '歌词管理', desc: '上传和编辑歌词' },
  { key: 'scenes', icon: '🌧️', label: '场景系统', desc: '配置沉浸式场景' },
  { key: 'player', icon: '⚙️', label: '播放器配置', desc: '定制播放器外观' },
  { key: 'system', icon: '🔧', label: '系统设置', desc: 'API和系统配置' },
];

export default function Sidebar({ active, onChange, isOpen, onToggle }: Props) {
  return (
    <aside style={{
      width: isOpen ? 240 : 60, height: '100vh', position: 'fixed', left: 0, top: 0,
      background: 'rgba(0,0,0,0.5)', borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', transition: 'width 0.3s ease',
      zIndex: 50, overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: '16px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        cursor: 'pointer', flexShrink: 0,
      }} onClick={onToggle}>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.9)' }}>
          {isOpen ? 'Claudio' : 'C'}
        </span>
        {isOpen && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>ADMIN</span>}
      </div>

      {/* Menu */}
      <nav style={{ flex: 1, padding: '8px 0', overflow: 'auto' }}>
        {MENU_ITEMS.map(item => (
          <button key={item.key} onClick={() => onChange(item.key)} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', padding: '12px 16px', border: 'none',
            background: active === item.key ? 'rgba(51,255,102,0.08)' : 'transparent',
            color: active === item.key ? '#3f6' : 'rgba(255,255,255,0.5)',
            fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
            borderLeft: active === item.key ? '3px solid #3f6' : '3px solid transparent',
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
            {isOpen && (
              <div>
                <div style={{ whiteSpace: 'nowrap', fontWeight: active === item.key ? 600 : 400 }}>{item.label}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{item.desc}</div>
              </div>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      {isOpen && (
        <div style={{
          padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center',
        }}>
          Claudio Music Player v2.0
        </div>
      )}
    </aside>
  );
}
