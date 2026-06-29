import { useState, useEffect } from 'react'
import type { ProfilDTO } from '../../shared/types'
import AccueilScreen from './screens/AccueilScreen'
import QuestesScreen from './screens/QuestesScreen'
import RecompensesScreen from './screens/RecompensesScreen'
import CapturesScreen from './screens/CapturesScreen'
import CoachingScreen from './screens/CoachingScreen'
import TimerScreen from './screens/TimerScreen'
import TunnelScreen from './screens/TunnelScreen'
import RendezVousScreen from './screens/RendezVousScreen'
import AgendaScreen from './screens/AgendaScreen'
import ReglagesScreen from './screens/ReglagesScreen'
import RituelEcran from './components/RituelEcran'
import Icon, { type IconName } from './components/Icon'
import { getRituelConfig, phaseActuelle, rituelFaitAujourdhui, marquerRituelFait, type Phase } from './data/rituels'

type Onglet = 'accueil' | 'quetes' | 'agenda' | 'tunnel' | 'captures' | 'coaching' | 'timer' | 'rendezvous' | 'recompenses' | 'reglages'

// Sections de nav repliées — réglage d'appareil persistant (localStorage).
const NAV_KEY = 'neuroboost-nav-collapsed'
function getCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(NAV_KEY) || '{}')
  } catch {
    return {}
  }
}

export default function App(): JSX.Element {
  const [onglet, setOnglet] = useState<Onglet>('accueil')
  const [profil, setProfil] = useState<ProfilDTO | null>(null)
  const [rituel, setRituel] = useState<Phase | null>(null)
  const [sidebarOuvert, setSidebarOuvert] = useState(false)
  // État replié des groupes de navigation, restauré au démarrage
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(getCollapsed)

  useEffect(() => {
    window.api.getProfil().then(setProfil)
    // Mode Réveil/Coucher : propose le rituel hors-écran aux bonnes heures (1×/jour)
    const c = getRituelConfig()
    if (c.actif) {
      const p = phaseActuelle(c)
      if (p && !rituelFaitAujourdhui(p)) setRituel(p)
    }
  }, [])

  function ouvrirRituel(): void {
    const p = phaseActuelle(getRituelConfig()) ?? (new Date().getHours() < 14 ? 'reveil' : 'coucher')
    setRituel(p)
  }

  // Rafraîchit le profil de la sidebar après chaque changement d'onglet
  useEffect(() => {
    window.api.getProfil().then(setProfil)
  }, [onglet])

  function toggleGroupe(id: string): void {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      localStorage.setItem(NAV_KEY, JSON.stringify(next))
      return next
    })
  }

  function nav(id: Onglet, icon: IconName, label: string): JSX.Element {
    return (
      <button className={`nav-item${onglet === id ? ' active' : ''}`} onClick={() => { setOnglet(id); setSidebarOuvert(false) }}>
        <span className="nav-icon"><Icon name={icon} /></span>
        {label}
      </button>
    )
  }

  // En-tête de groupe repliable : clic = ouvrir/fermer, persisté.
  function groupe(id: string, label: string, contenu: JSX.Element): JSX.Element {
    const replie = !!collapsed[id]
    return (
      <>
        <button
          className={`nav-group-header${replie ? ' collapsed' : ''}`}
          onClick={() => toggleGroupe(id)}
          aria-expanded={!replie}
        >
          <span>{label}</span>
          <span className="nav-group-chevron">▼</span>
        </button>
        {!replie && contenu}
      </>
    )
  }

  const xpPct = profil ? Math.round((profil.xp / profil.xpProchainNiveau) * 100) : 0

  return (
    <div className="app">
      {rituel && (
        <RituelEcran
          phase={rituel}
          onFermer={() => { marquerRituelFait(rituel); setRituel(null) }}
          onPointsChange={() => window.api.getProfil().then(setProfil)}
        />
      )}

      {/* ── Barre supérieure mobile (bouton menu) ── */}
      <header className="mobile-topbar">
        <button className="hamburger" aria-label="Ouvrir le menu" onClick={() => setSidebarOuvert(true)}>☰</button>
        <span className="mobile-topbar-title">NeuroBoost</span>
      </header>

      {/* Voile derrière le tiroir (mobile) */}
      {sidebarOuvert && <div className="sidebar-backdrop" onClick={() => setSidebarOuvert(false)} />}

      {/* ── Sidebar ── */}
      <nav className={`sidebar${sidebarOuvert ? ' open' : ''}`}>
        <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/logo-mark.png"
            alt="NeuroBoost"
            style={{ height: 36, width: 36, borderRadius: 9, boxShadow: '0 2px 8px rgba(0,0,0,.35)' }}
          />
          <span>NeuroBoost</span>
        </div>

        {/* Profil */}
        {profil && (
          <>
            <div className="sidebar-profil" onClick={() => setOnglet('recompenses')}>
              <div className="sidebar-avatar">{profil.avatarEmoji}</div>
              <div className="sidebar-profil-info">
                <div className="sidebar-pseudo">{profil.pseudo}</div>
                <div className="sidebar-niveau">Niveau {profil.niveau}</div>
              </div>
            </div>
            <div className="xp-bar-wrap">
              <div className="xp-bar-bg">
                <div className="xp-bar-fill" style={{ width: `${xpPct}%` }} />
              </div>
              <div className="xp-bar-label">{profil.xp} / {profil.xpProchainNiveau} XP</div>
            </div>
            <div className="coins-badge">
              <Icon name="coins" size={15} /> {profil.neurocoins} NeuroCoins
            </div>
          </>
        )}

        {/* Navigation — groupes repliables (état mémorisé) */}
        {groupe('jour', 'Mon jour', (
          <>
            {nav('accueil', 'accueil', 'Accueil')}
            {nav('agenda', 'agenda', 'Agenda')}
            {nav('rendezvous', 'rendezvous', 'Créneaux sacrés')}
          </>
        ))}

        {groupe('action', "Passer à l'action", (
          <>
            {nav('quetes', 'quetes', 'Toutes mes quêtes')}
            {nav('tunnel', 'tunnel', 'Le Tunnel')}
            {nav('timer', 'timer', 'Timer')}
            {nav('captures', 'captures', 'Cerveau rapide')}
          </>
        ))}

        {groupe('duree', 'Tenir dans la durée', (
          <>
            {nav('recompenses', 'recompenses', 'Récompenses')}
            <button className="nav-item" onClick={() => { ouvrirRituel(); setSidebarOuvert(false) }}>
              <span className="nav-icon"><Icon name="rituel" /></span>
              Routines
            </button>
            {nav('coaching', 'coaching', 'Coaching')}
          </>
        ))}

        <div style={{ flex: 1 }} />
        {nav('reglages', 'reglages', 'Réglages')}
      </nav>

      {/* ── Contenu ── */}
      <main className="main-content">
        {onglet === 'accueil' && <AccueilScreen />}
        {onglet === 'quetes' && <QuestesScreen />}
        {onglet === 'agenda' && <AgendaScreen />}
        {onglet === 'tunnel' && <TunnelScreen />}
        {onglet === 'captures' && <CapturesScreen />}
        {onglet === 'coaching' && <CoachingScreen />}
        {onglet === 'timer' && <TimerScreen />}
        {onglet === 'rendezvous' && <RendezVousScreen />}
        {onglet === 'recompenses' && <RecompensesScreen />}
        {onglet === 'reglages' && <ReglagesScreen />}
      </main>
    </div>
  )
}
