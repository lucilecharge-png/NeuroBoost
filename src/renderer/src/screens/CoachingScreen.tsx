import { useState, useEffect, useCallback } from 'react'
import type { VictoireDTO, MatriceItemDTO, ReveDTO, CapsuleDTO, BilanReponseDTO } from '../../../shared/types'

type Outil = 'affirmation' | 'victoires' | 'matrice' | 'reves' | 'capsule' | 'bilan'

const ONGLETS: { key: Outil; icon: string; label: string }[] = [
  { key: 'affirmation', icon: '🌅', label: 'Affirmation' },
  { key: 'victoires', icon: '🏆', label: 'Victoires' },
  { key: 'matrice', icon: '🧘', label: 'Matrice' },
  { key: 'reves', icon: '💭', label: 'Rêves' },
  { key: 'capsule', icon: '📬', label: 'Capsule' },
  { key: 'bilan', icon: '📊', label: 'Bilan de vie' }
]

const BILAN_QUESTIONS = [
  { id: 1, q: 'Si tu ne changeais rien pendant 3 ans, te rapprocherais-tu de ton objectif ?', tip: 'L\'inertie est silencieuse. Ce que tu fais (ou ne fais pas) aujourd\'hui se cumule.' },
  { id: 2, q: 'Si un étranger t\'observait toute une semaine, quelles seraient tes vraies priorités selon lui ?', tip: 'Ce que tu fais parle plus fort que ce que tu dis. Le décalage est souvent révélateur.' },
  { id: 3, q: 'Quel est le plus gros mensonge que tu te racontes pour ne pas avancer ?', tip: '"Je n\'ai pas le temps" = "Ce n\'est pas ma priorité". Quelle est la vraie raison ?' },
  { id: 4, q: 'Est-ce que ton toi de 10 ans serait fier ou déçu de qui tu es aujourd\'hui ?', tip: 'L\'enfant en toi avait des rêves sans barrières. Il peut être une boussole précieuse.' },
  { id: 5, q: 'Quelle est la SEULE chose sur laquelle tu procrastines et qui changerait tout ?', tip: 'C\'est souvent la chose que tu évites le plus. Elle mérite ta tâche pivot de la semaine.' },
  { id: 6, q: 'Es-tu assez régulier pour obtenir les résultats que tu veux ?', tip: '10 minutes chaque jour bat 3 heures une fois par semaine. La régularité crée des résultats exponentiels.' },
  { id: 7, q: 'Si tu savais que tu ne pouvais pas échouer, qu\'est-ce que tu lancerais maintenant ?', tip: 'La peur de l\'échec déguisée en "je ne suis pas prêt" est la cause n°1 d\'inaction.' },
  { id: 8, q: 'Ton entourage actuel te tire-t-il vers le haut ou vers le bas ?', tip: 'Tu es la moyenne des 5 personnes que tu fréquentes. Protège ton énergie.' },
  { id: 9, q: 'Si quelqu\'un avait exactement ta vie et tes habitudes, parierais-tu de l\'argent sur son succès ?', tip: 'Sois honnête. Sinon, qu\'est-ce qui doit changer dans les prochaines 72 heures ?' },
  { id: 10, q: 'Ton toi de 80 ans te remerciera-t-il pour les décisions que tu prends aujourd\'hui ?', tip: 'Le regret de ce qu\'on n\'a pas fait est toujours plus douloureux que celui de ce qu\'on a tenté.' }
]

export default function CoachingScreen(): JSX.Element {
  const [outil, setOutil] = useState<Outil>('affirmation')

  return (
    <div className="screen">
      <div className="screen-title">🧠 Coaching Mental</div>
      <div className="screen-subtitle">Outils pour aller plus loin que les tâches</div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 24 }}>
        {ONGLETS.map((o) => (
          <button
            key={o.key}
            onClick={() => setOutil(o.key)}
            style={{
              padding: '7px 14px',
              borderRadius: 'var(--radius)',
              border: `2px solid ${outil === o.key ? 'var(--accent)' : 'var(--border)'}`,
              background: outil === o.key ? 'rgba(124,58,237,.2)' : 'var(--bg-card)',
              color: outil === o.key ? 'var(--accent-glow)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13
            }}
          >
            {o.icon} {o.label}
          </button>
        ))}
      </div>

      {outil === 'affirmation' && <AffirmationPanel />}
      {outil === 'victoires' && <VictoiresPanel />}
      {outil === 'matrice' && <MatricePanel />}
      {outil === 'reves' && <RevesPanel />}
      {outil === 'capsule' && <CapsulePanel />}
      {outil === 'bilan' && <BilanPanel />}
    </div>
  )
}

