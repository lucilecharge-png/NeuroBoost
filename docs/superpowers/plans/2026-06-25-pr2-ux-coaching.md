# PR2 — UX + Coaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter 3 features UX + coaching : Reformulateur de verbes (habit 8), Templates de routine (habit 3), Revue Hebdo gamifiée (habit 6+).

**Architecture:** PR2 est indépendant de PR1. Nouveaux composants dans `src/renderer/src/components/`. Migration DB v5 pour la table `revue_hebdo`. Wiring IPC complet (game.ts → ipc.ts → preload → types).

**Tech Stack:** React + TypeScript, Electron IPC, better-sqlite3 (synchrone)

---

## Fichiers créés / modifiés

| Fichier | Changement |
|---------|-----------|
| `src/shared/types.ts` | Ajout `RevueHebdoDTO`, `RevueReponse`, 2 méthodes API |
| `src/main/db/migrations.ts` | Migration v5 — table `revue_hebdo` |
| `src/main/db/game.ts` | Ajout `getRevueHebdo`, `saveRevueHebdo` |
| `src/main/ipc.ts` | 2 nouveaux handlers `revue:get`, `revue:save` |
| `src/preload/index.ts` | 2 nouvelles entrées API |
| `src/renderer/src/components/TacheTitreInput.tsx` | Nouveau composant |
| `src/renderer/src/components/TemplatesModal.tsx` | Nouveau composant |
| `src/renderer/src/components/RevueHebdoModal.tsx` | Nouveau composant |
| `src/renderer/src/screens/QuestesScreen.tsx` | Remplace `<input>` titre par `TacheTitreInput` |
| `src/renderer/src/screens/AccueilScreen.tsx` | Bouton Templates + bouton flottant Revue Hebdo |

---

## Task 1 : Migration DB et wiring IPC pour Revue Hebdo

**Files:**
- Modify: `src/main/db/migrations.ts`
- Modify: `src/main/db/game.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/shared/types.ts`

- [ ] **Step 1.1 : Migration v5**

Dans `src/main/db/migrations.ts`, ajoute une 5ème entrée au tableau `MIGRATIONS` (après la v4) :

