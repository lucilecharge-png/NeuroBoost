import { useState } from 'react'
import type { TacheDTO } from '../../../shared/types'

// Panneau « Découper une quête en mini-tâches ». Partagé entre Le Tunnel et
// l'écran Quêtes. Flux : choix du nombre → l'IA propose des titres → on édite
// la liste → on crée les sous-tâches. Repli gracieux (champs vides) si l'IA
// échoue. Quand les sous-tâches sont créées, le parent se masque tout seul
// (listTaches) puis se termine quand la dernière est faite (terminerTache).
export default function DecoupeQuete({
  tache,
  onTermine,
  onAnnuler
}: {
  tache: TacheDTO
  onTermine: () => void
  onAnnuler: () => void
}): JSX.Element {
  const [nombre, setNombre] = useState(3)
  const [phase, setPhase] = useState<'idle' | 'chargement' | 'edition'>('idle')
  const [propositions, setPropositions] = useState<string[]>([])

  async function proposer(): Promise<void> {
    setPhase('chargement')
    try {
      const st = await window.api.decouperTache(
        { titre: tache.titre, description: tache.description, pourquoi: tache.pourquoi, categorie: tache.categorie },
        nombre
      )
      setPropositions(st.length > 0 ? st.map((s) => s.titre) : Array(nombre).fill(''))
    } catch {
      // Repli gracieux : champs vides à remplir à la main
      setPropositions(Array(nombre).fill(''))
    }
    setPhase('edition')
  }

  async function creerLesSousTaches(): Promise<void> {
    const titres = propositions.map((p) => p.trim()).filter(Boolean)
    if (titres.length === 0) return
    await window.api.creerSousTaches(tache.id, titres.map((titre) => ({ titre })))
    onTermine()
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      {phase === 'idle' && (
        <div className="col" style={{ gap: 12 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            En combien de mini-tâches découper « {tache.titre} » ?
          </div>
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <button className="btn-ghost" onClick={() => setNombre((n) => Math.max(2, n - 1))}>−</button>
            <div style={{ fontSize: 20, fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{nombre}</div>
            <button className="btn-ghost" onClick={() => setNombre((n) => Math.min(6, n + 1))}>+</button>
            <button className="btn-launch" style={{ flex: 1 }} onClick={proposer}>
              ✨ Proposer
            </button>
            <button className="btn-ghost" onClick={onAnnuler}>Annuler</button>
          </div>
        </div>
      )}

      {phase === 'chargement' && (
        <div style={{ fontSize: 14, color: 'var(--text-muted)', padding: '8px 0' }}>
          ✨ Je réfléchis à des mini-tâches…
        </div>
      )}

      {phase === 'edition' && (
        <div className="col" style={{ gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Modifie, ajoute ou supprime les mini-tâches, puis crée-les :
          </div>
          {propositions.map((p, i) => (
            <div key={i} className="row" style={{ gap: 6 }}>
              <input
                value={p}
                placeholder={`Mini-tâche ${i + 1}`}
                onChange={(e) => setPropositions((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-panel)', color: 'var(--text)' }}
              />
              <button className="btn-ghost" onClick={() => setPropositions((prev) => prev.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <div className="row" style={{ gap: 10, marginTop: 6 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setPropositions((prev) => [...prev, ''])}>
              ＋ Ajouter
            </button>
            <button className="btn-launch" style={{ flex: 2 }} onClick={creerLesSousTaches}>
              ✓ Créer les mini-tâches
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
