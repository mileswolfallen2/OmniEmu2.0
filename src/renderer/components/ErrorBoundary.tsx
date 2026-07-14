import React, { Component, ErrorInfo, ReactNode } from 'react';

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

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ padding: 24 }}>
          <h2 style={{ color: 'var(--danger, #ff4444)', marginTop: 0 }}>Something went wrong</h2>
          <p className="text-muted" style={{ marginBottom: 12 }}>
            An error occurred while loading this page.
          </p>
          <div style={{
            padding: 12, borderRadius: 8, background: 'var(--bg-tertiary, #222)',
            fontFamily: 'monospace', fontSize: 12, color: 'var(--danger, #ff4444)',
            whiteSpace: 'pre-wrap', marginBottom: 16, border: '1px solid var(--border, #555)',
          }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button className="btn btn-primary" onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