// ─── Affirmation du matin ─────────────────────────────────────────────────────

function AffirmationPanel(): JSX.Element {
  const [texte, setTexte] = useState('')
  const [sauvegarde, setSauvegarde] = useState(false)

  useEffect(() => {
    window.api.getAffirmation().then((t) => { if (t) { setTexte(t); setSauvegarde(true) } })
  }, [])

  async function sauvegarder() {
    if (!texte.trim()) return
    await window.api.setAffirmation(texte.trim())
    setSauvegarde(true)
  }

  return (
    <div className="col">
      <div className="card card-glow">
        <div style={{ fontSize: 32, marginBottom: 8 }}>🌅</div>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Intention du jour</div>
        <div className="text-muted" style={{ marginBottom: 16 }}>
          Quelle phrase positive tu veux porter aujourd'hui ? Formule-la comme si c'était déjà vrai.
        </div>
        <textarea
          className="textarea"
          style={{ minHeight: 100, fontSize: 16 }}
          placeholder='Ex : "Je suis capable de commencer, même imparfaitement. Chaque pas compte."'
          value={texte}
          onChange={(e) => { setTexte(e.target.value); setSauvegarde(false) }}
        />
        <button className="btn-launch" style={{ marginTop: 10 }} onClick={sauvegarder} disabled={!texte.trim()}>
          {sauvegarde ? '✓ Affirmation enregistrée' : '💾 Ancrer cette intention'}
        </button>
      </div>
      <div className="card" style={{ background: 'rgba(124,58,237,.08)', border: '1px solid rgba(124,58,237,.3)' }}>
        <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--accent-glow)' }}>💡 Loi de la puissance intérieure</div>
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          Ce que tu mets dans ton esprit se reflète dans tes actions. Un discours intérieur négatif ("je n'y arriverai jamais") est une prophétie auto-réalisatrice. Remplace-le par une affirmation concrète et répète-la jusqu'à ce qu'elle devienne ta nouvelle réalité.
        </div>
      </div>
    </div>
  )
}

// ─── Journal des Victoires ────────────────────────────────────────────────────

