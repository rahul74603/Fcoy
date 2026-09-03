import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          fontFamily: 'monospace',
          background: '#1a1a2e',
          color: '#e94560',
          minHeight: '100vh',
          whiteSpace: 'pre-wrap',
          overflow: 'auto',
        }}>
          <h1 style={{ color: '#e94560', fontSize: '24px' }}>
            ⚠️ Application Error
          </h1>
          <p style={{ color: '#eee', fontSize: '14px' }}>
            The app crashed. Here's what went wrong:
          </p>
          <div style={{
            background: '#16213e',
            padding: '20px',
            borderRadius: '8px',
            marginTop: '16px',
            border: '1px solid #e94560',
          }}>
            <p style={{ color: '#e94560', fontWeight: 'bold' }}>
              {this.state.error?.toString()}
            </p>
            <details style={{ marginTop: '12px', color: '#aaa' }}>
              <summary style={{ cursor: 'pointer', color: '#0f3460' }}>
                Stack Trace (click to expand)
              </summary>
              <pre style={{ fontSize: '12px', marginTop: '8px', color: '#aaa' }}>
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '24px',
              padding: '12px 24px',
              background: '#e94560',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
