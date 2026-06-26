import { useState, useEffect } from 'react';
import { apiUrl } from '../../lib/api.js';

interface PlayerSettings {
  siteName: string;
  defaultVolume: number;
  autoPlay: boolean;
  showLyrics: boolean;
  showQueue: boolean;
  showLike: boolean;
  clockSize: number;
  clockColor: string;
  progressBarHeight: number;
  progressBarColor: string;
  buttonRadius: number;
  buttonOpacity: number;
}

const DEFAULT_SETTINGS: PlayerSettings = {
  siteName: 'Claudio',
  defaultVolume: 60,
  autoPlay: true,
  showLyrics: true,
  showQueue: true,
  showLike: true,
  clockSize: 14,
  clockColor: '#ffffff',
  progressBarHeight: 4,
  progressBarColor: '#3f6',
  buttonRadius: 50,
  buttonOpacity: 80,
};

export default function PlayerConfig() {
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load prefs from server on mount
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(apiUrl('/api/prefs'), { signal: ctrl.signal }).then(r => r.json()).then(prefs => {
      if (prefs && typeof prefs === 'object') {
        setSettings(prev => ({
          ...prev,
          defaultVolume: prefs.volume ? Math.round(parseFloat(prefs.volume) * 100) : prev.defaultVolume,
          autoPlay: prefs.auto_play !== 'false',
        }));
      }
    }).catch(() => {});
    return () => ctrl.abort();
  }, []);

  const update = (key: keyof PlayerSettings, value: string | number | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      const updates = [
        { key: 'volume', value: String(settings.defaultVolume / 100) },
        { key: 'auto_play', value: String(settings.autoPlay) },
      ];
      await Promise.all(updates.map(({ key, value }) =>
        fetch(apiUrl('/api/prefs'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value }),
        })
      ));
      setSaved(true);
      setError(null);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(`保存失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  type SettingItem =
    | { key: keyof PlayerSettings; label: string; type: 'text' | 'color' | 'toggle' }
    | { key: keyof PlayerSettings; label: string; type: 'range'; min: number; max: number };

  const sections: { title: string; items: SettingItem[] }[] = [
    {
      title: '基础配置',
      items: [
        { key: 'siteName', label: '站点名称', type: 'text' },
        { key: 'defaultVolume', label: '默认音量', type: 'range', min: 0, max: 100 },
        { key: 'autoPlay', label: '自动播放', type: 'toggle' },
      ],
    },
    {
      title: '功能开关',
      items: [
        { key: 'showLyrics', label: '显示歌词', type: 'toggle' },
        { key: 'showQueue', label: '显示队列', type: 'toggle' },
        { key: 'showLike', label: '显示收藏', type: 'toggle' },
      ],
    },
    {
      title: '外观定制',
      items: [
        { key: 'clockSize', label: '时钟大小', type: 'range', min: 8, max: 24 },
        { key: 'clockColor', label: '时钟颜色', type: 'color' },
        { key: 'progressBarHeight', label: '进度条高度', type: 'range', min: 2, max: 8 },
        { key: 'progressBarColor', label: '进度条颜色', type: 'color' },
        { key: 'buttonRadius', label: '按钮圆角', type: 'range', min: 0, max: 50 },
        { key: 'buttonOpacity', label: '按钮透明度', type: 'range', min: 20, max: 100 },
      ],
    },
  ];

  return (
    <div>
      {sections.map((section, si) => (
        <div key={si} style={{
          background: 'rgba(0,0,0,0.3)', borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.06)', padding: '20px', marginBottom: 16,
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>{section.title}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {section.items.map(item => (
              <div key={item.key} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}>
                <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{item.label}</label>
                {item.type === 'text' && (
                  <input
                    type="text" value={settings[item.key] as string}
                    onChange={e => update(item.key, e.target.value)}
                    style={{
                      padding: '6px 12px', borderRadius: 6,
                      border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                      color: 'rgba(255,255,255,0.8)', fontSize: 13, outline: 'none', width: 200,
                    }}
                  />
                )}
                {item.type === 'range' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="range" min={item.min} max={item.max} value={settings[item.key] as number}
                      onChange={e => update(item.key, Number(e.target.value))}
                      style={{ width: 120, accentColor: '#3f6' }}
                    />
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', minWidth: 30 }}>{settings[item.key] as number}</span>
                  </div>
                )}
                {item.type === 'color' && (
                  <input
                    type="color" value={settings[item.key] as string}
                    onChange={e => update(item.key, e.target.value)}
                    style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  />
                )}
                {item.type === 'toggle' && (
                  <button onClick={() => update(item.key, !settings[item.key])} style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                    background: settings[item.key] ? '#3f6' : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.2s', position: 'relative',
                  }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 2,
                      left: settings[item.key] ? 22 : 2, transition: 'left 0.2s',
                    }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 8,
          background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)',
          color: '#ff6666', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#ff6666', cursor: 'pointer', fontSize: 16 }}>&times;</button>
        </div>
      )}

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button onClick={handleSave} style={{
          padding: '10px 24px', borderRadius: 8,
          border: '1px solid rgba(51,255,102,0.2)', background: 'rgba(51,255,102,0.08)',
          color: '#3f6', fontSize: 13, cursor: 'pointer',
        }}>{saved ? '✓ 已保存' : '保存配置'}</button>
      </div>
    </div>
  );
}