function VictoiresPanel(): JSX.Element {
  const [victoires, setVictoires] = useState<VictoireDTO[]>([])
  const [texte, setTexte] = useState('')

  const charger = useCallback(async () => {
    setVictoires(await window.api.listVictoires())
  }, [])

  useEffect(() => { charger() }, [charger])

  async function ajouter() {
    if (!texte.trim()) return
    const v = await window.api.addVictoire(texte.trim())
    setVictoires((p) => [v, ...p])
    setTexte('')
  }

  async function supprimer(id: number) {
    await window.api.deleteVictoire(id)
    setVictoires((p) => p.filter((v) => v.id !== id))
  }

  return (
    <div className="col">
      <div className="card card-glow">
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Victoires du jour</div>
        <div className="text-muted" style={{ marginBottom: 12 }}>
          Note au moins une victoire — même minuscule. Tu t'es levé ? C'est une victoire.
        </div>
        <div className="row">
          <input
            className="input"
            placeholder="Ma victoire du jour..."
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') ajouter() }}
          />
          <button className="btn-primary" onClick={ajouter} disabled={!texte.trim()}>+</button>
        </div>
      </div>

      {victoires.length === 0 ? (
        <div className="empty-state">Pas encore de victoire aujourd'hui.<br />La première est toujours la plus difficile à noter.</div>
      ) : (
        <div className="col">
          {victoires.map((v) => (
            <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 'var(--radius)' }}>
              <span style={{ fontSize: 20 }}>✨</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{v.texte}</span>
              <button className="btn-icon" onClick={() => supprimer(v.id)}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ background: 'rgba(16,185,129,.06)', border: '1px solid rgba(16,185,129,.2)' }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--green)' }}>💡 Loi de la gratitude</div>
        <div className="text-muted" style={{ fontSize: 13 }}>Célébrer de petites victoires reprogramme le cerveau à voir les opportunités plutôt que les obstacles. Même les cerveaux TDAH répondent au renforcement positif.</div>
      </div>
    </div>
  )
}

// ─── Matrice de contrôle ──────────────────────────────────────────────────────

function MatricePanel(): JSX.Element {
  const [items, setItems] = useState<MatriceItemDTO[]>([])
  const [texte, setTexte] = useState('')
  const [type, setType] = useState<'controle' | 'non_controle'>('controle')
  const [masquerNonControle, setMasquerNonControle] = useState(false)

  useEffect(() => { window.api.getMatrice().then(setItems) }, [])

  async function ajouter() {
    if (!texte.trim()) return
    const item = await window.api.addMatriceItem(texte.trim(), type)
    setItems((p) => [...p, item])
    setTexte('')
  }

  async function supprimer(id: number) {
    await window.api.deleteMatriceItem(id)
    setItems((p) => p.filter((i) => i.id !== id))
  }

  const controle = items.filter((i) => i.type === 'controle')
  const nonControle = items.filter((i) => i.type === 'non_controle')

  return (
    <div className="col">
      <div className="card card-glow">
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>🧘 Matrice de contrôle</div>
        <div className="text-muted" style={{ marginBottom: 16 }}>Dépose ici tes sources de stress. Trie-les. Masque ce que tu ne peux pas contrôler.</div>
        <div className="row" style={{ gap: 8, marginBottom: 10 }}>
          <button
            onClick={() => setType('controle')}
            style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius)', border: `2px solid ${type === 'controle' ? 'var(--green)' : 'var(--border)'}`, background: type === 'controle' ? 'rgba(16,185,129,.15)' : 'var(--bg-panel)', color: type === 'controle' ? 'var(--green)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 700 }}
          >✅ Je contrôle</button>
          <button
            onClick={() => setType('non_controle')}
            style={{ flex: 1, padding: '8px', borderRadius: 'var(--radius)', border: `2px solid ${type === 'non_controle' ? 'var(--danger)' : 'var(--border)'}`, background: type === 'non_controle' ? 'rgba(239,68,68,.15)' : 'var(--bg-panel)', color: type === 'non_controle' ? 'var(--danger)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 700 }}
          >❌ Hors de ma portée</button>
        </div>
        <div className="row">
          <input className="input" placeholder="Source de stress..." value={texte} onChange={(e) => setTexte(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') ajouter() }} />
          <button className="btn-primary" onClick={ajouter} disabled={!texte.trim()}>+</button>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="col">
          <div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>✅ Je contrôle ({controle.length})</div>
          {controle.map((i) => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', borderRadius: 'var(--radius)' }}>
              <span style={{ flex: 1, fontSize: 13 }}>{i.texte}</span>
              <button className="btn-icon" style={{ width: 24, height: 24, fontSize: 11 }} onClick={() => supprimer(i.id)}>✕</button>
            </div>
          ))}
        </div>
        <div className="col">
          <div className="row-between" style={{ marginBottom: 6 }}>
            <div style={{ fontWeight: 700, color: 'var(--danger)' }}>❌ Hors de ma portée ({nonControle.length})</div>
            <button className="btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setMasquerNonControle((m) => !m)}>
              {masquerNonControle ? '👁 Voir' : '🙈 Masquer'}
            </button>
          </div>
          {!masquerNonControle && nonControle.map((i) => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 'var(--radius)' }}>
              <span style={{ flex: 1, fontSize: 13 }}>{i.texte}</span>
              <button className="btn-icon" style={{ width: 24, height: 24, fontSize: 11 }} onClick={() => supprimer(i.id)}>✕</button>
            </div>
          ))}
          {masquerNonControle && <div className="text-muted" style={{ fontSize: 13, fontStyle: 'italic', padding: '12px 0' }}>Ces éléments sont masqués — concentre-toi sur ce que tu contrôles. 🧘</div>}
        </div>
      </div>
    </div>
  )
}

// ─── Sandbox des Rêves ────────────────────────────────────────────────────────

