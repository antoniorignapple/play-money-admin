import UpdateNotice from './components/UpdateNotice.jsx'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Elimina soltanto la vecchia cache runtime che conteneva risposte Supabase.
// Le cache necessarie al funzionamento della PWA restano invariate.
if ('caches' in window) {
  window.addEventListener('load', () => {
    caches.delete('supabase-cache').catch(() => {})
  }, { once: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <UpdateNotice />
  </StrictMode>,
)
