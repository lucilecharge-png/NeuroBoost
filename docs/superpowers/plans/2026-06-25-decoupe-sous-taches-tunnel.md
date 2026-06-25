# Découpe d'une tâche en sous-tâches (Tunnel) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de découper la tâche « Maintenant » du Tunnel en N sous-tâches proposées par l'IA (Claude Haiku via une Cloudflare Pages Function), éditables, créées comme vraies quêtes enfants ; le parent s'auto-termine quand toutes ses sous-tâches sont finies.

**Architecture:** PWA front-only (React + sql.js/IndexedDB, logique dans `game.ts` via `window.api`). Une seule sortie réseau : `decouperTache` → `POST /api/decoupe` (Pages Function gardant la clé API). Relation parent/enfant via une colonne `parent_id` (migration v9). Repli gracieux si l'IA est injoignable.

**Tech Stack:** TypeScript, React 19, sql.js, Vitest, Cloudflare Pages Functions, `@anthropic-ai/sdk` (modèle `claude-haiku-4-5`, sortie structurée JSON).

**Spec de référence :** `docs/superpowers/specs/2026-06-25-decoupe-sous-taches-tunnel-design.md`

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/renderer/src/data/migrations.ts` | + migration v9 : colonne `parent_id` + index |
| `src/shared/types.ts` | `parentId` sur `TacheDTO`, type `SousTacheProposee`, méthodes API |
| `src/renderer/src/data/game.ts` | `tacheToDTO` (parentId), `listTaches` (masque parents à enfants ouverts), `creerSousTaches`, auto-complétion parent dans `terminerTache` |
| `src/renderer/src/data/api.ts` | `decouperTache` (réseau) + `creerSousTaches` (local) |
| `functions/api/decoupe.ts` *(nouveau)* | Pages Function : proxy vers Claude Haiku |
| `src/renderer/src/screens/TunnelScreen.tsx` | bouton « ✂️ Découper » + panneau |
| `package.json` | dép `@anthropic-ai/sdk` + script `dev:cf` |
| `.dev.vars.example`, `.gitignore` *(nouveau/maj)* | clé API en dev |
| `functions/tsconfig.json` *(nouveau)* | types Cloudflare pour la fonction |

---

## Task 1 : Migration v9 — colonne `parent_id`

**Files:**
- Modify: `src/renderer/src/data/migrations.ts` (append au tableau `MIGRATIONS`)
- Test: `src/renderer/src/data/__tests__/migration-parent.test.ts` *(nouveau)*

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/renderer/src/data/__tests__/migration-parent.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'

describe('migration v9 — parent_id', () => {
  it('ajoute la colonne parent_id à taches', async () => {
    const db = await makeTestDb()
    const cols = (db.prepare("PRAGMA table_info('taches')").all() as { name: string }[]).map((c) => c.name)
    expect(cols).toContain('parent_id')
  })

  it('crée l’index idx_taches_parent', async () => {
    const db = await makeTestDb()
    const idx = (db.prepare("PRAGMA index_list('taches')").all() as { name: string }[]).map((i) => i.name)
    expect(idx).toContain('idx_taches_parent')
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- migration-parent`
Expected: FAIL (`parent_id` absent de la liste des colonnes).

- [ ] **Step 3 : Ajouter la migration v9**

Dans `src/renderer/src/data/migrations.ts`, ajouter une **nouvelle entrée à la fin** du tableau `MIGRATIONS` (après la migration v8, qui se termine par `idx_exception_evenement`). Mettre une virgule après la chaîne v8, puis :

