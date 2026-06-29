import { useState, type CSSProperties } from 'react'
import {
  getRituelTaches,
  setRituelTaches,
  getNoteJour,
  setNoteJour,
  getRituelFaites,
  setRituelFaites,
  dejaRecompensee,
  marquerRecompensee,
  type Phase,
  type TypeNote
} from '../data/rituels'
import Respiration, { type RespirationConfig } from './Respiration'

// Respiration énergisante le matin (cycles rapides), apaisante le soir (5 cycles lents).
const RESPIRATION: Record<Phase, RespirationConfig> = {
  reveil: {
    titre: '8 respirations énergisantes',
    cycles: 8,
    phases: [
      { label: 'Inspire', ms: 1500, scale: 1.45 },
      { label: 'Expire', ms: 1500, scale: 0.7 }
    ],
    gradient: 'radial-gradient(circle at 38% 32%, #ffd27a, #e07b39)',
    accent: '#f5b14e'
  },
  coucher: {
    titre: '5 respirations lentes',
    cycles: 5,
    phases: [
      { label: 'Inspire', ms: 4000, scale: 1.5 },
      { label: 'Retiens', ms: 2000, scale: 1.5 },
      { label: 'Expire', ms: 6000, scale: 0.65 }
    ],
    gradient: 'radial-gradient(circle at 38% 32%, #b3a6f0, #4b3f8f)',
    accent: '#a99cf0'
  }
}

interface Props {
  phase: Phase
  onFermer: () => void
  // Appelé après un gain de points pour rafraîchir le profil affiché ailleurs (nav).
  onPointsChange?: () => void
}

interface NoteConfig {
  type: TypeNote
  emoji: string
  label: string
  placeholder: string
}

// Habillage de chaque routine (le contenu des tâches vit dans rituels.ts).
const CONTENU: Record<Phase, { emoji: string; nom: string; titre: string; sous: string; intro: string; note: NoteConfig }> = {
  reveil: {
    emoji: '🌅',
    nom: 'Routine matin',
    titre: 'Réveil en douceur',
    sous: "Avant l'écran, offre à ton cerveau un vrai départ.",
    intro:
      'Scroller dès le réveil noie ton cerveau sous la dopamine et la charge mentale. Quelques minutes hors écran changent toute la journée.',
    note: {
      type: 'intention',
      emoji: '✍️',
      label: "Ton intention pour aujourd'hui",
      placeholder: 'Une seule intention…'
    }
  },
  coucher: {
    emoji: '🌙',
    nom: 'Routine nuit',
    titre: 'Coucher apaisé',
    sous: 'Pose les écrans, laisse ton cerveau ralentir.',
    intro:
      "La lumière des écrans et le scroll infini retardent le sommeil et fragmentent ta récupération. Ton cerveau TDAH a besoin de cette transition.",
    note: {
      type: 'victoire',
      emoji: '🏆',
      label: 'Une victoire de ta journée',
      placeholder: 'Même une toute petite…'
    }
  }
}

const PHASES: Phase[] = ['reveil', 'coucher']

// Petits boutons carrés (monter / descendre / supprimer) du mode édition.
const btnReorg: CSSProperties = {
  flexShrink: 0,
  width: 26,
  height: 26,
  borderRadius: 8,
  border: '1px solid #3a4150',
  background: 'transparent',
  color: '#aab3c2',
  fontSize: 14,
  lineHeight: 1,
  cursor: 'pointer'
}

