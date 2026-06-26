import { useState } from 'react';
import Sidebar from './components/Sidebar.js';
import MusicLibrary from './pages/MusicLibrary.js';
import PlaylistManager from './pages/PlaylistManager.js';
import LyricsManager from './pages/LyricsManager.js';
import SceneSettings from './pages/SceneSettings.js';
import PlayerConfig from './pages/PlayerConfig.js';
import Dashboard from './pages/Dashboard.js';
import SystemSettings from './pages/SystemSettings.js';

export type AdminPage = 'dashboard' | 'music' | 'playlist' | 'lyrics' | 'scenes' | 'player' | 'system';

const PAGE_TITLES: Record<AdminPage, string> = {
  dashboard: '仪表盘',
  music: '音乐库管理',
  playlist: '歌单管理',
  lyrics: '歌词管理',
  scenes: '场景系统',
  player: '播放器配置',
  system: '系统设置',
};

export default function AdminApp() {
  const [page, setPage] = useState<AdminPage>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div id="admin-root" style={{
      display: 'flex', height: '100vh', background: '#0a0a10',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: 'rgba(255,255,255,0.8)',
    }}>
      {/* Sidebar */}
      <Sidebar active={page} onChange={setPage} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      {/* Main content */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        marginLeft: sidebarOpen ? 240 : 60, transition: 'margin-left 0.3s ease',
      }}>
        {/* Header */}
        <header style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.3)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'rgba(255,255,255,0.9)' }}>
              {PAGE_TITLES[page]}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/" target="_blank" style={{
              padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(51,255,102,0.08)', color: '#3f6', fontSize: 12, cursor: 'pointer',
              textDecoration: 'none',
            }}>预览前端</a>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {page === 'dashboard' && <Dashboard />}
          {page === 'music' && <MusicLibrary />}
          {page === 'playlist' && <PlaylistManager />}
          {page === 'lyrics' && <LyricsManager />}
          {page === 'scenes' && <SceneSettings />}
          {page === 'player' && <PlayerConfig />}
          {page === 'system' && <SystemSettings />}
        </main>
      </div>
    </div>
  );
}