```ts
  ,
  // v9 — Sous-tâches : relation parent/enfant
  `
  ALTER TABLE taches ADD COLUMN parent_id INTEGER REFERENCES taches(id) ON DELETE CASCADE;
  CREATE INDEX idx_taches_parent ON taches(parent_id);
  `
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npm test -- migration-parent`
Expected: PASS (2 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/renderer/src/data/migrations.ts src/renderer/src/data/__tests__/migration-parent.test.ts
git commit -m "feat: migration v9 — colonne parent_id pour sous-tâches"
```

---

## Task 2 : Types partagés

**Files:**
- Modify: `src/shared/types.ts`

Pas de test unitaire (types only) — vérifié par `tsc` en Task 9.

- [ ] **Step 1 : Ajouter `parentId` à `TacheDTO`**

Dans `interface TacheDTO`, après `creeLe: string`, ajouter :

```ts
  parentId: number | null
```

- [ ] **Step 2 : Ajouter le type `SousTacheProposee`**

Juste après l'interface `TacheInput` (vers la fin du bloc « Tâches / Quêtes ») :

```ts
export interface SousTacheProposee {
  titre: string
  dureeEstimeeMin?: number
  niveauEnergie?: NiveauEnergie
}
```

- [ ] **Step 3 : Ajouter les méthodes API**

Dans `interface NeuroBoostApi`, dans la section `// Tâches`, après `regenererMissions: ...`, ajouter :

```ts
  // Découpe en sous-tâches
  decouperTache: (
    input: { titre: string; description?: string | null; pourquoi?: string | null; categorie?: string | null },
    nombre: number
  ) => Promise<SousTacheProposee[]>
  creerSousTaches: (parentId: number, sousTaches: TacheInput[]) => Promise<TacheDTO[]>
```

- [ ] **Step 4 : Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: types sous-tâches (parentId, SousTacheProposee, API)"
```

---

## Task 3 : `tacheToDTO` + `listTaches` masque les parents

**Files:**
- Modify: `src/renderer/src/data/game.ts` (`tacheToDTO` ~ligne 84, `listTaches` ~ligne 128)
- Test: `src/renderer/src/data/__tests__/sous-taches.test.ts` *(nouveau)*

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/renderer/src/data/__tests__/sous-taches.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'
import * as G from '../game'

describe('sous-tâches — parentId & listing', () => {
  it('expose parentId (null par défaut) sur le DTO', async () => {
    const db = await makeTestDb()
    const t = G.createTache(db, { titre: 'Préparer mon anniversaire' })
    expect(t.parentId).toBeNull()
  })

  it('listTaches masque un parent qui a une sous-tâche active', async () => {
    const db = await makeTestDb()
    const parent = G.createTache(db, { titre: 'Préparer mon anniversaire' })
    G.creerSousTaches(db, parent.id, [{ titre: 'Inviter les gens' }])
    const titres = G.listTaches(db, { statut: 'active' }).map((t) => t.titre)
    expect(titres).toContain('Inviter les gens')
    expect(titres).not.toContain('Préparer mon anniversaire')
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- sous-taches`
Expected: FAIL (`G.creerSousTaches` n'existe pas encore, et `parentId` absent du DTO).

- [ ] **Step 3 : Ajouter `parentId` à `tacheToDTO`**

Dans `tacheToDTO`, après `creeLe: r.cree_le as string`, ajouter (avec une virgule avant) :

```ts
    creeLe: r.cree_le as string,
    parentId: (r.parent_id as number | null) ?? null
```

- [ ] **Step 4 : Masquer les parents à enfants ouverts dans `listTaches`**

Dans `listTaches`, modifier la construction du SQL. Remplacer la ligne :

```ts
  let sql = 'SELECT * FROM taches WHERE 1=1'
```

par :

```ts
  let sql = `SELECT * FROM taches WHERE 1=1
    AND NOT EXISTS (
      SELECT 1 FROM taches enfant
      WHERE enfant.parent_id = taches.id
        AND enfant.statut IN ('active','en_cours')
    )`
```

(Le reste de la fonction — filtres `statut`/`energie` et `ORDER BY` — est inchangé.)

> Note : `G.creerSousTaches` est implémentée en Task 4. Ce test reste rouge tant que Task 4 n'est pas faite — c'est attendu. On rend vert le sous-test « parentId » ici ; le test de listing passera après Task 4.

- [ ] **Step 5 : Vérifier le sous-test parentId**

Run: `npm test -- sous-taches -t "parentId"`
Expected: PASS pour « expose parentId ». (Le test de listing échoue encore → Task 4.)

- [ ] **Step 6 : Commit**

```bash
git add src/renderer/src/data/game.ts src/renderer/src/data/__tests__/sous-taches.test.ts
git commit -m "feat: parentId dans tacheToDTO + listTaches masque les parents"
```

---

## Task 4 : `creerSousTaches`

**Files:**
- Modify: `src/renderer/src/data/game.ts` (ajouter après `createTache`, ~ligne 153)
- Test: `src/renderer/src/data/__tests__/sous-taches.test.ts` (réutilise le test de listing de Task 3)

- [ ] **Step 1 : Implémenter `creerSousTaches`**

Dans `game.ts`, juste après la fonction `createTache` (qui se termine par son `return tacheToDTO(...)`), ajouter :

```ts
export function creerSousTaches(
  db: Db,
  parentId: number,
  sousTaches: { titre: string; description?: string | null; niveauEnergie?: NiveauEnergie; dureeEstimeeMin?: number; categorie?: string | null; pourquoi?: string | null }[]
): TacheDTO[] {
  const ids: number[] = []
  const insert = db.transaction(() => {
    for (const st of sousTaches) {
      const energie = st.niveauEnergie ?? 'faible'
      const res = db.prepare(`
        INSERT INTO taches (titre, description, niveau_energie, duree_estimee_min, xp_recompense, coins_recompense, categorie, pourquoi, parent_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        st.titre,
        st.description ?? null,
        energie,
        st.dureeEstimeeMin ?? 15,
        XP_PAR_ENERGIE[energie],
        COINS_PAR_ENERGIE[energie],
        st.categorie ?? null,
        st.pourquoi ?? null,
        parentId
      )
      ids.push(res.lastInsertRowid)
    }
  })
  insert()
  if (ids.length === 0) return []
  return (db.prepare(`SELECT * FROM taches WHERE id IN (${ids.join(',')}) ORDER BY id ASC`).all() as Record<string, unknown>[]).map(tacheToDTO)
}
```

- [ ] **Step 2 : Lancer le test complet, vérifier le succès**

Run: `npm test -- sous-taches`
Expected: PASS (les 2 tests, dont le listing qui masque le parent).

- [ ] **Step 3 : Commit**

```bash
git add src/renderer/src/data/game.ts
git commit -m "feat: creerSousTaches — crée des quêtes enfants rattachées au parent"
```

---

## Task 5 : Auto-complétion du parent dans `terminerTache`

**Files:**
- Modify: `src/renderer/src/data/game.ts` (`terminerTache`, le bloc `return { ... }` ~ligne 220)
- Test: `src/renderer/src/data/__tests__/sous-taches.test.ts` (ajouter un test)

- [ ] **Step 1 : Ajouter le test qui échoue**

Dans `src/renderer/src/data/__tests__/sous-taches.test.ts`, ajouter à l'intérieur du `describe` :

```ts
  it('termine automatiquement le parent quand la dernière sous-tâche est finie', async () => {
    const db = await makeTestDb()
    const parent = G.createTache(db, { titre: 'Préparer mon anniversaire' })
    const enfants = G.creerSousTaches(db, parent.id, [
      { titre: 'Inviter les gens' },
      { titre: 'Prévoir le gâteau' }
    ])

    // Première sous-tâche finie → parent encore actif
    G.terminerTache(db, enfants[0].id)
    let p = db.prepare('SELECT statut FROM taches WHERE id = ?').get(parent.id) as { statut: string }
    expect(p.statut).toBe('active')

    // Dernière sous-tâche finie → parent auto-terminé
    const res = G.terminerTache(db, enfants[1].id)
    p = db.prepare('SELECT statut FROM taches WHERE id = ?').get(parent.id) as { statut: string }
    expect(p.statut).toBe('terminee')
    // La récompense inclut l'XP du parent (cumulée avec la sous-tâche)
    expect(res.xpGagne).toBeGreaterThan(enfants[1].xpRecompense)
  })
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- sous-taches -t "automatiquement"`
Expected: FAIL (le parent reste `active`).

- [ ] **Step 3 : Restructurer la fin de `terminerTache`**

Dans `terminerTache`, remplacer le bloc final :

```ts
  return {
    profil: profilToDTO(profilFinal),
    xpGagne: xp,
    coinsGagnes: coins,
    levelUp,
    nouveauNiveau: levelUp ? nouveauNiveau : null,
    achievementsDebloques: debloques
  }
}
```

par :

```ts
  const resultat: CompletionResult = {
    profil: profilToDTO(profilFinal),
    xpGagne: xp,
    coinsGagnes: coins,
    levelUp,
    nouveauNiveau: levelUp ? nouveauNiveau : null,
    achievementsDebloques: debloques
  }

  // Auto-complétion du parent : si cette tâche est une sous-tâche et qu'il ne
  // reste plus aucune sous-tâche active pour le parent, on termine le parent
  // (effet « projet bouclé ») et on cumule sa récompense.
  const parentId = tache.parent_id as number | null
  if (parentId) {
    const reste = db.prepare(
      "SELECT COUNT(*) as n FROM taches WHERE parent_id = ? AND statut IN ('active','en_cours')"
    ).get(parentId) as { n: number }
    if (reste.n === 0) {
      const parentRes = terminerTache(db, parentId)
      return {
        profil: parentRes.profil,
        xpGagne: resultat.xpGagne + parentRes.xpGagne,
        coinsGagnes: resultat.coinsGagnes + parentRes.coinsGagnes,
        levelUp: resultat.levelUp || parentRes.levelUp,
        nouveauNiveau: parentRes.nouveauNiveau ?? resultat.nouveauNiveau,
        achievementsDebloques: [...resultat.achievementsDebloques, ...parentRes.achievementsDebloques]
      }
    }
  }

  return resultat
}
```

> Le parent n'ayant pas de `parent_id`, l'appel récursif `terminerTache(db, parentId)` ne récurse pas davantage (pas de boucle infinie).

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npm test -- sous-taches`
Expected: PASS (3 tests).

