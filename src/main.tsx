import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// Debug: catch any unhandled errors that cause white screen
// Only show critical crashes in dev, or log in prod
window.addEventListener('error', () => {
});

window.addEventListener('unhandledrejection', (e) => {
  // Ignore AbortError as it's usually benign (cancelled requests)
  if (e.reason?.name === 'AbortError' || e.reason?.message?.includes('aborted')) {
    e.preventDefault(); // Prevent browser console noise
    return;
  }
  
  // Only show the crash screen in DEV mode and for non-abort errors
  if (import.meta.env.DEV) {
    document.body.innerHTML = `<div style="padding:20px;color:orange;font-family:monospace;background:#111;min-height:100vh"><h2>⚠️ Async Crash</h2><pre>${e.reason}</pre></div>`;
  }
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

  document.body.innerHTML = `<div style="padding:20px;color:red;font-family:monospace;background:#111;min-height:100vh"><h2>⚠️ Root Render Crash</h2><pre>${e instanceof Error ? e.message : String(e)}</pre></div>`;
}
