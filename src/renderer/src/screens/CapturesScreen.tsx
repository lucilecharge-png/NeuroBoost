import { useState, useEffect, useCallback } from 'react'
import type { CaptureDTO, TacheDTO, NiveauEnergie } from '../../../shared/types'

const NIVEAUX: { key: NiveauEnergie; label: string }[] = [
  { key: 'micro', label: '⚡ Micro < 5 min' },
  { key: 'faible', label: '✨ Légère 5-15 min' },
  { key: 'moyenne', label: '🔥 Moyenne 15-45 min' },
  { key: 'haute', label: '💪 Haute 45+ min' }
]

export default function CapturesScreen(): JSX.Element {
  const [captures, setCaptures] = useState<CaptureDTO[]>([])
  const [texte, setTexte] = useState('')
  const [transformant, setTransformant] = useState<number | null>(null)
  const [form, setForm] = useState<{ titre: string; energie: NiveauEnergie; duree: number }>({ titre: '', energie: 'faible', duree: 10 })
  const [cree, setCree] = useState<TacheDTO | null>(null)

  const charger = useCallback(async () => {
    const c = await window.api.listCaptures()
    setCaptures(c)
  }, [])

  useEffect(() => { charger() }, [charger])

  async function ajouter() {
    if (!texte.trim()) return
    const c = await window.api.addCapture(texte.trim())
    setTexte('')
    setCaptures((prev) => [c, ...prev])
  }

  async function supprimer(id: number) {
    await window.api.deleteCapture(id)
    setCaptures((prev) => prev.filter((c) => c.id !== id))
  }

  async function transformer(c: CaptureDTO) {
    const tache = await window.api.transformerCapture(c.id, {
      titre: form.titre.trim() || c.texte,
      niveauEnergie: form.energie,
      dureeEstimeeMin: form.duree
    })
    setCree(tache)
    setTransformant(null)
    setForm({ titre: '', energie: 'faible', duree: 10 })
    setCaptures((prev) => prev.filter((x) => x.id !== c.id))
  }

  return (
    <div className="screen">
      <div className="screen-title">💡 Cerveau Rapide</div>
      <div className="screen-subtitle">Vide ta tête ici. Pas de jugement, pas d'ordre. Juste noter.</div>

      {/* Flash confirmation */}
      {cree && (
        <div style={{ padding: '10px 16px', borderRadius: 'var(--radius)', background: 'rgba(16,185,129,.15)', border: '1px solid rgba(16,185,129,.4)', color: 'var(--green)', fontWeight: 700, marginBottom: 16 }}>
          ✓ Tâche créée : "{cree.titre}"
          <button style={{ marginLeft: 12, fontSize: 12, background: 'none', color: 'var(--green)', fontWeight: 700, cursor: 'pointer' }} onClick={() => setCree(null)}>✕</button>
        </div>
      )}

      {/* Input principal */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 15 }}>
          Qu'est-ce qui tourne dans ta tête là ?
        </div>
        <div className="row">
          <textarea
            className="textarea"
            placeholder="Une idée, une tâche oubliée, un truc à ne pas perdre..."
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            style={{ minHeight: 60 }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ajouter() } }}
          />
        </div>
        <button className="btn-launch" style={{ marginTop: 10 }} onClick={ajouter} disabled={!texte.trim()}>
          ↵ Capturer
        </button>
        <div className="text-muted" style={{ marginTop: 6 }}>Entrée pour valider rapidement</div>
      </div>

      {/* Liste des captures */}
      {captures.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧠</div>
          <div>Ta tête est vide — c'est parfait !</div>
        </div>
      ) : (
        <>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>{captures.length} idée{captures.length !== 1 ? 's' : ''} en attente</div>
          <div className="col">
            {captures.map((c) => (
              <div key={c.id}>
                <div style={{ display: 'flex', gap: 10, padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, lineHeight: 1.5 }}>{c.texte}</div>
                    <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {new Date(c.creeLe).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 12, padding: '5px 10px' }}
                      onClick={() => { setTransformant(c.id); setForm((f) => ({ ...f, titre: c.texte })) }}
                    >
                      → Quête
                    </button>
                    <button className="btn-icon" onClick={() => supprimer(c.id)}>🗑</button>
                  </div>
                </div>

                {/* Formulaire de transformation inline */}
                {transformant === c.id && (
                  <div style={{ padding: '14px 16px', background: 'rgba(124,58,237,.08)', border: '2px solid var(--accent)', borderRadius: '0 0 var(--radius) var(--radius)', marginTop: -1 }}>
                    <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--accent-glow)' }}>Transformer en quête</div>
                    <div className="col">
                      <input
                        className="input"
                        placeholder="Titre de la quête..."
                        value={form.titre}
                        onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
                      />
                      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        {NIVEAUX.map((n) => (
                          <button
                            key={n.key}
                            style={{ padding: '6px 10px', borderRadius: 'var(--radius)', border: `2px solid ${form.energie === n.key ? 'var(--accent)' : 'var(--border)'}`, background: form.energie === n.key ? 'rgba(124,58,237,.2)' : 'var(--bg-panel)', color: form.energie === n.key ? 'var(--accent-glow)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                            onClick={() => setForm((f) => ({ ...f, energie: n.key }))}
                          >
                            {n.label}
                          </button>
                        ))}
                      </div>
                      <div className="row" style={{ gap: 8 }}>
                        <button className="btn-primary" onClick={() => transformer(c)}>✓ Créer la quête</button>
                        <button className="btn-ghost" onClick={() => setTransformant(null)}>Annuler</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