```ts
  // v5 — Revue hebdomadaire gamifiée
  `
  CREATE TABLE IF NOT EXISTS revue_hebdo (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    semaine     TEXT UNIQUE NOT NULL,
    reponses    TEXT NOT NULL DEFAULT '[]',
    xp_attribue INTEGER NOT NULL DEFAULT 0,
    cree_le     TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
  `
```

- [ ] **Step 1.2 : Nouveaux types dans shared/types.ts**

Dans `src/shared/types.ts`, après `export interface BilanReponseDTO`, ajoute :

```ts
// ─── Revue hebdomadaire ───────────────────────────────────────────────────────

export interface RevueReponse { questionId: number; reponse: string }

export interface RevueHebdoDTO {
  id: number
  semaine: string      // "2026-W26"
  reponses: RevueReponse[]
  xpAttribue: number
  creeLe: string
}
```

Dans `NeuroBoostApi`, ajoute ces 2 lignes après `setBilanReponse` :

```ts
  getRevueHebdo: (semaine: string) => Promise<RevueHebdoDTO | null>
  saveRevueHebdo: (semaine: string, reponses: RevueReponse[]) => Promise<{ revue: RevueHebdoDTO; xpGagne: number }>
```

- [ ] **Step 1.3 : Fonctions game.ts**

Dans `src/main/db/game.ts`, ajoute un import en haut si pas déjà présent :
```ts
import type { RevueHebdoDTO, RevueReponse } from '../../shared/types'
```

Puis ajoute en bas du fichier :

```ts
// ─── Revue Hebdo ──────────────────────────────────────────────────────────────

export function getRevueHebdo(db: Db, semaine: string): RevueHebdoDTO | null {
  const row = db.prepare('SELECT * FROM revue_hebdo WHERE semaine = ?').get(semaine) as Record<string, unknown> | undefined
  if (!row) return null
  return {
    id: row.id as number,
    semaine: row.semaine as string,
    reponses: JSON.parse(row.reponses as string),
    xpAttribue: row.xp_attribue as number,
    creeLe: row.cree_le as string
  }
}

export function saveRevueHebdo(
  db: Db,
  semaine: string,
  reponses: RevueReponse[]
): { revue: RevueHebdoDTO; xpGagne: number } {
  const XP_REVUE = 100
  const result = db.transaction(() => {
    db.prepare(
      'INSERT INTO revue_hebdo (semaine, reponses, xp_attribue) VALUES (?, ?, ?) ON CONFLICT(semaine) DO NOTHING'
    ).run(semaine, JSON.stringify(reponses), XP_REVUE)
    db.prepare('UPDATE profil SET xp = xp + ? WHERE id = 1').run(XP_REVUE)
    // Recalcule le niveau
    const profil = db.prepare('SELECT xp, niveau, xp_prochain_niveau FROM profil WHERE id = 1').get() as Record<string, number>
    let { xp, niveau, xp_prochain_niveau } = profil
    while (xp >= xp_prochain_niveau) {
      xp -= xp_prochain_niveau
      niveau += 1
      xp_prochain_niveau = Math.round(xp_prochain_niveau * 1.4)
    }
    db.prepare('UPDATE profil SET xp = ?, niveau = ?, xp_prochain_niveau = ? WHERE id = 1').run(xp, niveau, xp_prochain_niveau)
    const revue = db.prepare('SELECT * FROM revue_hebdo WHERE semaine = ?').get(semaine) as Record<string, unknown>
    return {
      revue: {
        id: revue.id as number,
        semaine: revue.semaine as string,
        reponses: JSON.parse(revue.reponses as string),
        xpAttribue: revue.xp_attribue as number,
        creeLe: revue.cree_le as string
      },
      xpGagne: XP_REVUE
    }
  })()
  return result
}
```

- [ ] **Step 1.4 : Handlers IPC**

Dans `src/main/ipc.ts`, à la fin de `registerIpcHandlers` (avant la fermeture `}`), ajoute :

```ts
  // Revue hebdo
  ipcMain.handle('revue:get', (_e, semaine: string) => G.getRevueHebdo(db, semaine))
  ipcMain.handle('revue:save', (_e, semaine: string, reponses: import('../shared/types').RevueReponse[]) => G.saveRevueHebdo(db, semaine, reponses))
```

- [ ] **Step 1.5 : Preload**

Dans `src/preload/index.ts`, après `setBilanReponse`, ajoute :

```ts
  getRevueHebdo: (semaine) => ipcRenderer.invoke('revue:get', semaine),
  saveRevueHebdo: (semaine, reponses) => ipcRenderer.invoke('revue:save', semaine, reponses),
```

- [ ] **Step 1.6 : Vérifier la migration**

Lance `npm run dev`. Si l'appli démarre sans erreur dans la console Electron (DevTools), la migration v5 s'est appliquée. Vérifie via DevTools Console :
```js
await window.api.getRevueHebdo('2026-W26')
// doit retourner null (pas encore de revue)
```

- [ ] **Step 1.7 : Commit**

```bash
git add src/shared/types.ts src/main/db/migrations.ts src/main/db/game.ts src/main/ipc.ts src/preload/index.ts
git commit -m "feat: migration v5 + IPC revue hebdo gamifiée"
```

---

## Task 2 : Composant TacheTitreInput (Habit 8)

**Comportement attendu :** Dans le formulaire de création de quête, si le titre ne commence pas par un verbe d'action, affiche 3 suggestions reformulées cliquables. "Ignorer" masque les suggestions.

**Files:**
- Create: `src/renderer/src/components/TacheTitreInput.tsx`
- Modify: `src/renderer/src/screens/QuestesScreen.tsx`

- [ ] **Step 2.1 : Créer TacheTitreInput.tsx**

Crée `src/renderer/src/components/TacheTitreInput.tsx` :

```tsx
import { useState, useEffect } from 'react'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  autoFocus?: boolean
}

const VERBES = new Set([
  'rédiger', 'envoyer', 'appeler', 'créer', 'lire', 'écrire', 'préparer',
  'organiser', 'planifier', 'finir', 'relire', 'contacter', 'vérifier', 'chercher',
  'faire', 'classer', 'acheter', 'réserver', 'nettoyer', 'trier', 'installer',
  'configurer', 'démarrer', 'publier', 'terminer', 'corriger', 'développer',
  'tester', 'analyser', 'réviser', 'répondre', 'commander', 'compléter'
])

function genererSuggestions(titre: string): string[] {
  const lower = titre.toLowerCase()
  if (lower.includes('email') || lower.includes('message') || lower.includes('mail')) {
    return [`Répondre aux ${titre}`, `Envoyer ${titre}`, `Rédiger ${titre}`]
  }
  if (lower.includes('rapport') || lower.includes('document') || lower.includes('présentation')) {
    return [`Rédiger ${titre}`, `Relire ${titre}`, `Envoyer ${titre}`]
  }
  if (lower.includes('réunion') || lower.includes('meeting') || lower.includes('appel')) {
    return [`Préparer ${titre}`, `Planifier ${titre}`, `Appeler pour ${titre}`]
  }
  if (lower.includes('code') || lower.includes('bug') || lower.includes('feature')) {
    return [`Corriger ${titre}`, `Développer ${titre}`, `Tester ${titre}`]
  }
  if (lower.includes('course') || lower.includes('achat') || lower.includes('commande')) {
    return [`Acheter ${titre}`, `Commander ${titre}`, `Préparer la liste : ${titre}`]
  }
  if (lower.includes('projet') || lower.includes('dossier') || lower.includes('fichier')) {
    return [`Avancer sur ${titre}`, `Organiser ${titre}`, `Relire ${titre}`]
  }
  return [`Faire ${titre}`, `Terminer ${titre}`, `Commencer ${titre}`]
}

function demandeVerbe(titre: string): boolean {
  if (!titre.trim()) return false
  const premier = titre.trim().toLowerCase().split(/\s+/)[0]
  return !VERBES.has(premier)
}

export default function TacheTitreInput({ value, onChange, placeholder, onKeyDown, autoFocus }: Props): JSX.Element {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [ignore, setIgnore] = useState(false)

  useEffect(() => {
    if (ignore || !demandeVerbe(value)) {
      setSuggestions([])
      return
    }
    if (value.trim().length > 2) {
      setSuggestions(genererSuggestions(value))
    } else {
      setSuggestions([])
    }
  }, [value, ignore])

  function choisirSuggestion(s: string) {
    onChange(s)
    setSuggestions([])
    setIgnore(true)
  }

  return (
    <div>
      <input
        className="input"
        placeholder={placeholder ?? 'Titre de la tâche...'}
        value={value}
        onChange={(e) => { setIgnore(false); onChange(e.target.value) }}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
      />
      {suggestions.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--accent-glow)', fontWeight: 700, marginBottom: 4 }}>
            ✨ Commence par un verbe pour faciliter le démarrage :
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => choisirSuggestion(s)}
                style={{
                  padding: '7px 12px',
                  background: 'rgba(124,58,237,.12)',
                  border: '1px solid rgba(124,58,237,.3)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: 13
                }}
              >
                → {s}
              </button>
            ))}
          </div>
          <button
            onClick={() => setIgnore(true)}
            style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
          >
            Ignorer
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2.2 : Intégrer dans QuestesScreen.tsx**

Dans `src/renderer/src/screens/QuestesScreen.tsx` :

1. Ajoute l'import en haut :
```ts
import TacheTitreInput from '../components/TacheTitreInput'
```

2. Dans le formulaire (`{showForm && ...}`), remplace ce bloc :
```tsx
<input
  className="input"
  placeholder="Titre de la tâche..."
  value={form.titre}
  onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
  onKeyDown={(e) => { if (e.key === 'Enter') creer() }}
  autoFocus
/>
```
par :
```tsx
<TacheTitreInput
  value={form.titre}
  onChange={(v) => setForm((f) => ({ ...f, titre: v }))}
  onKeyDown={(e) => { if (e.key === 'Enter') creer() }}
  autoFocus
/>
```

- [ ] **Step 2.3 : Vérifier manuellement**

Lance `npm run dev`. Va dans "⚔️ Toutes mes quêtes", clique "+ Nouvelle quête". Tape "Emails" dans le titre. Vérifie :
- 3 suggestions apparaissent sous le champ
- Cliquer sur une suggestion remplace le titre
- "Ignorer" masque les suggestions
- Taper "Rédiger le rapport" → pas de suggestions (commence par un verbe)

- [ ] **Step 2.4 : Commit**

```bash
git add src/renderer/src/components/TacheTitreInput.tsx src/renderer/src/screens/QuestesScreen.tsx
git commit -m "feat: reformulateur verbe d'action dans création de quête (habit 8)"
```

---

## Task 3 : Templates de routine (Habit 3)

**Comportement attendu :** Bouton "🎲 Choisis pour moi" dans l'Accueil à côté de "↻ Changer". Ouvre une modale avec 4 templates. Sélectionner un template crée les tâches et régénère les missions.

**Files:**
- Create: `src/renderer/src/components/TemplatesModal.tsx`
- Modify: `src/renderer/src/screens/AccueilScreen.tsx`

- [ ] **Step 3.1 : Créer TemplatesModal.tsx**

Crée `src/renderer/src/components/TemplatesModal.tsx` :

```tsx
interface Template {
  key: string
  emoji: string
  label: string
  taches: Array<{ titre: string; niveauEnergie: 'micro' | 'faible' | 'moyenne' | 'haute'; dureeEstimeeMin: number }>
}

const TEMPLATES: Template[] = [
  {
    key: 'matin',
    emoji: '☀️',
    label: 'Routine Matin',
    taches: [
      { titre: 'Écrire mes 3 intentions du jour', niveauEnergie: 'micro', dureeEstimeeMin: 5 },
      { titre: 'Préparer ma liste de priorités', niveauEnergie: 'micro', dureeEstimeeMin: 5 },
      { titre: 'Lire 10 minutes', niveauEnergie: 'micro', dureeEstimeeMin: 10 }
    ]
  },
  {
    key: 'soir',
    emoji: '🌙',
    label: 'Routine Soir',
    taches: [
      { titre: 'Ranger mon espace de travail', niveauEnergie: 'micro', dureeEstimeeMin: 5 },
      { titre: 'Écrire ma victoire du jour', niveauEnergie: 'micro', dureeEstimeeMin: 3 },
      { titre: 'Préparer mes affaires pour demain', niveauEnergie: 'micro', dureeEstimeeMin: 5 }
    ]
  },
  {
    key: 'travail',
    emoji: '💼',
    label: 'Routine Travail',
    taches: [
      { titre: 'Répondre aux emails urgents', niveauEnergie: 'faible', dureeEstimeeMin: 15 },
      { titre: 'Vérifier mon agenda du jour', niveauEnergie: 'micro', dureeEstimeeMin: 5 },
      { titre: 'Avancer sur ma tâche principale', niveauEnergie: 'moyenne', dureeEstimeeMin: 25 }
    ]
  },
  {
    key: 'maison',
    emoji: '🏠',
    label: 'Routine Maison',
    taches: [
      { titre: 'Faire une tâche ménagère rapide', niveauEnergie: 'faible', dureeEstimeeMin: 10 },
      { titre: 'Acheter ce qui manque en courses', niveauEnergie: 'micro', dureeEstimeeMin: 5 },
      { titre: 'Préparer les repas de demain', niveauEnergie: 'faible', dureeEstimeeMin: 15 }
    ]
  }
]

interface Props {
  onClose: () => void
  onTemplateApplique: () => void
}

export default function TemplatesModal({ onClose, onTemplateApplique }: Props): JSX.Element {
  const [chargement, setChargement] = useState(false)
  const [choisi, setChoisi] = useState<string | null>(null)

  async function appliquer(template: Template) {
    setChargement(true)
    setChoisi(template.key)
    for (const t of template.taches) {
      await window.api.createTache(t)
    }
    await window.api.regenererMissions()
    onTemplateApplique()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 420 }}>
        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>🎲 Choisis une routine</div>
        <div className="text-muted" style={{ marginBottom: 20 }}>
          Les tâches seront ajoutées et tes 3 missions du jour régénérées.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => appliquer(t)}
              disabled={chargement}
              style={{
                padding: '14px 16px',
                background: choisi === t.key ? 'rgba(124,58,237,.2)' : 'var(--bg-card)',
                border: `2px solid ${choisi === t.key ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                cursor: chargement ? 'wait' : 'pointer',
                textAlign: 'left',
                display: 'flex',
                gap: 12,
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: 28 }}>{t.emoji}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{t.label}</div>
                <div className="text-muted" style={{ fontSize: 12 }}>{t.taches.length} tâches</div>
              </div>
            </button>
          ))}
        </div>
        <button className="btn-ghost" style={{ width: '100%', marginTop: 14 }} onClick={onClose}>
          Annuler
        </button>
      </div>
    </div>
  )
}
```

Le fichier commence par (en haut, avant tout) :
```ts
import { useState } from 'react'
```

- [ ] **Step 3.2 : Intégrer dans AccueilScreen.tsx**

Dans `src/renderer/src/screens/AccueilScreen.tsx` :

1. Ajoute l'import :
```ts
import TemplatesModal from '../components/TemplatesModal'
```

2. Dans le state, ajoute après `const [capture, setCapture]` :
```ts
const [showTemplates, setShowTemplates] = useState(false)
```

3. Dans le rendu, dans la section "⚔️ Tes 3 missions du jour", remplace le `<div className="row-between">` existant par :
```tsx
<div className="row-between" style={{ marginBottom: 12 }}>
  <div style={{ fontWeight: 900, fontSize: 18 }}>⚔️ Tes 3 missions du jour</div>
  <div className="row" style={{ gap: 8 }}>
    <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setShowTemplates(true)}>
      🎲 Choisis pour moi
    </button>
    <button className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }} onClick={regenerer}>
      ↻ Changer
    </button>
  </div>
</div>
```

4. Juste avant le `return (` de la JSX principale, ajoute le composant modal :
```tsx
{showTemplates && (
  <TemplatesModal
    onClose={() => setShowTemplates(false)}
    onTemplateApplique={async () => {
      const m = await window.api.getMissionsJour()
      setMissions(m)
      setShowTemplates(false)
    }}
  />
)}
```

- [ ] **Step 3.3 : Vérifier manuellement**

Lance `npm run dev`. Clique sur "🎲 Choisis pour moi". Vérifie :
- La modale s'affiche avec 4 templates
- Sélectionner "☀️ Routine Matin" ferme la modale et les missions sont remplacées
- Les 3 nouvelles tâches commencent bien par des verbes d'action
- "Annuler" ferme la modale sans modifier les missions

- [ ] **Step 3.4 : Commit**

```bash
git add src/renderer/src/components/TemplatesModal.tsx src/renderer/src/screens/AccueilScreen.tsx
git commit -m "feat: templates de routine — bouton Choisis pour moi (habit 3)"
```

---

## Task 4 : Revue Hebdo gamifiée (Habit 6+)

**Comportement attendu :** Bouton flottant "📅 Revue de la semaine" en bas à droite de l'Accueil. Ouvre une modale avec 5 questions. Sur complétion : +100 XP + confettis. Si déjà faite : badge ✅ vert + lecture seule.

**Files:**
- Create: `src/renderer/src/components/RevueHebdoModal.tsx`
- Modify: `src/renderer/src/screens/AccueilScreen.tsx`

- [ ] **Step 4.1 : Créer le helper ISO week**

Dans `RevueHebdoModal.tsx`, on aura besoin d'un helper. On le définit dans le composant :

```ts
function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`
}
```

- [ ] **Step 4.2 : Créer RevueHebdoModal.tsx**

Crée `src/renderer/src/components/RevueHebdoModal.tsx` :

```tsx
import { useState, useEffect } from 'react'
import type { RevueHebdoDTO, RevueReponse, CompletionResult } from '../../../shared/types'
import Celebration from './Celebration'

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`
}

interface Question {
  id: number
  label: string
  type: 'text' | 'energy'
  prefill?: string
}

interface Props {
  onClose: () => void
  onRevueSauvegardee: (xpGagne: number) => void
}

const ENERGIE_LABELS = ['😴', '🥱', '😐', '😊', '⚡']

export default function RevueHebdoModal({ onClose, onRevueSauvegardee }: Props): JSX.Element {
  const semaine = getISOWeek(new Date())
  const [revueExistante, setRevueExistante] = useState<RevueHebdoDTO | null | 'loading'>('loading')
  const [reponses, setReponses] = useState<Record<number, string>>({})
  const [etape, setEtape] = useState(0)
  const [sauvegarde, setSauvegarde] = useState(false)
  const [celebration, setCelebration] = useState<CompletionResult | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])

  useEffect(() => {
    async function init() {
      const [revue, stats] = await Promise.all([
        window.api.getRevueHebdo(semaine),
        window.api.getStats()
      ])
      setRevueExistante(revue)
      const qs: Question[] = [
        { id: 1, label: `Tâches terminées cette semaine : ${stats.tachesTotalSemaine}. C'est comment pour toi ?`, type: 'text', prefill: `J'ai terminé ${stats.tachesTotalSemaine} tâches cette semaine.` },
        { id: 2, label: 'Quelle est ta plus grande victoire de la semaine ?', type: 'text' },
        { id: 3, label: "Qu'est-ce qui t'a le plus freiné ?", type: 'text' },
        { id: 4, label: 'Quelle habitude tu veux renforcer la semaine prochaine ?', type: 'text' },
        { id: 5, label: 'Ton énergie globale de la semaine ?', type: 'energy' }
      ]
      setQuestions(qs)
      if (revue) {
        const map: Record<number, string> = {}
        revue.reponses.forEach((r) => { map[r.questionId] = r.reponse })
        setReponses(map)
      }
    }
    init()
  }, [semaine])

  async function sauvegarder() {
    const reponsesArray: RevueReponse[] = questions.map((q) => ({
      questionId: q.id,
      reponse: reponses[q.id] ?? ''
    }))
    const { xpGagne } = await window.api.saveRevueHebdo(semaine, reponsesArray)
    setSauvegarde(true)
    const profil = await window.api.getProfil()
    setCelebration({
      profil,
      xpGagne,
      coinsGagnes: 0,
      levelUp: false,
      nouveauNiveau: null,
      achievementsDebloques: []
    })
    onRevueSauvegardee(xpGagne)
  }

  if (revueExistante === 'loading') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 32 }}>📅</div>
      </div>
    )
  }

  const lectureSeule = revueExistante !== null && !sauvegarde

  return (
    <>
      <Celebration result={celebration} onClose={() => { setCelebration(null); onClose() }} />
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        onClick={(e) => { if (e.target === e.currentTarget && !celebration) onClose() }}
      >
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>📅 Revue de la semaine</div>
              <div className="text-muted" style={{ fontSize: 12 }}>{semaine} {lectureSeule ? '· ✅ Déjà complétée' : ''}</div>
            </div>
            <button className="btn-icon" onClick={onClose}>✕</button>
          </div>

          {!lectureSeule && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {questions.map((_, i) => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= etape ? 'var(--accent)' : 'var(--border)' }} />
                ))}
              </div>
              <div className="text-muted" style={{ fontSize: 11 }}>{etape + 1} / {questions.length}</div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(lectureSeule ? questions : [questions[etape]]).filter(Boolean).map((q) => (
              <div key={q.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{q.label}</div>
                {q.type === 'energy' ? (
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    {ENERGIE_LABELS.map((e, i) => (
                      <button
                        key={i}
                        disabled={lectureSeule}
                        onClick={() => setReponses((r) => ({ ...r, [q.id]: String(i + 1) }))}
                        style={{ fontSize: 28, background: reponses[q.id] === String(i + 1) ? 'rgba(124,58,237,.2)' : 'transparent', border: reponses[q.id] === String(i + 1) ? '2px solid var(--accent)' : '2px solid transparent', borderRadius: 8, padding: 4, cursor: lectureSeule ? 'default' : 'pointer' }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    className="textarea"
                    style={{ minHeight: 70 }}
                    placeholder="Ta réponse..."
                    value={reponses[q.id] ?? (q.prefill ?? '')}
                    onChange={(e) => setReponses((r) => ({ ...r, [q.id]: e.target.value }))}
                    readOnly={lectureSeule}
                  />
                )}
              </div>
            ))}
          </div>

          {!lectureSeule && (
            <div style={{ marginTop: 16 }}>
              {etape < questions.length - 1 ? (
                <button
                  className="btn-launch"
                  style={{ width: '100%' }}
                  onClick={() => setEtape((e) => e + 1)}
                  disabled={!reponses[questions[etape]?.id]}
                >
                  Suivant →
                </button>
              ) : (
                <button
                  className="btn-launch"
                  style={{ width: '100%', background: 'linear-gradient(135deg, var(--accent), var(--green))' }}
                  onClick={sauvegarder}
                  disabled={!reponses[questions[etape]?.id] || sauvegarde}
                >
                  🎉 Valider ma revue (+100 XP)
                </button>
              )}
              {etape > 0 && (
                <button className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={() => setEtape((e) => e - 1)}>
                  ← Retour
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4.3 : Ajouter le bouton flottant dans AccueilScreen.tsx**

Dans `src/renderer/src/screens/AccueilScreen.tsx` :

1. Ajoute les imports :
```ts
import RevueHebdoModal from '../components/RevueHebdoModal'
```

2. Dans le state, ajoute :
```ts
const [showRevue, setShowRevue] = useState(false)
const [revueFaite, setRevueFaite] = useState(false)
```

3. Dans le `useEffect` de chargement (`charger`), après `setLoading(false)`, vérifie si la revue a déjà été faite. Ajoute dans `charger` :
```ts
// Vérifier revue hebdo
const { getISOWeek } = await import('../components/RevueHebdoModal') // non, on ne peut pas importer un helper non exporté
```

En fait, définis le helper `getISOWeek` directement dans `AccueilScreen.tsx` :

```ts
function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`
}
```

Ajoute ce `useEffect` après les useEffects existants dans `AccueilScreen` :
```ts
useEffect(() => {
  window.api.getRevueHebdo(getISOWeek(new Date())).then((r) => setRevueFaite(r !== null))
}, [])
```

4. Dans le rendu, juste avant la dernière `</div>` fermante du `return`, ajoute le bouton flottant et la modale :

```tsx
{/* ── Revue Hebdo flottante ── */}
{showRevue && (
  <RevueHebdoModal
    onClose={() => setShowRevue(false)}
    onRevueSauvegardee={() => setRevueFaite(true)}
  />
)}
<div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100 }}>
  <button
    onClick={() => setShowRevue(true)}
    style={{
      padding: '12px 18px',
      borderRadius: 'var(--radius-lg)',
      border: `2px solid ${revueFaite ? 'rgba(16,185,129,.5)' : 'var(--accent)'}`,
      background: revueFaite ? 'rgba(16,185,129,.15)' : 'rgba(124,58,237,.2)',
      color: revueFaite ? 'var(--green)' : 'var(--accent-glow)',
      cursor: 'pointer',
      fontWeight: 700,
      fontSize: 14,
      boxShadow: 'var(--shadow-lg)'
    }}
  >
    {revueFaite ? '✅ Revue faite' : '📅 Revue de la semaine'}
  </button>
</div>
```

- [ ] **Step 4.4 : Exporter getISOWeek depuis RevueHebdoModal pour éviter la duplication**

Dans `RevueHebdoModal.tsx`, change `function getISOWeek` en `export function getISOWeek`.

Dans `AccueilScreen.tsx`, supprime la définition locale de `getISOWeek` et ajoute l'import :
```ts
import RevueHebdoModal, { getISOWeek } from '../components/RevueHebdoModal'
```

- [ ] **Step 4.5 : Vérifier manuellement**

Lance `npm run dev`. Dans l'Accueil, vérifie :
- Le bouton violet "📅 Revue de la semaine" est visible en bas à droite
- Cliquer ouvre la modale avec 5 questions (une par une avec barre de progression)
- Question 1 pré-remplie avec le nombre de tâches de la semaine
- Question 5 montre les 5 emojis d'énergie cliquables
- Valider affiche confettis + "+100 XP"
- Après validation, le bouton devient vert "✅ Revue faite"
- Cliquer "✅ Revue faite" rouvre la revue en lecture seule (toutes les questions visibles)

- [ ] **Step 4.6 : Commit**

```bash
git add src/renderer/src/components/RevueHebdoModal.tsx src/renderer/src/screens/AccueilScreen.tsx
git commit -m "feat: revue hebdo gamifiée — bouton flottant + confettis +100 XP (habit 6+)"
```
