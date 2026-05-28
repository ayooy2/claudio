const BASE = '';

export interface ChatResponse {
  type: string;
  playlist: { id: string; name: string; artist: string; album: string; duration: number; url: string | null }[];
  say: string[];
  reason: string;
  segue: boolean;
  action?: string;
}

export async function sendChat(message: string): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchNow() {
  const res = await fetch(`${BASE}/api/now`);
  return res.json();
}

export async function fetchTodayPlan() {
  const res = await fetch(`${BASE}/api/plan/today`);
  return res.json();
}

export async function fetchTaste() {
  const res = await fetch(`${BASE}/api/taste`);
  return res.json();
}

export async function fetchPrefs(): Promise<Record<string, string>> {
  const res = await fetch(`${BASE}/api/prefs`);
  return res.json();
}

export async function savePrefs(prefs: Record<string, string>): Promise<Record<string, string>> {
  const res = await fetch(`${BASE}/api/prefs`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
  return res.json();
}
