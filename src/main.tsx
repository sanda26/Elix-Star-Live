import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// Debug: catch any unhandled errors that cause white screen
window.addEventListener('error', (e) => {
  document.body.innerHTML = `<div style="padding:20px;color:red;font-family:monospace;background:#111;min-height:100vh"><h2>⚠️ App Crash</h2><pre>${e.message}\n\n${e.filename}:${e.lineno}</pre></div>`;
});
window.addEventListener('unhandledrejection', (e) => {
  document.body.innerHTML = `<div style="padding:20px;color:orange;font-family:monospace;background:#111;min-height:100vh"><h2>⚠️ Async Crash</h2><pre>${e.reason}</pre></div>`;
});

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (e) {
  console.error('Root render failed:', e);
  document.body.innerHTML = `<div style="padding:20px;color:red;font-family:monospace;background:#111;min-height:100vh"><h2>⚠️ Root Render Crash</h2><pre>${e instanceof Error ? e.message : String(e)}</pre></div>`;
}
