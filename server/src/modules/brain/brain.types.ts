export interface BrainResult {
  say: string[];
  play: { name: string; artist: string }[];
  reason: string;
  segue: boolean;
  action: 'now' | 'next';  // "now" = replace current, "next" = queue after current
}

export interface ClaudeRawOutput {
  say?: string | string[];
  play?: (string | { name?: string; song?: string; title?: string; artist?: string; singer?: string })[];
  reason?: string;
  segue?: boolean;
  action?: 'now' | 'next';
}
