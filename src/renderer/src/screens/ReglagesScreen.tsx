import { useState } from 'react'
import Icon from '../components/Icon'
import BackupModal from '../components/BackupModal'
import CompteSyncModal from '../components/CompteSyncModal'
import { getTheme, setTheme, type Theme } from '../data/theme'

// Écran Réglages — regroupe les préférences d'appareil :
//   • Apparence (thème clair / sombre)
//   • Sauvegarde (export/import du fichier de données)
//   • Compte & Synchro (sync cloud)
export default function ReglagesScreen(): JSX.Element {
  const [theme, setThemeState] = useState<Theme>(getTheme())
  const [backupOuvert, setBackupOuvert] = useState(false)
  const [compteOuvert, setCompteOuvert] = useState(false)

  function choisirTheme(t: Theme): void {
    setTheme(t)
    setThemeState(t)
  }

  return (
    <div className="screen">
      {backupOuvert && <BackupModal onFermer={() => setBackupOuvert(false)} />}
      {compteOuvert && <CompteSyncModal onFermer={() => setCompteOuvert(false)} />}

      <div className="screen-title">⚙️ Réglages</div>
      <div className="screen-subtitle">Apparence, sauvegarde et synchronisation.</div>

      {/* ── Apparence ── */}
      <div className="section-header">Apparence</div>
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="row-between">
          <div>
            <div style={{ fontWeight: 600 }}>Thème</div>
            <div className="text-muted">Choisis l'ambiance claire ou sombre.</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button
              className={theme === 'light' ? 'btn-primary' : 'btn-ghost'}
              onClick={() => choisirTheme('light')}
            >
              ☀️ Clair
            </button>
            <button
              className={theme === 'dark' ? 'btn-primary' : 'btn-ghost'}
              onClick={() => choisirTheme('dark')}
            >
              🌙 Sombre
            </button>
          </div>
        </div>
      </div>

      {/* ── Données ── */}
      <div className="section-header">Données</div>
      <div className="col" style={{ gap: 12 }}>
        <button
          className="card row-between"
          style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
          onClick={() => setBackupOuvert(true)}
        >
          <div className="row" style={{ gap: 12 }}>
            <span style={{ color: 'var(--accent-light)' }}><Icon name="sauvegarde" size={22} /></span>
            <div>
              <div style={{ fontWeight: 600 }}>Sauvegarde</div>
              <div className="text-muted">Exporter ou importer ton fichier de données.</div>
            </div>
          </div>
          <span className="text-muted" style={{ fontSize: 18 }}>›</span>
        </button>

        <button
          className="card row-between"
          style={{ textAlign: 'left', cursor: 'pointer', width: '100%' }}
          onClick={() => setCompteOuvert(true)}
        >
          <div className="row" style={{ gap: 12 }}>
            <span style={{ color: 'var(--accent-light)' }}><Icon name="compte" size={22} /></span>
            <div>
              <div style={{ fontWeight: 600 }}>Compte &amp; Synchro</div>
              <div className="text-muted">Synchroniser tes données entre tes appareils.</div>
            </div>
          </div>
          <span className="text-muted" style={{ fontSize: 18 }}>›</span>
        </button>
      </div>
    </div>
  )
}