- [ ] **Step 5 : Lancer toute la suite (non-régression)**

Run: `npm test`
Expected: PASS (toutes les suites, dont `smoke`, `migration-agenda`, `recurrence-*`).

- [ ] **Step 6 : Commit**

```bash
git add src/renderer/src/data/game.ts src/renderer/src/data/__tests__/sous-taches.test.ts
git commit -m "feat: auto-complétion du parent quand toutes les sous-tâches sont finies"
```

---

## Task 6 : Câblage `api.ts` (`creerSousTaches` local + `decouperTache` réseau)

**Files:**
- Modify: `src/renderer/src/data/api.ts` (section `// Tâches`, ~ligne 68)

Pas de test unitaire (couche d'adaptation réseau/IPC) ; vérifié manuellement en Task 9.

- [ ] **Step 1 : Ajouter les deux méthodes dans `rawApi`**

Dans `src/renderer/src/data/api.ts`, dans l'objet `rawApi`, juste après `regenererMissions: async () => G.regenererMissions(db),`, ajouter :

```ts
  // Découpe en sous-tâches
  decouperTache: async (input, nombre) => {
    const resp = await fetch('/api/decoupe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, nombre })
    })
    if (!resp.ok) throw new Error(`decoupe ${resp.status}`)
    const data = (await resp.json()) as { sousTaches?: SousTacheProposee[] }
    return data.sousTaches ?? []
  },
  creerSousTaches: async (parentId, sousTaches) => G.creerSousTaches(db, parentId, sousTaches),
```

- [ ] **Step 2 : Importer le type `SousTacheProposee`**

En haut de `api.ts`, étendre l'import de types. Remplacer :

```ts
import type { NeuroBoostApi, RendezVousDTO } from '../../../shared/types'
```

par :

```ts
import type { NeuroBoostApi, RendezVousDTO, SousTacheProposee } from '../../../shared/types'
```

- [ ] **Step 3 : Vérifier la compilation des types**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur liée à `decouperTache` / `creerSousTaches`.

- [ ] **Step 4 : Commit**

```bash
git add src/renderer/src/data/api.ts
git commit -m "feat: api.ts — decouperTache (réseau) + creerSousTaches (local)"
```

---

## Task 7 : Cloudflare Pages Function `/api/decoupe`

**Files:**
- Create: `functions/api/decoupe.ts`
- Create: `functions/tsconfig.json`
- Create: `.dev.vars.example`
- Modify: `.gitignore`
- Modify: `package.json` (dépendance + script)

- [ ] **Step 1 : Installer le SDK Anthropic**

Run: `npm install @anthropic-ai/sdk`
Expected: ajout dans `dependencies` de `package.json`.

- [ ] **Step 2 : Créer la Pages Function**

Créer `functions/api/decoupe.ts` :

```ts
import Anthropic from '@anthropic-ai/sdk'

interface Env {
  ANTHROPIC_API_KEY: string
}

interface CorpsRequete {
  titre?: string
  description?: string | null
  pourquoi?: string | null
  categorie?: string | null
  nombre?: number
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    sousTaches: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          titre: { type: 'string' },
          dureeEstimeeMin: { type: 'integer' },
          niveauEnergie: { type: 'string', enum: ['micro', 'faible', 'moyenne', 'haute'] }
        },
        required: ['titre', 'dureeEstimeeMin', 'niveauEnergie']
      }
    }
  },
  required: ['sousTaches']
}

const SYSTEME = `Tu aides une personne avec un TDAH à découper une tâche en étapes concrètes et actionnables.
Règles :
- Produis exactement le nombre d'étapes demandé, dans l'ordre logique de réalisation.
- Chaque étape commence par un verbe d'action et doit être démarrable immédiatement.
- Estime une durée réaliste (dureeEstimeeMin) et un niveau d'énergie (micro/faible/moyenne/haute).
- Réponds en français.`

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let corps: CorpsRequete
  try {
    corps = await context.request.json()
  } catch {
    return json({ error: 'corps JSON invalide' }, 400)
  }

  const titre = (corps.titre ?? '').trim()
  if (!titre) return json({ error: 'titre requis' }, 400)
  const nombre = Math.max(2, Math.min(6, Math.round(Number(corps.nombre) || 3)))

  if (!context.env.ANTHROPIC_API_KEY) {
    return json({ error: 'clé API absente côté serveur' }, 500)
  }

  const client = new Anthropic({ apiKey: context.env.ANTHROPIC_API_KEY })

  const contexte = [
    `Tâche à découper : ${titre}`,
    corps.description ? `Description : ${corps.description}` : '',
    corps.pourquoi ? `Pourquoi c'est important : ${corps.pourquoi}` : '',
    corps.categorie ? `Catégorie : ${corps.categorie}` : '',
    `Découpe-la en exactement ${nombre} sous-tâches.`
  ].filter(Boolean).join('\n')

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEME,
      messages: [{ role: 'user', content: contexte }],
      // Sortie structurée — Haiku 4.5 ne supporte PAS `effort` (400) ni n'a
      // besoin de `thinking` ici.
      output_config: { format: { type: 'json_schema', schema: SCHEMA } }
    } as Anthropic.MessageCreateParamsNonStreaming)

    const bloc = message.content.find((b) => b.type === 'text')
    const texte = bloc && bloc.type === 'text' ? bloc.text : '{}'
    const parsed = JSON.parse(texte) as { sousTaches?: unknown[] }
    return json({ sousTaches: Array.isArray(parsed.sousTaches) ? parsed.sousTaches.slice(0, nombre) : [] })
  } catch (e) {
    return json({ error: `appel Claude échoué : ${(e as Error).message}` }, 502)
  }
}
```

> Si `tsc` se plaint du champ `output_config` (selon la version typée du SDK), le `as Anthropic.MessageCreateParamsNonStreaming` couvre le cast. `PagesFunction` est fourni par les types Cloudflare (Step 3).

- [ ] **Step 3 : Types Cloudflare pour le dossier `functions`**

Créer `functions/tsconfig.json` :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["**/*.ts"]
}
```

