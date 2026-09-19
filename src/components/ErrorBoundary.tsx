import React, { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }


  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[WAVE] Render error caught by ErrorBoundary:', error, info.componentStack);
  }


  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, background: '#F5F2E8', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'monospace', padding: '2rem', zIndex: 9999,
        }}>
          <div style={{
            maxWidth: 600, width: '100%', border: '4px solid #0A0A0A',
            boxShadow: '8px 8px 0 #FF304F', padding: '2rem', background: '#FFFFFF',
          }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', color: '#FF304F' }}>
              ⚠ SIGNAL LOST — RENDER ERROR
            </h1>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0A0A0A', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Error:
            </div>
            <pre style={{
              background: '#0A0A0A', color: '#39FF14', padding: '1rem', fontSize: '0.7rem',
              overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              marginBottom: '1.5rem', border: '2px solid #39FF14',
            }}>
              {this.state.error?.message || 'Unknown error'}
              {'\n\n'}
              {this.state.error?.stack?.slice(0, 800) || ''}
            </pre>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                background: '#0A0A0A', color: '#39FF14', border: '2px solid #39FF14',
                padding: '0.5rem 1.5rem', fontFamily: 'monospace', fontWeight: 900,
                fontSize: '0.75rem', textTransform: 'uppercase', cursor: 'pointer',
                letterSpacing: '0.1em',
              }}
            >
              ↺ RELOAD APP
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

