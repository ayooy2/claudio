import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          width: '100vw', height: '100vh',
          background: '#0a0a1a', color: 'rgba(255,255,255,0.9)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>😵</div>
          <h2 style={{ fontSize: 20, marginBottom: 8, fontWeight: 600 }}>页面出错了</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24, maxWidth: 400 }}>
            {this.state.error?.message || '发生了未知错误'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 24px', borderRadius: 8,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', cursor: 'pointer', fontSize: 14,
            }}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