Run: `npm install -D @cloudflare/workers-types`
Expected: ajout dans `devDependencies`.

- [ ] **Step 4 : Fichiers d'environnement**

Créer `.dev.vars.example` :

```
# Copie ce fichier en .dev.vars (gitignoré) et renseigne ta clé.
# Utilisé par `wrangler pages dev`. NE PAS committer .dev.vars.
ANTHROPIC_API_KEY=sk-ant-...
```

Ajouter à `.gitignore` (créer le fichier s'il n'existe pas) la ligne :

```
.dev.vars
```

- [ ] **Step 5 : Script de dev Cloudflare**

Dans `package.json`, dans `"scripts"`, ajouter après `"dev": "vite",` :

```json
    "dev:cf": "wrangler pages dev -- npm run dev",
```

> `wrangler pages dev` sert les fonctions `functions/` ET proxifie le serveur Vite, donc `/api/decoupe` est joignable en local avec la clé de `.dev.vars`.

- [ ] **Step 6 : Vérifier la compilation de la fonction**

Run: `npx tsc --noEmit -p functions/tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 7 : Commit**

```bash
git add functions/api/decoupe.ts functions/tsconfig.json .dev.vars.example .gitignore package.json package-lock.json
git commit -m "feat: Pages Function /api/decoupe (Claude Haiku, clé côté serveur)"
```

---

## Task 8 : UI du panneau de découpe dans le Tunnel

**Files:**
- Modify: `src/renderer/src/screens/TunnelScreen.tsx`

- [ ] **Step 1 : Ajouter l'état et la logique**

Dans `TunnelScreen`, après les `useState` existants (après `const [voirReste, setVoirReste] = useState(false)`), ajouter :

```tsx
  // ── Découpe en sous-tâches ──
  const [decoupeOuvert, setDecoupeOuvert] = useState(false)
  const [nombre, setNombre] = useState(3)
  const [phaseDecoupe, setPhaseDecoupe] = useState<'idle' | 'chargement' | 'edition'>('idle')
  const [propositions, setPropositions] = useState<string[]>([])

  function ouvrirDecoupe(): void {
    setDecoupeOuvert(true)
    setPhaseDecoupe('idle')
    setNombre(3)
    setPropositions([])
  }

  async function proposer(t: TacheDTO): Promise<void> {
    setPhaseDecoupe('chargement')
    try {
      const st = await window.api.decouperTache(
        { titre: t.titre, description: t.description, pourquoi: t.pourquoi, categorie: t.categorie },
        nombre
      )
      setPropositions(st.length > 0 ? st.map((s) => s.titre) : Array(nombre).fill(''))
    } catch {
      // Repli gracieux : champs vides à remplir à la main
      setPropositions(Array(nombre).fill(''))
    }
    setPhaseDecoupe('edition')
  }

  async function creerLesSousTaches(parent: TacheDTO): Promise<void> {
    const titres = propositions.map((p) => p.trim()).filter(Boolean)
    if (titres.length === 0) return
    await window.api.creerSousTaches(parent.id, titres.map((titre) => ({ titre })))
    setDecoupeOuvert(false)
    setPhaseDecoupe('idle')
    setPropositions([])
    await charger()
  }
