import { useState } from 'react'
import type { CategorieDTO } from '../../../../shared/types'

interface Props {
  categories: CategorieDTO[]
  valeur: number | null
  onChange: (id: number | null) => void
  onCreer: (nom: string, couleur: string) => Promise<void>
}

const COULEURS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6']

export default function CategoriePicker({ categories, valeur, onChange, onCreer }: Props): JSX.Element {
  const [creation, setCreation] = useState(false)
  const [nom, setNom] = useState('')
  const [couleur, setCouleur] = useState(COULEURS[0])

  async function creer(): Promise<void> {
    if (!nom.trim()) return
    await onCreer(nom.trim(), couleur)
    setNom(''); setCreation(false)
  }

  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`cat-chip${valeur === c.id ? ' active' : ''}`}
            style={{ borderColor: c.couleur, background: valeur === c.id ? c.couleur : 'transparent' }}
            onClick={() => onChange(valeur === c.id ? null : c.id)}
          >
            {c.emoji} {c.nom}
          </button>
        ))}
        <button type="button" className="cat-chip" onClick={() => setCreation((v) => !v)}>＋ créer</button>
      </div>
      {creation && (
        <div className="row" style={{ gap: 6 }}>
          <input className="input" placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} />
          {COULEURS.map((col) => (
            <button key={col} type="button" onClick={() => setCouleur(col)}
              style={{ width: 22, height: 22, borderRadius: 6, background: col, border: couleur === col ? '2px solid #fff' : 'none' }} />
          ))}
          <button type="button" className="btn-launch" onClick={creer}>OK</button>
        </div>
      )}
    </div>
  )
}
