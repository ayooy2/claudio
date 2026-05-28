export interface EnvContext {
  weather: string;
  calendar: { summary: string; start: string; end: string }[];
}

export interface ContextInput {
  userInput: string;
  env?: EnvContext;
  trace?: string;
}