```

- [ ] **Step 2 : Ajouter le bouton « Découper » sur la carte « Maintenant »**

Dans le bloc « MAINTENANT », dans la `div.row` des boutons (après le bouton `✓ Fait`), ajouter un 3ᵉ bouton :

```tsx
                <button className="btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={ouvrirDecoupe}>
                  ✂️ Découper
                </button>
```

- [ ] **Step 3 : Ajouter le panneau de découpe**

Juste après la `div.row` des boutons (et toujours à l'intérieur de la carte `card-glow`), ajouter :

```tsx
              {decoupeOuvert && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  {phaseDecoupe === 'idle' && (
                    <div className="col" style={{ gap: 12 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                        En combien de sous-tâches découper « {maintenant.titre} » ?
                      </div>
                      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                        <button className="btn-ghost" onClick={() => setNombre((n) => Math.max(2, n - 1))}>−</button>
                        <div style={{ fontSize: 20, fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{nombre}</div>
                        <button className="btn-ghost" onClick={() => setNombre((n) => Math.min(6, n + 1))}>+</button>
                        <button className="btn-launch" style={{ flex: 1 }} onClick={() => proposer(maintenant)}>
                          ✨ Proposer
                        </button>
                      </div>
                    </div>
                  )}

                  {phaseDecoupe === 'chargement' && (
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', padding: '8px 0' }}>
                      ✨ Je réfléchis à des sous-tâches…
                    </div>
                  )}

                  {phaseDecoupe === 'edition' && (
                    <div className="col" style={{ gap: 8 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        Modifie, ajoute ou supprime les sous-tâches, puis crée-les :
                      </div>
                      {propositions.map((p, i) => (
                        <div key={i} className="row" style={{ gap: 6 }}>
                          <input
                            value={p}
                            placeholder={`Sous-tâche ${i + 1}`}
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
                        <button className="btn-launch" style={{ flex: 2 }} onClick={() => creerLesSousTaches(maintenant)}>
                          ✓ Créer les sous-tâches
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
```

- [ ] **Step 4 : Vérifier la compilation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add src/renderer/src/screens/TunnelScreen.tsx
git commit -m "feat: panneau de découpe en sous-tâches dans le Tunnel"
```

---

## Task 9 : Vérification de bout en bout

**Files:** aucun (vérification).

- [ ] **Step 1 : Suite de tests complète**

Run: `npm test`
Expected: toutes les suites PASS.

- [ ] **Step 2 : Type-check + build**

Run: `npm run build`
Expected: `tsc --noEmit` OK puis build Vite réussi.

- [ ] **Step 3 : Repli gracieux sous Vite simple (sans backend)**

Run: `npm run dev`, ouvrir le Tunnel, cliquer « ✂️ Découper » → « ✨ Proposer ».
Expected: comme `/api/decoupe` n'existe pas sous Vite seul, on bascule en mode édition avec **N champs vides** (pas de crash). On peut taper des titres et « Créer les sous-tâches » → la première sous-tâche devient « Maintenant », le parent disparaît de la liste.

- [ ] **Step 4 : Chemin IA réel (optionnel, nécessite la clé)**

Copier `.dev.vars.example` → `.dev.vars`, y mettre une vraie `ANTHROPIC_API_KEY`.
Run: `npm run dev:cf`, ouvrir l'app servie par wrangler, « ✂️ Découper » → choisir 3 → « ✨ Proposer ».
Expected: 3 propositions pertinentes pré-remplies (ex. pour « Préparer mon anniversaire »), éditables, créables.

- [ ] **Step 5 : Vérifier l'auto-complétion du parent dans l'UI**

Terminer une à une les sous-tâches créées.
Expected: à la dernière, la célébration apparaît et le parent disparaît (auto-terminé).

---

## Auto-revue du plan

- **Couverture spec :** migration v9 (T1), parentId/types (T2), listing masquant les parents (T3), creerSousTaches (T4), auto-complétion parent (T5), couche réseau+local (T6), Pages Function Haiku + clé serveur + dev (T7), UI panneau + repli gracieux (T8), vérif e2e (T9). ✅
- **Cohérence des types :** `SousTacheProposee` (T2) utilisé en T6/T7 ; `creerSousTaches(parentId, TacheInput[])` (T2) appelé en T6/T8 ; `decouperTache(input, nombre)` (T2) appelé en T8. ✅
- **Point d'attention Haiku :** pas de `effort` dans l'appel (T7) — conforme à la contrainte « Haiku 4.5 ne supporte pas effort ». ✅
- **Pas de placeholder :** chaque étape contient le code/commande exacts. ✅
