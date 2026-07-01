import { useState, useEffect } from 'react';
import { apiUrl } from '../../lib/api.js';

interface SceneInfo {
  id: string;
  name: string;
  emoji: string;
  category: string;
  enabled: boolean;
}

// 与 App.tsx SCENE_CONFIG 保持一致的场景列表
const DEFAULT_SCENES: SceneInfo[] = [
  { id: 'starry', name: '星空', emoji: '✨', category: 'dynamic', enabled: true },
  { id: 'aurora', name: '极光', emoji: '🌌', category: 'dynamic', enabled: true },
  { id: 'ocean', name: '深海', emoji: '🌊', category: 'life', enabled: true },
  { id: 'sunset', name: '落日', emoji: '🌅', category: 'life', enabled: true },
  { id: 'rainy', name: '雨夜', emoji: '🌧️', category: 'dynamic', enabled: true },
  { id: 'neon', name: '霓虹', emoji: '💜', category: 'dynamic', enabled: true },
  { id: 'citynight', name: '城市', emoji: '🏙️', category: 'life', enabled: true },
  { id: 'firefly', name: '萤火', emoji: '🌿', category: 'life', enabled: true },
  { id: 'snow', name: '初雪', emoji: '❄️', category: 'dynamic', enabled: true },
  { id: 'lavender', name: '薰衣草', emoji: '💜', category: 'life', enabled: true },
  { id: 'minimal', name: '极简', emoji: '◾', category: 'life', enabled: true },
];

// 自动切换规则（与 App.tsx 一致）
const AUTO_SWITCH_RULES = [
  { time: '06:00 - 12:00', sceneId: 'starry', sceneName: '星空', icon: '✨' },
  { time: '12:00 - 18:00', sceneId: 'sunset', sceneName: '落日', icon: '🌅' },
  { time: '18:00 - 20:00', sceneId: 'aurora', sceneName: '极光', icon: '🌌' },
  { time: '其他时间', sceneId: 'neon', sceneName: '霓虹', icon: '💜' },
];

export default function SceneSettings() {
  const [scenes, setScenes] = useState<SceneInfo[]>(() => {
    try {
      const saved = localStorage.getItem('claudio_scene_enabled');
      if (saved) {
        const enabledMap = JSON.parse(saved);
        return DEFAULT_SCENES.map(s => ({ ...s, enabled: enabledMap[s.id] !== false }));
      }
    } catch { /* ignore */ }
    return DEFAULT_SCENES;
  });
  const [saved, setSaved] = useState(false);

  // 保存启用状态到 localStorage
  useEffect(() => {
    const enabledMap: Record<string, boolean> = {};
    scenes.forEach(s => { enabledMap[s.id] = s.enabled; });
    localStorage.setItem('claudio_scene_enabled', JSON.stringify(enabledMap));
  }, [scenes]);

  const toggleScene = (id: string) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const handleReset = () => {
    setScenes(DEFAULT_SCENES);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      {/* Auto switch rules */}
      <div style={{
        background: 'rgba(0,0,0,0.3)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.06)', padding: '20px', marginBottom: 24,
      }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>自动切换规则</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {AUTO_SWITCH_RULES.map((rule, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{rule.icon}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{rule.time}</span>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>→ {rule.sceneName}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>
          自动切换逻辑与播放器一致
        </div>
      </div>

      {/* Scene list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {scenes.map(scene => (
          <div key={scene.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px', borderRadius: 12,
            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>{scene.emoji}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>{scene.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                  {scene.category === 'dynamic' ? '动态' : '生活'} · {scene.id}
                </div>
              </div>
            </div>
            <button onClick={() => toggleScene(scene.id)} style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: scene.enabled ? '#3f6' : 'rgba(255,255,255,0.1)',
              transition: 'background 0.2s', position: 'relative',
            }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                position: 'absolute', top: 2,
                left: scene.enabled ? 22 : 2, transition: 'left 0.2s',
              }} />
            </button>
          </div>
        ))}
      </div>

      {/* Reset button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
        <button onClick={handleReset} style={{
          padding: '10px 20px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
          color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer',
        }}>{saved ? '✓ 已重置' : '恢复默认'}</button>
      </div>
    </div>
  );
}
