import { useState } from 'react';

interface Scene {
  id: string;
  name: string;
  description: string;
  bg: string;
  accent: string;
  particleCount: number;
  enabled: boolean;
}

const DEFAULT_SCENES: Scene[] = [
  { id: 'rain', name: '雨天', description: '深灰蓝渐变，细密白色像素雨滴下落', bg: 'linear-gradient(180deg, #1a2030 0%, #0f1a2a 100%)', accent: '#4a9eff', particleCount: 60, enabled: true },
  { id: 'afternoon', name: '下午', description: '暖黄色渐变，金色像素阳光斜射', bg: 'linear-gradient(180deg, #3a3020 0%, #2a2010 100%)', accent: '#ffaa44', particleCount: 30, enabled: true },
  { id: 'evening', name: '傍晚', description: '橙紫色渐变，缓慢移动的像素云朵', bg: 'linear-gradient(180deg, #4a2a3a 0%, #2a1a2a 100%)', accent: '#ff6688', particleCount: 20, enabled: true },
  { id: 'night', name: '深夜', description: '纯黑背景，闪烁白色像素星空', bg: 'linear-gradient(180deg, #050508 0%, #0a0a10 100%)', accent: '#3f6', particleCount: 80, enabled: true },
  { id: 'forest', name: '森林', description: '深绿色渐变，飘落的像素树叶', bg: 'linear-gradient(180deg, #1a2a1a 0%, #0f1a0f 100%)', accent: '#4ade80', particleCount: 40, enabled: true },
  { id: 'minimal', name: '极简', description: '纯黑背景，无动态元素', bg: '#000', accent: '#fff', particleCount: 0, enabled: true },
];

export default function SceneSettings() {
  const [scenes, setScenes] = useState<Scene[]>(DEFAULT_SCENES);
  const [editing, setEditing] = useState<string | null>(null);

  const toggleScene = (id: string) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const updateScene = (id: string, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
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
          {[
            { time: '12:00 - 18:00', scene: '下午', icon: '☀️' },
            { time: '18:00 - 20:00', scene: '傍晚', icon: '🌅' },
            { time: '20:00 - 06:00', scene: '深夜', icon: '🌙' },
            { time: '06:00 - 12:00', scene: '森林', icon: '🌲' },
          ].map((rule, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{rule.icon}</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{rule.time}</span>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>→ {rule.scene}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scene list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {scenes.map(scene => (
          <div key={scene.id} style={{
            background: 'rgba(0,0,0,0.3)', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden',
          }}>
            {/* Scene header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 20px', cursor: 'pointer',
            }} onClick={() => setEditing(editing === scene.id ? null : scene.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: scene.bg, border: '1px solid rgba(255,255,255,0.1)',
                }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.8)' }}>{scene.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{scene.description}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={(e) => { e.stopPropagation(); toggleScene(scene.id); }} style={{
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
                <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)', transform: editing === scene.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
              </div>
            </div>

            {/* Scene editor */}
            {editing === scene.id && (
              <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
                  {/* Background color */}
                  <div>
                    <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>背景渐变</label>
                    <input
                      type="text" value={scene.bg}
                      onChange={e => updateScene(scene.id, { bg: e.target.value })}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                        color: 'rgba(255,255,255,0.8)', fontSize: 12, outline: 'none',
                      }}
                    />
                  </div>

                  {/* Accent color */}
                  <div>
                    <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>强调色</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="color" value={scene.accent}
                        onChange={e => updateScene(scene.id, { accent: e.target.value })}
                        style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                      />
                      <input
                        type="text" value={scene.accent}
                        onChange={e => updateScene(scene.id, { accent: e.target.value })}
                        style={{
                          flex: 1, padding: '8px 12px', borderRadius: 6,
                          border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                          color: 'rgba(255,255,255,0.8)', fontSize: 12, outline: 'none',
                        }}
                      />
                    </div>
                  </div>

                  {/* Particle count */}
                  <div>
                    <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>粒子数量</label>
                    <input
                      type="range" min={0} max={100} value={scene.particleCount}
                      onChange={e => updateScene(scene.id, { particleCount: Number(e.target.value) })}
                      style={{ width: '100%', accentColor: scene.accent }}
                    />
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>{scene.particleCount}</div>
                  </div>

                  {/* Description */}
                  <div>
                    <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>描述</label>
                    <input
                      type="text" value={scene.description}
                      onChange={e => updateScene(scene.id, { description: e.target.value })}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                        color: 'rgba(255,255,255,0.8)', fontSize: 12, outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
