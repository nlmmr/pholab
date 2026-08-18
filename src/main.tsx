import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PhOLab React Error Caught:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 32,
          fontFamily: 'monospace',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          height: '100vh',
          boxSizing: 'border-box'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: 12 }}>⚠️ Erro de Renderização Detectado</h2>
          <div style={{
            background: '#1e293b',
            padding: 16,
            borderRadius: 8,
            border: '1px solid #334155',
            color: '#fde047',
            marginBottom: 16,
            whiteSpace: 'pre-wrap'
          }}>
            {this.state.error?.toString()}
          </div>
          <details style={{ color: '#94a3b8' }}>
            <summary style={{ cursor: 'pointer', marginBottom: 8 }}>Pilha de Execução (Stack Trace)</summary>
            <pre style={{ fontSize: 12, overflowX: 'auto' }}>
              {this.state.error?.stack}
              {'\n'}
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Recarregar Aplicação
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