export default function RituelEcran({ phase, onFermer, onPointsChange }: Props): JSX.Element {
  const [coupe, setCoupe] = useState(false)
  // Routine affichée : on démarre sur la phase proposée, mais on peut basculer
  // entre matin et nuit pour consulter / modifier les deux.
  const [phaseActive, setPhaseActive] = useState<Phase>(phase)
  const [editer, setEditer] = useState(false)
  const [taches, setTaches] = useState<string[]>(() => getRituelTaches(phase))
  const [nouvelle, setNouvelle] = useState('')
  // Note du jour (intention le matin, victoire le soir) — partagée avec l'accueil.
  const [note, setNote] = useState<string>(() => getNoteJour(CONTENU[phase].note.type))
  const [respiration, setRespiration] = useState(false)
  // Tâches cochées « fait » du jour + petit retour de points éphémère.
  const [faites, setFaites] = useState<string[]>(() => getRituelFaites(phase))
  const [gain, setGain] = useState<string | null>(null)

  const c = CONTENU[phaseActive]
  const respi = RESPIRATION[phaseActive]

  function changerPhase(p: Phase): void {
    setPhaseActive(p)
    setTaches(getRituelTaches(p))
    setNote(getNoteJour(CONTENU[p].note.type))
    setFaites(getRituelFaites(p))
    setNouvelle('')
  }

  // Coche / décoche une tâche. Premier passage à « fait » du jour → gain de points.
  function basculerFait(t: string): void {
    const estFait = faites.includes(t)
    const suivant = estFait ? faites.filter((x) => x !== t) : [...faites, t]
    setFaites(suivant)
    setRituelFaites(phaseActive, suivant)
    if (!estFait && !dejaRecompensee(phaseActive, t)) {
      marquerRecompensee(phaseActive, t)
      window.api.gagnerRecompenseRituel().then((res) => {
        setGain(`+${res.xpGagne} XP · +${res.coinsGagnes} NeuroCoins`)
        window.setTimeout(() => setGain(null), 1600)
        onPointsChange?.()
      })
    }
  }

  function changerNote(valeur: string): void {
    setNote(valeur)
    setNoteJour(c.note.type, valeur)
  }

  function deplacer(index: number, dir: -1 | 1): void {
    const cible = index + dir
    if (cible < 0 || cible >= taches.length) return
    const copie = [...taches]
    ;[copie[index], copie[cible]] = [copie[cible], copie[index]]
    persister(copie)
  }

  function persister(liste: string[]): void {
    setTaches(liste)
    setRituelTaches(phaseActive, liste)
  }

  function ajouter(): void {
    const t = nouvelle.trim()
    if (!t) return
    persister([...taches, t])
    setNouvelle('')
  }

  function supprimer(index: number): void {
    persister(taches.filter((_, i) => i !== index))
  }

  // Animation de respiration : prend tout l'écran, revient à la routine à la fin.
  if (respiration) {
    return <Respiration config={RESPIRATION[phaseActive]} onFermer={() => setRespiration(false)} />
  }

  // Écran coupé : noir, presque rien — l'invitation à quitter l'écran.
  if (coupe) {
    return (
      <div
        className="focus-overlay"
        style={{ background: '#000', cursor: 'pointer' }}
        onClick={onFermer}
      >
        <div style={{ fontSize: 56, marginBottom: 12 }}>{phaseActive === 'reveil' ? '☀️' : '😴'}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#cbd5e1' }}>
          {phaseActive === 'reveil' ? 'Belle journée.' : 'Bonne nuit.'}
        </div>
        <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 24 }}>Touche l'écran pour revenir</div>
      </div>
    )
  }

  // Scène volontairement sombre et immersive : on fige les jetons sombres ici
  // pour qu'elle reste lisible même quand l'app est en thème clair.
  const sceneSombre = {
    '--text': '#e7eaef',
    '--text-muted': '#aab3c2',
    '--bg-card': '#161b23',
    '--border': '#2c3442',
    '--gold': '#bd9a5d',
    color: '#e7eaef',
    background:
      phaseActive === 'reveil'
        ? 'radial-gradient(ellipse at 50% 30%, rgb(48,36,12), rgb(3,11,20))'
        : 'radial-gradient(ellipse at 50% 30%, rgb(26,18,48), rgb(3,11,20))'
  } as CSSProperties

  return (
    <div className="focus-overlay" style={sceneSombre}>
      {gain && (
        <div
          style={{
            position: 'fixed',
            top: 'max(16px, env(safe-area-inset-top))',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(95,158,124,.96)',
            color: '#fff',
            padding: '8px 18px',
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 14,
            boxShadow: '0 6px 20px rgba(0,0,0,.35)',
            zIndex: 10
          }}
        >
          🎉 {gain}
        </div>
      )}

      {/* Sélecteur de routine : matin / nuit */}
      <div style={{ display: 'flex', gap: 8, padding: 4, background: 'rgba(255,255,255,.05)', borderRadius: 999 }}>
        {PHASES.map((p) => (
          <button
            key={p}
            onClick={() => changerPhase(p)}
            style={{
              padding: '7px 16px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: p === phaseActive ? 'rgba(255,255,255,.14)' : 'transparent',
              color: p === phaseActive ? '#f4f6fa' : '#aab3c2'
            }}
          >
            {CONTENU[p].emoji} {CONTENU[p].nom}
          </button>
        ))}
      </div>

      <div style={{ fontSize: 64, marginBottom: 4 }}>{c.emoji}</div>
      <div className="focus-titre" style={{ color: '#f4f6fa' }}>{c.titre}</div>
      <div style={{ textAlign: 'center', maxWidth: 420, marginBottom: 6, color: '#aab3c2' }}>{c.sous}</div>

      <div style={{ maxWidth: 440, textAlign: 'center', fontSize: 13, lineHeight: 1.7, color: '#aab3c2', marginBottom: 22, fontStyle: 'italic' }}>
        {c.intro}
      </div>

      {/* Intention (matin) / victoire (soir) — sauvegardée et affichée sur l'accueil */}
      <div style={{ width: '100%', maxWidth: 380, marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#f4f6fa', marginBottom: 6 }}>
          {c.note.emoji} {c.note.label}
        </label>
        <input
          value={note}
          onChange={(e) => changerNote(e.target.value)}
          placeholder={c.note.placeholder}
          style={{
            width: '100%',
            padding: '12px 14px',
            background: 'rgba(189,154,93,.10)',
            border: '1px solid var(--gold)',
            borderRadius: 'var(--radius)',
            color: '#f4f6fa',
            fontSize: 15
          }}
        />
        <div style={{ fontSize: 11, color: '#8893a3', marginTop: 5 }}>Ça apparaîtra sur ton accueil.</div>
      </div>

      {/* Exercice de respiration guidé — au clic, lance l'animation */}
      <button
        onClick={() => setRespiration(true)}
        style={{
          width: '100%',
          maxWidth: 380,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          textAlign: 'left',
          padding: '14px 18px',
          marginBottom: 16,
          background: `${respi.accent}1f`,
          border: `1px solid ${respi.accent}`,
          borderRadius: 'var(--radius)',
          color: '#f4f6fa',
          cursor: 'pointer'
        }}
      >
        <span style={{ fontSize: 26 }}>🌬️</span>
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 600 }}>{respi.titre}</span>
          <span style={{ display: 'block', fontSize: 12, color: '#aab3c2' }}>
            {phaseActive === 'reveil' ? 'Réveille ton corps en quelques cycles rapides' : 'Ralentis ton rythme avant le sommeil'}
          </span>
        </span>
        <span style={{ fontSize: 18, color: respi.accent }}>▶</span>
      </button>

      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {taches.map((t, i) => {
          const fait = faites.includes(t)
          return (
          <div
            key={`${t}-${i}`}
            onClick={() => { if (!editer) basculerFait(t) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 18px',
              background: fait ? 'rgba(95,158,124,.12)' : '#161b23',
              border: `1px solid ${fait ? 'rgba(95,158,124,.5)' : '#2c3442'}`,
              borderRadius: 'var(--radius)',
              fontSize: 15,
              color: '#e7eaef',
              cursor: editer ? 'default' : 'pointer'
            }}
          >
            {!editer && (
              <span
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: `2px solid ${fait ? '#5f9e7c' : '#3a4150'}`,
                  background: fait ? '#5f9e7c' : 'transparent',
                  color: '#fff',
                  fontSize: 13,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {fait ? '✓' : ''}
              </span>
            )}
            <span style={{ flex: 1, textAlign: 'left', opacity: fait && !editer ? 0.55 : 1, textDecoration: fait && !editer ? 'line-through' : 'none' }}>{t}</span>
            {editer && (
              <>
                <button
                  onClick={() => deplacer(i, -1)}
                  disabled={i === 0}
                  aria-label="Monter la tâche"
                  style={{ ...btnReorg, opacity: i === 0 ? 0.3 : 1 }}
                >
                  ↑
                </button>
                <button
                  onClick={() => deplacer(i, 1)}
                  disabled={i === taches.length - 1}
                  aria-label="Descendre la tâche"
                  style={{ ...btnReorg, opacity: i === taches.length - 1 ? 0.3 : 1 }}
                >
                  ↓
                </button>
                <button
                  onClick={() => supprimer(i)}
                  aria-label="Supprimer la tâche"
                  style={{ ...btnReorg, color: '#e98b86', fontSize: 16 }}
                >
                  ×
                </button>
              </>
            )}
          </div>
          )
        })}

        {editer && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={nouvelle}
              onChange={(e) => setNouvelle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') ajouter()
              }}
              placeholder="Ajouter une tâche…"
              style={{
                flex: 1,
                padding: '12px 14px',
                background: '#10151c',
                border: '1px solid #2c3442',
                borderRadius: 'var(--radius)',
                color: '#e7eaef',
                fontSize: 14
              }}
            />
            <button
              onClick={ajouter}
              disabled={!nouvelle.trim()}
              style={{
                flexShrink: 0,
                padding: '0 16px',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(135,164,210,.35)',
                background: '#43618f',
                color: '#eaf0f8',
                fontSize: 14,
                fontWeight: 600,
                cursor: nouvelle.trim() ? 'pointer' : 'default',
                opacity: nouvelle.trim() ? 1 : 0.5
              }}
            >
              Ajouter
            </button>
          </div>
        )}
      </div>

      <button
        onClick={() => setEditer((v) => !v)}
        style={{
          marginBottom: 8,
          background: 'transparent',
          border: 'none',
          color: '#aab3c2',
          fontSize: 13,
          textDecoration: 'underline',
          cursor: 'pointer'
        }}
      >
        {editer ? '✓ Terminer la modification' : '✏️ Modifier les tâches'}
      </button>

      <div style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn-launch" onClick={() => setCoupe(true)}>
          🌑 Couper l'écran
        </button>
        <button className="btn-ghost" onClick={onFermer}>
          Entrer dans l'app
        </button>
      </div>
    </div>
  )
}
