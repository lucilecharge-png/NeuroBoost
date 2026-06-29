import './assets/main.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initApi } from './data/api'
import { initSyncController } from './data/sync/controller'
import { initTheme } from './data/theme'

// Thème appliqué tout de suite (avant le rendu) pour éviter un flash sombre.
initTheme()

// La DB (sql.js + IndexedDB) doit être prête avant que les écrans n'appellent window.api.
initApi().then(() => {
  initSyncController()
  ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
