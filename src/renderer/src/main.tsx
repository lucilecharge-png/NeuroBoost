import './assets/main.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initApi } from './data/api'

// La DB (sql.js + IndexedDB) doit être prête avant que les écrans n'appellent window.api.
initApi().then(() => {
  ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