function RevesPanel(): JSX.Element {
  const [reves, setReves] = useState<ReveDTO[]>([])
  const [texte, setTexte] = useState('')
  const [extrayant, setExtrayant] = useState<number | null>(null)
  const [action, setAction] = useState('')

  useEffect(() => { window.api.listReves().then(setReves) }, [])

  async function ajouter() {
    if (!texte.trim()) return
    const r = await window.api.addReve(texte.trim())
    setReves((p) => [r, ...p])
    setTexte('')
  }

  async function extraire(id: number) {
    if (!action.trim()) return
    await window.api.extraireAction(id, action.trim())
    setReves((p) => p.map((r) => r.id === id ? { ...r, actionExtraite: action.trim() } : r))
    setExtrayant(null)
    setAction('')
  }

  async function supprimer(id: number) {
    await window.api.deleteReve(id)
    setReves((p) => p.filter((r) => r.id !== id))
  }

  return (
    <div className="col">
      <div className="card card-glow">
        <div style={{ fontSize: 32, marginBottom: 8 }}>💭</div>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Sandbox des Rêves</div>
        <div className="text-muted" style={{ marginBottom: 12 }}>
          Ici, zéro jugement. Note tes projets les plus fous, même irréalistes. Ensuite, extrait-en une micro-action.
        </div>
        <div className="row">
          <input className="input" placeholder="Si je ne pouvais pas échouer, je lancerais..." value={texte} onChange={(e) => setTexte(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') ajouter() }} />
          <button className="btn-primary" onClick={ajouter} disabled={!texte.trim()}>+</button>
        </div>
      </div>

      <div className="col">
        {reves.map((r) => (
          <div key={r.id}>
            <div style={{ padding: '14px 16px', background: 'var(--bg-card)', border: `1px solid ${r.actionExtraite ? 'rgba(16,185,129,.3)' : 'var(--border)'}`, borderRadius: 'var(--radius)' }}>
              <div className="row-between">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: r.actionExtraite ? 6 : 0 }}>{r.texte}</div>
                  {r.actionExtraite && <div style={{ fontSize: 12, color: 'var(--green)' }}>→ Action : {r.actionExtraite}</div>}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {!r.actionExtraite && (
                    <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => { setExtrayant(r.id); setAction('') }}>
                      ⚡ Extraire
                    </button>
                  )}
                  <button className="btn-icon" onClick={() => supprimer(r.id)}>🗑</button>
                </div>
              </div>
            </div>
            {extrayant === r.id && (
              <div style={{ padding: '12px 14px', background: 'rgba(124,58,237,.08)', border: '2px solid var(--accent)', borderRadius: '0 0 var(--radius) var(--radius)', marginTop: -1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-glow)', marginBottom: 8 }}>Quelle est la PREMIÈRE micro-action réaliste ?</div>
                <div className="row">
                  <input className="input" placeholder="Ex: Passer 15 min à rechercher comment..." value={action} onChange={(e) => setAction(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') extraire(r.id) }} />
                  <button className="btn-primary" onClick={() => extraire(r.id)} disabled={!action.trim()}>→ Créer</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {reves.length === 0 && <div className="empty-state">Aucun rêve pour l'instant.<br />Ose écrire le projet impossible.</div>}
      </div>
    </div>
  )
}

// ─── Capsule Temporelle ───────────────────────────────────────────────────────

function CapsulePanel(): JSX.Element {
  const [capsules, setCapsules] = useState<CapsuleDTO[]>([])
  const [message, setMessage] = useState('')
  const [date, setDate] = useState('')

  const today = () => new Date().toISOString().slice(0, 10)

  useEffect(() => {
    window.api.listCapsules().then(setCapsules)
    const d = new Date(); d.setMonth(d.getMonth() + 3)
    setDate(d.toISOString().slice(0, 10))
  }, [])

  async function creer() {
    if (!message.trim() || !date) return
    const c = await window.api.createCapsule(message.trim(), date)
    setCapsules((p) => [...p, c])
    setMessage('')
  }

  async function ouvrir(id: number) {
    const c = await window.api.ouvrirCapsule(id)
    setCapsules((p) => p.map((x) => x.id === id ? c : x))
  }

  const disponibles = capsules.filter((c) => !c.ouvert && c.dateOuverture <= today())
  const fermees = capsules.filter((c) => !c.ouvert && c.dateOuverture > today())
  const ouvertes = capsules.filter((c) => c.ouvert)

  return (
    <div className="col">
      <div className="card card-glow">
        <div style={{ fontSize: 32, marginBottom: 8 }}>📬</div>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Capsule Temporelle</div>
        <div className="text-muted" style={{ marginBottom: 12 }}>Écris un message à ton futur toi. Il se déverrouillera à la date choisie.</div>
        <textarea className="textarea" style={{ minHeight: 80 }} placeholder="Cher moi du futur, aujourd'hui je décide de... Dans 3 mois, j'espère que tu..." value={message} onChange={(e) => setMessage(e.target.value)} />
        <div className="row" style={{ marginTop: 10, gap: 10 }}>
          <input type="date" className="input" value={date} min={today()} onChange={(e) => setDate(e.target.value)} />
          <button className="btn-primary" onClick={creer} disabled={!message.trim() || !date}>Envoyer 📮</button>
        </div>
      </div>

      {disponibles.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>📬 Capsules à ouvrir !</div>
          {disponibles.map((c) => (
            <div key={c.id} style={{ padding: '16px', background: 'rgba(245,158,11,.1)', border: '2px solid var(--gold)', borderRadius: 'var(--radius)' }}>
              <div className="text-muted" style={{ fontSize: 11, marginBottom: 8 }}>Envoyée le {new Date(c.creeLe).toLocaleDateString('fr-FR')}</div>
              <button className="btn-gold" onClick={() => ouvrir(c.id)}>🔓 Ouvrir ma capsule</button>
            </div>
          ))}
        </div>
      )}

      {ouvertes.map((c) => (
        <div key={c.id} style={{ padding: '16px', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 'var(--radius)' }}>
          <div className="text-muted" style={{ fontSize: 11, marginBottom: 6 }}>📬 Capsule ouverte — {new Date(c.creeLe).toLocaleDateString('fr-FR')} → {new Date(c.dateOuverture).toLocaleDateString('fr-FR')}</div>
          <div style={{ fontStyle: 'italic', lineHeight: 1.7, fontSize: 14 }}>{c.message}</div>
        </div>
      ))}

      {fermees.map((c) => (
        <div key={c.id} style={{ padding: '14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', opacity: .6 }}>
          <div className="row-between">
            <div className="text-muted" style={{ fontSize: 13 }}>📮 Capsule scellée</div>
            <div className="text-muted" style={{ fontSize: 12 }}>Ouvre le {new Date(c.dateOuverture).toLocaleDateString('fr-FR')}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Bilan de vie (10 questions) ──────────────────────────────────────────────

function BilanPanel(): JSX.Element {
  const [reponses, setReponses] = useState<Record<number, string>>({})
  const [actif, setActif] = useState<number | null>(1)
  const [sauvegarde, setSauvegarde] = useState<Record<number, boolean>>({})

  useEffect(() => {
    window.api.getBilanReponses().then((list: BilanReponseDTO[]) => {
      const map: Record<number, string> = {}
      list.forEach((r) => { map[r.questionId] = r.reponse })
      setReponses(map)
      const sv: Record<number, boolean> = {}
      list.forEach((r) => { sv[r.questionId] = true })
      setSauvegarde(sv)
    })
  }, [])

  async function sauvegarder(qId: number) {
    if (!reponses[qId]?.trim()) return
    await window.api.setBilanReponse(qId, reponses[qId].trim())
    setSauvegarde((p) => ({ ...p, [qId]: true }))
  }

  const nbRepondu = Object.keys(sauvegarde).filter((k) => sauvegarde[+k]).length

  return (
    <div className="col">
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,.2), rgba(168,85,247,.1))', border: '1px solid var(--accent)' }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>📊 Bilan de vie</div>
        <div className="text-muted" style={{ marginBottom: 12 }}>10 questions inconfortables. Elles te feront avancer plus qu'un mois de to-do lists.</div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${(nbRepondu / 10) * 100}%` }} />
        </div>
        <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>{nbRepondu}/10 réponses enregistrées</div>
      </div>

      {BILAN_QUESTIONS.map((bq) => (
        <div key={bq.id} style={{ background: 'var(--bg-card)', border: `1px solid ${actif === bq.id ? 'var(--accent)' : sauvegarde[bq.id] ? 'rgba(16,185,129,.4)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <button
            onClick={() => setActif(actif === bq.id ? null : bq.id)}
            style={{ width: '100%', padding: '14px 16px', background: 'transparent', color: 'var(--text)', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
          >
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: sauvegarde[bq.id] ? 'var(--green)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {sauvegarde[bq.id] ? '✓' : bq.id}
            </span>
            <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{bq.q}</span>
            <span style={{ color: 'var(--text-muted)' }}>{actif === bq.id ? '▲' : '▼'}</span>
          </button>
          {actif === bq.id && (
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ fontSize: 12, color: 'var(--accent-glow)', fontStyle: 'italic', marginBottom: 10, padding: '8px 12px', background: 'rgba(124,58,237,.1)', borderRadius: 8 }}>
                💡 {bq.tip}
              </div>
              <textarea
                className="textarea"
                style={{ minHeight: 90 }}
                placeholder="Prends le temps d'écrire une vraie réponse..."
                value={reponses[bq.id] ?? ''}
                onChange={(e) => { setReponses((p) => ({ ...p, [bq.id]: e.target.value })); setSauvegarde((p) => ({ ...p, [bq.id]: false })) }}
              />
              <button className="btn-primary" style={{ marginTop: 8 }} onClick={() => sauvegarder(bq.id)} disabled={!reponses[bq.id]?.trim()}>
                {sauvegarde[bq.id] ? '✓ Enregistré' : '💾 Enregistrer'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
