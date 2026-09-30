import { Component, StrictMode } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Studio render failed', error, info.componentStack); }
  render() {
    return this.state.failed ? <main className="fatal-error"><h1>The studio needs a fresh start.</h1><p>Reload to reopen your last saved workspace.</p><button onClick={() => window.location.reload()}>Reload studio</button></main> : this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);
