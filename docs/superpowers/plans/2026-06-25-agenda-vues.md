# Agenda multi-vues + base Google Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à NeuroBoost (PWA) un agenda à 3 moteurs de vues (Timeline jour/3j/semaine · Grille de mois · Multi-mois trimestre/semestre/9/12), avec un type `Événement` (catégories, récurrence, rappels), entièrement côté navigateur sur la couche `Db` sql.js — prêt à recevoir une synchro Google Calendar plus tard.

**Architecture :** Logique d'agenda isolée dans `data/agenda.ts` + `data/recurrence.ts` (fonctions pures, testées en TDD sur une DB sql.js en mémoire). Les occurrences de récurrence ne sont jamais stockées : un événement « maître » porte une RRULE (RFC 5545, compatible Google) et les occurrences sont calculées à la volée pour la plage affichée. L'UI (`screens/AgendaScreen.tsx` + `components/agenda/*`) consomme uniquement une liste d'occurrences aplaties.

**Tech Stack :** React 19 + TypeScript, Vite, sql.js (WASM) + IndexedDB (localforage), Vitest (à installer) pour les tests de logique.

**Spec de référence :** [docs/superpowers/specs/2026-06-25-agenda-vues-design.md](../specs/2026-06-25-agenda-vues-design.md)

---

## File Structure

| Fichier | Responsabilité |
|---|---|
| `vitest.config.ts` *(créé)* | Config Vitest (environnement node) |
| `src/renderer/src/data/__tests__/testDb.ts` *(créé)* | Helper de test : DB sql.js en mémoire + MIGRATIONS, conforme à l'interface `Db` |
| `src/renderer/src/data/migrations.ts` *(modifié)* | +1 entrée v8 : `categorie`, `evenement`, `evenement_exception` + seed |
| `src/renderer/src/data/recurrence.ts` *(créé)* | `RecurrenceRule ⇄ RRULE` + expansion d'occurrences (fonctions pures) |
| `src/renderer/src/data/agenda.ts` *(créé)* | CRUD catégories/événements, `listEvenements` (expansion+exceptions), modes d'édition, rappels |
| `src/shared/types.ts` *(modifié)* | DTO agenda + ajouts à `NeuroBoostApi` |
| `src/renderer/src/data/api.ts` *(modifié)* | Branche les méthodes agenda + planifie les rappels (réutilise le mécanisme `setTimeout`+`Notification`) |
| `src/renderer/src/data/agendaNav.ts` *(créé)* | Helpers purs de navigation/plages de dates par vue (testés) |
| `src/renderer/src/screens/AgendaScreen.tsx` *(créé)* | Conteneur : barre nav + sélecteur de vue + moteur actif |
| `src/renderer/src/components/agenda/TimelineView.tsx` *(créé)* | Moteur 1 (jour/3j/semaine) |
| `src/renderer/src/components/agenda/MoisView.tsx` *(créé)* | Moteur 2 (mois) |
| `src/renderer/src/components/agenda/MultiMoisView.tsx` *(créé)* | Moteur 3 (multi-mois) |
| `src/renderer/src/components/agenda/EvenementModal.tsx` *(créé)* | Création/édition + récurrence + rappel + mode |
| `src/renderer/src/components/agenda/CategoriePicker.tsx` *(créé)* | Sélection/création de catégories |
| `src/renderer/src/components/agenda/timelineLayout.ts` *(créé)* | Calcul pur top/height d'une occurrence (testé) |
| `src/renderer/src/App.tsx` *(modifié)* | Onglet sidebar 📅 Agenda |
| `src/renderer/src/assets/main.css` *(modifié)* | Styles agenda |

> **⚠️ CORRECTION DE CHEMINS (importante)** : le fichier de types est en réalité `src/shared/types.ts` (et non `src/renderer/src/shared/types.ts`). Les imports doivent donc suivre la profondeur de `game.ts` :
> - depuis `src/renderer/src/data/*` (recurrence.ts, agenda.ts, agendaNav.ts) → `'../../../shared/types'`
> - depuis `src/renderer/src/screens/*` (AgendaScreen.tsx) → `'../../../shared/types'`
> - depuis `src/renderer/src/components/agenda/*` (nouveau dossier, 1 niveau plus profond) → `'../../../../shared/types'`
>
> Les blocs de code ci-dessous écrivent parfois `'../shared/types'` ou `'../../shared/types'` — **remplacer par le chemin correct ci-dessus**. (Les imports entre fichiers `data/` comme `'./recurrence'`, `'./db'` et `'../data/agendaNav'` / `'../components/agenda/...'` depuis les écrans sont, eux, corrects.)

**Note de convention** (vérifiée dans le code existant) :
- Toutes les fonctions data prennent `db: Db` en 1er argument et utilisent `db.prepare(sql).run/get/all(...)`.
- Les colonnes sont en `snake_case`, mappées en `camelCase` dans les DTO via casts `as`.
- Les timestamps utilisent `datetime('now','localtime')`. Les dates/heures d'événements sont des chaînes `'YYYY-MM-DD HH:MM'` en **heure locale** (comme `rendez_vous.moment`).
- `import type { Db } from './db'` est **type-only** (effacé au runtime) → on peut l'importer dans `agenda.ts`/tests sans tirer le code navigateur de `db.ts` (wasm `?url`, localforage).

---

## Task 1: Infrastructure de test (Vitest + DB en mémoire)

**Files:**
- Modify: `package.json` (devDeps + script `test`)
- Create: `vitest.config.ts`
- Create: `src/renderer/src/data/__tests__/testDb.ts`
- Create: `src/renderer/src/data/__tests__/smoke.test.ts`

- [ ] **Step 1: Installer Vitest**

Run:
```bash
npm install -D vitest@^2.0.0
```
Expected: ajoute `vitest` aux devDependencies sans erreur.

- [ ] **Step 2: Ajouter le script de test**

Modify `package.json` — dans `"scripts"`, ajouter :
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Config Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
```

- [ ] **Step 4: Helper DB de test**

Create `src/renderer/src/data/__tests__/testDb.ts`. Il reproduit l'adaptateur `wrap()` de `db.ts` mais charge sql.js depuis Node (pas d'import `?url`/localforage) et applique les MIGRATIONS :
```ts
// DB sql.js en mémoire pour les tests de logique. Conforme à l'interface `Db`
// utilisée par game.ts/agenda.ts. Aucune persistance, aucune dépendance navigateur.
import initSqlJs, { type Database } from 'sql.js'
import { createRequire } from 'module'
import type { Db } from '../db'
import { MIGRATIONS } from '../migrations'

const require = createRequire(import.meta.url)

function wrap(database: Database): Db {
  return {
    prepare(sql) {
      return {
        get(...params) {
          const stmt = database.prepare(sql)
          try {
            stmt.bind(params as never)
            return stmt.step() ? (stmt.getAsObject() as Record<string, unknown>) : undefined
          } finally {
            stmt.free()
          }
        },
        all(...params) {
          const stmt = database.prepare(sql)
          const rows: Record<string, unknown>[] = []
          try {
            stmt.bind(params as never)
            while (stmt.step()) rows.push(stmt.getAsObject() as Record<string, unknown>)
          } finally {
            stmt.free()
          }
          return rows
        },
        run(...params) {
          database.run(sql, params as never)
          const r = database.exec('SELECT last_insert_rowid() AS id, changes() AS c')
          const vals = r[0]?.values?.[0] ?? [0, 0]
          return { lastInsertRowid: Number(vals[0]), changes: Number(vals[1]) }
        }
      }
    },
    exec(sql) {
      database.exec(sql)
    },
    transaction(fn) {
      return () => {
        database.exec('BEGIN')
        try {
          fn()
          database.exec('COMMIT')
        } catch (e) {
          database.exec('ROLLBACK')
          throw e
        }
      }
    }
  }
}

export async function makeTestDb(): Promise<Db> {
  const SQL = await initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })
  const database = new SQL.Database()
  database.run('PRAGMA foreign_keys = ON')
  for (const migration of MIGRATIONS) database.exec(migration)
  return wrap(database)
}
```

- [ ] **Step 5: Test smoke (prouve que le harness tourne)**

Create `src/renderer/src/data/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'

describe('infra de test', () => {
  it('applique les migrations et lit le profil seed', async () => {
    const db = await makeTestDb()
    const row = db.prepare('SELECT pseudo FROM profil WHERE id = 1').get() as { pseudo: string }
    expect(row.pseudo).toBe('Héros')
  })
})
```

- [ ] **Step 6: Lancer le test**

Run: `npm test`
Expected: PASS (1 test). Si `sql-wasm.wasm` introuvable, vérifier que `sql.js` est bien installé (`node_modules/sql.js/dist/sql-wasm.wasm`).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/renderer/src/data/__tests__/testDb.ts src/renderer/src/data/__tests__/smoke.test.ts
git commit -m "test: infra Vitest + DB sql.js en mémoire pour la logique"
```

---

## Task 2: Migration v8 — tables agenda + seed catégories

**Files:**
- Modify: `src/renderer/src/data/migrations.ts` (ajouter une entrée au tableau `MIGRATIONS`)
- Test: `src/renderer/src/data/__tests__/migration-agenda.test.ts`

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/renderer/src/data/__tests__/migration-agenda.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'

describe('migration v8 agenda', () => {
  it('crée les 4 catégories système', async () => {
    const db = await makeTestDb()
    const rows = db.prepare('SELECT nom, est_systeme FROM categorie ORDER BY id').all() as { nom: string; est_systeme: number }[]
    expect(rows.map((r) => r.nom)).toEqual(['Perso', 'Travail', 'Santé', 'Admin'])
    expect(rows.every((r) => r.est_systeme === 1)).toBe(true)
  })

  it('crée la table evenement avec les colonnes dormantes source/google_id', async () => {
    const db = await makeTestDb()
    const cols = (db.prepare("PRAGMA table_info('evenement')").all() as { name: string }[]).map((c) => c.name)
    expect(cols).toEqual(expect.arrayContaining(['titre', 'debut', 'fin', 'all_day', 'categorie_id', 'recurrence', 'rappel_min', 'source', 'google_id']))
  })

  it('crée la table evenement_exception', async () => {
    const db = await makeTestDb()
    const cols = (db.prepare("PRAGMA table_info('evenement_exception')").all() as { name: string }[]).map((c) => c.name)
    expect(cols).toEqual(expect.arrayContaining(['evenement_id', 'date_occurrence', 'type', 'override_id']))
  })
})
```

- [ ] **Step 2: Lancer le test → échoue**

Run: `npm test -- migration-agenda`
Expected: FAIL (`no such table: categorie`).

- [ ] **Step 3: Ajouter la migration v8**

Modify `src/renderer/src/data/migrations.ts` — ajouter cette entrée **à la fin** du tableau `MIGRATIONS` (après l'entrée v7, en ajoutant une virgule après le backtick de v7) :
```ts
  ,
  // v8 — Agenda : catégories, événements, exceptions de récurrence
  `
  CREATE TABLE categorie (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nom         TEXT NOT NULL,
    couleur     TEXT NOT NULL,
    emoji       TEXT,
    est_systeme INTEGER NOT NULL DEFAULT 0
  );

  INSERT INTO categorie (nom, couleur, emoji, est_systeme) VALUES
    ('Perso',   '#7c3aed', '🟣', 1),
    ('Travail', '#3b82f6', '🔵', 1),
    ('Santé',   '#10b981', '🟢', 1),
    ('Admin',   '#f59e0b', '🟡', 1);

  CREATE TABLE evenement (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    titre        TEXT NOT NULL,
    debut        TEXT NOT NULL,
    fin          TEXT NOT NULL,
    all_day      INTEGER NOT NULL DEFAULT 0,
    categorie_id INTEGER REFERENCES categorie(id) ON DELETE SET NULL,
    description  TEXT,
    tache_id     INTEGER REFERENCES taches(id) ON DELETE SET NULL,
    recurrence   TEXT,
    rappel_min   INTEGER,
    source       TEXT NOT NULL DEFAULT 'local',
    google_id    TEXT,
    cree_le      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_evenement_debut ON evenement(debut);

  CREATE TABLE evenement_exception (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    evenement_id    INTEGER NOT NULL REFERENCES evenement(id) ON DELETE CASCADE,
    date_occurrence TEXT NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('supprimee','deplacee')),
    override_id     INTEGER REFERENCES evenement(id) ON DELETE CASCADE
  );
  CREATE INDEX idx_exception_evenement ON evenement_exception(evenement_id);
  `
```

- [ ] **Step 4: Lancer le test → passe**

Run: `npm test -- migration-agenda`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/data/migrations.ts src/renderer/src/data/__tests__/migration-agenda.test.ts
git commit -m "feat: migration v8 — tables agenda (categorie, evenement, exception)"
```

---

## Task 3: Types agenda

**Files:**
- Modify: `src/renderer/src/shared/types.ts`

> Note : pas de test ici (types purs). Le typecheck du build (`npm run build`) les valide ; les tasks suivantes les exercent.

- [ ] **Step 1: Ajouter les DTO et types agenda**

Modify `src/renderer/src/shared/types.ts` — ajouter avant la section `// ─── API IPC ───` :
```ts
// ─── Agenda ───────────────────────────────────────────────────────────────────

export type JourSemaine = 'LU' | 'MA' | 'ME' | 'JE' | 'VE' | 'SA' | 'DI'
export type FreqRecurrence = 'quotidien' | 'hebdo' | 'mensuel' | 'annuel'

export interface RecurrenceRule {
  freq: FreqRecurrence
  intervalle: number // >= 1
  jours?: JourSemaine[] // hebdo uniquement
  fin?: { type: 'date'; date: string } | { type: 'count'; count: number }
}

export interface CategorieDTO {
  id: number
  nom: string
  couleur: string
  emoji: string | null
  estSysteme: boolean
}

export interface EvenementInput {
  titre: string
  debut: string // 'YYYY-MM-DD HH:MM'
  fin: string
  allDay?: boolean
  categorieId?: number | null
  description?: string | null
  tacheId?: number | null
  recurrence?: RecurrenceRule | null
  rappelMin?: number | null
}

// Le « maître » tel que stocké
export interface EvenementDTO {
  id: number
  titre: string
  debut: string
  fin: string
  allDay: boolean
  categorieId: number | null
  description: string | null
  tacheId: number | null
  recurrence: RecurrenceRule | null
  rappelMin: number | null
}

// Une occurrence aplatie (ce que consomment les vues)
export interface OccurrenceDTO {
  masterId: number
  dateOccurrence: string // 'YYYY-MM-DD' de l'occurrence
  titre: string
  debut: string // 'YYYY-MM-DD HH:MM' de CETTE occurrence
  fin: string
  allDay: boolean
  categorie: CategorieDTO | null
  description: string | null
  tacheId: number | null
  estRecurrent: boolean
  rappelMin: number | null
}

export type ModeRecurrence = 'occurrence' | 'suivantes' | 'serie'

export interface RappelOccurrence {
  masterId: number
  dateOccurrence: string
  titre: string
  debut: string
  rappelMin: number
}
```

- [ ] **Step 2: Ajouter les signatures à `NeuroBoostApi`**

Modify `src/renderer/src/shared/types.ts` — dans l'interface `NeuroBoostApi`, juste avant la fermeture `}`, ajouter :
```ts
  // Agenda
  listCategories: () => Promise<CategorieDTO[]>
  createCategorie: (nom: string, couleur: string, emoji: string | null) => Promise<CategorieDTO>
  deleteCategorie: (id: number) => Promise<void>
  listEvenements: (debut: string, fin: string) => Promise<OccurrenceDTO[]>
  createEvenement: (input: EvenementInput) => Promise<EvenementDTO>
  updateEvenement: (masterId: number, dateOccurrence: string, mode: ModeRecurrence, input: Partial<EvenementInput>) => Promise<void>
  deleteEvenement: (masterId: number, dateOccurrence: string, mode: ModeRecurrence) => Promise<void>
```

- [ ] **Step 3: Vérifier le typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS (aucune nouvelle erreur). Des erreurs « manquant dans le type 'NeuroBoostApi' » apparaîtront dans `api.ts` — **c'est attendu**, elles seront résolues en Task 8. Si tu veux un typecheck vert ici, passe ce step et reviens-y après Task 8.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/shared/types.ts
git commit -m "feat: types agenda (DTO événements/catégories/occurrences + API)"
```

---

## Task 4: Récurrence — sérialisation RRULE (aller-retour)

**Files:**
- Create: `src/renderer/src/data/recurrence.ts`
- Test: `src/renderer/src/data/__tests__/recurrence-rrule.test.ts`

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/renderer/src/data/__tests__/recurrence-rrule.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { serialiserRRULE, parserRRULE } from '../recurrence'
import type { RecurrenceRule } from '../../shared/types'

describe('serialiserRRULE', () => {
  it('quotidien simple', () => {
    expect(serialiserRRULE({ freq: 'quotidien', intervalle: 1 })).toBe('FREQ=DAILY')
  })
  it('hebdo multi-jours avec intervalle', () => {
    expect(serialiserRRULE({ freq: 'hebdo', intervalle: 2, jours: ['LU', 'ME'] }))
      .toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE')
  })
  it('mensuel avec UNTIL', () => {
    expect(serialiserRRULE({ freq: 'mensuel', intervalle: 1, fin: { type: 'date', date: '2026-09-01' } }))
      .toBe('FREQ=MONTHLY;UNTIL=20260901')
  })
  it('annuel avec COUNT', () => {
    expect(serialiserRRULE({ freq: 'annuel', intervalle: 1, fin: { type: 'count', count: 5 } }))
      .toBe('FREQ=YEARLY;COUNT=5')
  })
})

describe('parserRRULE (aller-retour)', () => {
  const cas: RecurrenceRule[] = [
    { freq: 'quotidien', intervalle: 1 },
    { freq: 'hebdo', intervalle: 2, jours: ['LU', 'ME', 'VE'] },
    { freq: 'mensuel', intervalle: 3, fin: { type: 'date', date: '2026-09-01' } },
    { freq: 'annuel', intervalle: 1, fin: { type: 'count', count: 4 } }
  ]
  for (const rule of cas) {
    it(JSON.stringify(rule), () => {
      expect(parserRRULE(serialiserRRULE(rule))).toEqual(rule)
    })
  }
})
```

- [ ] **Step 2: Lancer → échoue**

Run: `npm test -- recurrence-rrule`
Expected: FAIL (`recurrence.ts` introuvable).

- [ ] **Step 3: Implémenter la sérialisation**

Create `src/renderer/src/data/recurrence.ts`:
```ts
// Conversion RecurrenceRule <-> RRULE (sous-ensemble RFC 5545 compatible Google
// Calendar) + expansion d'occurrences. Fonctions pures, sans accès DB.
import type { RecurrenceRule, FreqRecurrence, JourSemaine } from '../shared/types'

const FREQ_VERS_RRULE: Record<FreqRecurrence, string> = {
  quotidien: 'DAILY',
  hebdo: 'WEEKLY',
  mensuel: 'MONTHLY',
  annuel: 'YEARLY'
}
const RRULE_VERS_FREQ: Record<string, FreqRecurrence> = {
  DAILY: 'quotidien',
  WEEKLY: 'hebdo',
  MONTHLY: 'mensuel',
  YEARLY: 'annuel'
}
const JOUR_VERS_RRULE: Record<JourSemaine, string> = {
  LU: 'MO', MA: 'TU', ME: 'WE', JE: 'TH', VE: 'FR', SA: 'SA', DI: 'SU'
}
const RRULE_VERS_JOUR: Record<string, JourSemaine> = {
  MO: 'LU', TU: 'MA', WE: 'ME', TH: 'JE', FR: 'VE', SA: 'SA', SU: 'DI'
}

export function serialiserRRULE(rule: RecurrenceRule): string {
  const parts = [`FREQ=${FREQ_VERS_RRULE[rule.freq]}`]
  if (rule.intervalle > 1) parts.push(`INTERVAL=${rule.intervalle}`)
  if (rule.jours && rule.jours.length > 0) {
    parts.push(`BYDAY=${rule.jours.map((j) => JOUR_VERS_RRULE[j]).join(',')}`)
  }
  if (rule.fin?.type === 'date') parts.push(`UNTIL=${rule.fin.date.replace(/-/g, '')}`)
  else if (rule.fin?.type === 'count') parts.push(`COUNT=${rule.fin.count}`)
  return parts.join(';')
}

export function parserRRULE(s: string): RecurrenceRule {
  const map = new Map<string, string>()
  for (const part of s.split(';')) {
    const [k, v] = part.split('=')
    if (k && v) map.set(k, v)
  }
  const rule: RecurrenceRule = {
    freq: RRULE_VERS_FREQ[map.get('FREQ') ?? 'DAILY'] ?? 'quotidien',
    intervalle: map.has('INTERVAL') ? Number(map.get('INTERVAL')) : 1
  }
  const byday = map.get('BYDAY')
  if (byday) rule.jours = byday.split(',').map((d) => RRULE_VERS_JOUR[d]).filter(Boolean) as JourSemaine[]
  const until = map.get('UNTIL')
  const count = map.get('COUNT')
  if (until) {
    const d = `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}`
    rule.fin = { type: 'date', date: d }
  } else if (count) {
    rule.fin = { type: 'count', count: Number(count) }
  }
  return rule
}
```

- [ ] **Step 4: Lancer → passe**

Run: `npm test -- recurrence-rrule`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/data/recurrence.ts src/renderer/src/data/__tests__/recurrence-rrule.test.ts
git commit -m "feat: conversion RecurrenceRule <-> RRULE (sous-ensemble RFC 5545)"
```

---

## Task 5: Récurrence — expansion des occurrences

**Files:**
- Modify: `src/renderer/src/data/recurrence.ts`
- Test: `src/renderer/src/data/__tests__/recurrence-expand.test.ts`

Concept : `expanseRecurrence(rule, debutMaitre, fenetreDebut, fenetreFin)` renvoie les **dates de début** `'YYYY-MM-DD HH:MM'` des occurrences dont le jour tombe dans `[fenetreDebut, fenetreFin]` (bornes en `'YYYY-MM-DD'`, inclusives). `COUNT` se compte depuis `debutMaitre`. On itère en heure locale via des helpers de date.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/renderer/src/data/__tests__/recurrence-expand.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { expanseRecurrence } from '../recurrence'
import type { RecurrenceRule } from '../../shared/types'

const debutMaitre = '2026-06-01 09:00' // lundi 1er juin 2026

describe('expanseRecurrence', () => {
  it('quotidien dans une fenêtre de 3 jours', () => {
    const rule: RecurrenceRule = { freq: 'quotidien', intervalle: 1 }
    const occ = expanseRecurrence(rule, debutMaitre, '2026-06-01', '2026-06-03')
    expect(occ).toEqual(['2026-06-01 09:00', '2026-06-02 09:00', '2026-06-03 09:00'])
  })

  it('quotidien avec intervalle 2', () => {
    const rule: RecurrenceRule = { freq: 'quotidien', intervalle: 2 }
    const occ = expanseRecurrence(rule, debutMaitre, '2026-06-01', '2026-06-05')
    expect(occ).toEqual(['2026-06-01 09:00', '2026-06-03 09:00', '2026-06-05 09:00'])
  })

  it('hebdo multi-jours (LU, ME)', () => {
    const rule: RecurrenceRule = { freq: 'hebdo', intervalle: 1, jours: ['LU', 'ME'] }
    const occ = expanseRecurrence(rule, debutMaitre, '2026-06-01', '2026-06-10')
    // lun 1, mer 3, lun 8, mer 10
    expect(occ).toEqual(['2026-06-01 09:00', '2026-06-03 09:00', '2026-06-08 09:00', '2026-06-10 09:00'])
  })

  it('respecte COUNT depuis le début du maître', () => {
    const rule: RecurrenceRule = { freq: 'quotidien', intervalle: 1, fin: { type: 'count', count: 2 } }
    const occ = expanseRecurrence(rule, debutMaitre, '2026-06-01', '2026-06-30')
    expect(occ).toEqual(['2026-06-01 09:00', '2026-06-02 09:00'])
  })

  it('respecte UNTIL (inclusif)', () => {
    const rule: RecurrenceRule = { freq: 'quotidien', intervalle: 1, fin: { type: 'date', date: '2026-06-02' } }
    const occ = expanseRecurrence(rule, debutMaitre, '2026-06-01', '2026-06-30')
    expect(occ).toEqual(['2026-06-01 09:00', '2026-06-02 09:00'])
  })

  it('mensuel garde le quantième', () => {
    const rule: RecurrenceRule = { freq: 'mensuel', intervalle: 1 }
    const occ = expanseRecurrence(rule, '2026-01-15 10:00', '2026-01-01', '2026-04-30')
    expect(occ).toEqual(['2026-01-15 10:00', '2026-02-15 10:00', '2026-03-15 10:00', '2026-04-15 10:00'])
  })

  it('ne renvoie rien avant le début du maître', () => {
    const rule: RecurrenceRule = { freq: 'quotidien', intervalle: 1 }
    const occ = expanseRecurrence(rule, '2026-06-10 09:00', '2026-06-01', '2026-06-09')
    expect(occ).toEqual([])
  })
})
```

- [ ] **Step 2: Lancer → échoue**

Run: `npm test -- recurrence-expand`
Expected: FAIL (`expanseRecurrence` non exporté).

- [ ] **Step 3: Implémenter l'expansion**

Modify `src/renderer/src/data/recurrence.ts` — ajouter à la fin :
```ts
// ─── Helpers de date (heure locale, sans dépendance) ──────────────────────────

const ORDRE_JOURS: JourSemaine[] = ['DI', 'LU', 'MA', 'ME', 'JE', 'VE', 'SA'] // index = getDay()

function p2(n: number): string {
  return n.toString().padStart(2, '0')
}

// 'YYYY-MM-DD HH:MM' -> Date locale
function parseDateTime(s: string): Date {
  const [d, t] = s.split(' ')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi] = (t ?? '00:00').split(':').map(Number)
  return new Date(y, mo - 1, da, h, mi, 0, 0)
}

function fmtDateTime(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

// Compare uniquement la partie date (YYYY-MM-DD) de deux Date locales
function jour(d: Date): string {
  return fmtDate(d)
}

// Renvoie les débuts d'occurrences (chaînes 'YYYY-MM-DD HH:MM') dont le JOUR est
// dans [fenetreDebut, fenetreFin] (inclusif). Garde-fou: 5000 itérations max.
export function expanseRecurrence(
  rule: RecurrenceRule,
  debutMaitre: string,
  fenetreDebut: string,
  fenetreFin: string
): string[] {
  const depart = parseDateTime(debutMaitre)
  const heures = depart.getHours()
  const minutes = depart.getMinutes()
  const untilJour = rule.fin?.type === 'date' ? rule.fin.date : null
  const maxCount = rule.fin?.type === 'count' ? rule.fin.count : Infinity

  const resultats: string[] = []
  let nbGeneres = 0 // compteur global pour COUNT (depuis le maître)
  const GARDE = 5000

  // Itérateur de "candidats" selon la fréquence.
  // Pour hebdo multi-jours, on déroule semaine par semaine.
  const candidats: Date[] = []
  const ajoute = (d: Date): void => {
    d.setHours(heures, minutes, 0, 0)
    candidats.push(new Date(d))
  }

  if (rule.freq === 'hebdo' && rule.jours && rule.jours.length > 0) {
    const joursVoulus = new Set(rule.jours)
    // Début de la semaine (lundi) du maître
    const curseur = new Date(depart)
    curseur.setHours(0, 0, 0, 0)
    const decalLundi = (curseur.getDay() + 6) % 7 // 0 = lundi
    curseur.setDate(curseur.getDate() - decalLundi)
    let semaines = 0
    while (candidats.length < GARDE) {
      for (let i = 0; i < 7; i++) {
        const jourCourant = new Date(curseur)
        jourCourant.setDate(curseur.getDate() + i)
        if (joursVoulus.has(ORDRE_JOURS[jourCourant.getDay()])) ajoute(jourCourant)
      }
      semaines += rule.intervalle
      curseur.setDate(curseur.getDate() + 7 * rule.intervalle)
      if (jour(curseur) > fenetreFin && jour(curseur) > (untilJour ?? '')) break
      if (semaines > GARDE) break
    }
    candidats.sort((a, b) => a.getTime() - b.getTime())
  } else {
    const curseur = new Date(depart)
    for (let i = 0; i < GARDE; i++) {
      ajoute(curseur)
      if (rule.freq === 'quotidien') curseur.setDate(curseur.getDate() + rule.intervalle)
      else if (rule.freq === 'mensuel') curseur.setMonth(curseur.getMonth() + rule.intervalle)
      else if (rule.freq === 'annuel') curseur.setFullYear(curseur.getFullYear() + rule.intervalle)
      else curseur.setDate(curseur.getDate() + rule.intervalle) // hebdo sans jours = même jour chaque N semaines → ramené à +7N jours plus bas
      if (rule.freq === 'hebdo') curseur.setDate(curseur.getDate() + (7 * rule.intervalle - rule.intervalle))
      if (jour(curseur) > fenetreFin && (untilJour === null || jour(curseur) > untilJour)) break
    }
  }

  for (const d of candidats) {
    const jd = jour(d)
    if (jd < jour(depart)) continue // jamais avant le maître
    if (untilJour !== null && jd > untilJour) break
    nbGeneres++
    if (nbGeneres > maxCount) break
    if (jd >= fenetreDebut && jd <= fenetreFin) resultats.push(fmtDateTime(d))
  }
  return resultats
}

// Réexport interne pour agenda.ts (durée d'une occurrence)
export { parseDateTime, fmtDateTime }
```

> **Note d'implémentation hebdo sans `jours`** : ce cas (récurrence hebdo sans BYDAY) est ramené à « tous les 7×N jours à partir du maître ». La branche `else` ci-dessus gère ça ; en pratique l'UI fournira toujours `jours` pour l'hebdo, mais le garde-fou évite une boucle infinie.

- [ ] **Step 4: Lancer → passe**

Run: `npm test -- recurrence-expand`
Expected: PASS (7 tests). Si le cas hebdo échoue sur l'ordre, vérifier le `candidats.sort`.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/data/recurrence.ts src/renderer/src/data/__tests__/recurrence-expand.test.ts
git commit -m "feat: expansion d'occurrences de récurrence (jour/hebdo/mois/an, COUNT/UNTIL)"
```

---

## Task 6: agenda.ts — CRUD catégories

**Files:**
- Create: `src/renderer/src/data/agenda.ts`
- Test: `src/renderer/src/data/__tests__/agenda-categories.test.ts`

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/renderer/src/data/__tests__/agenda-categories.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'
import * as A from '../agenda'

describe('catégories', () => {
  it('liste les 4 catégories système', async () => {
    const db = await makeTestDb()
    const cats = A.listCategories(db)
    expect(cats).toHaveLength(4)
    expect(cats[0]).toMatchObject({ nom: 'Perso', couleur: '#7c3aed', estSysteme: true })
  })

  it('crée puis supprime une catégorie perso', async () => {
    const db = await makeTestDb()
    const cat = A.createCategorie(db, 'Sport', '#ef4444', '🏃')
    expect(cat).toMatchObject({ nom: 'Sport', estSysteme: false })
    expect(A.listCategories(db)).toHaveLength(5)
    A.deleteCategorie(db, cat.id)
    expect(A.listCategories(db)).toHaveLength(4)
  })

  it('refuse de supprimer une catégorie système', async () => {
    const db = await makeTestDb()
    A.deleteCategorie(db, 1) // Perso (système)
    expect(A.listCategories(db)).toHaveLength(4)
  })
})
```

- [ ] **Step 2: Lancer → échoue**

Run: `npm test -- agenda-categories`
Expected: FAIL (`agenda.ts` introuvable).

- [ ] **Step 3: Implémenter le CRUD catégories**

Create `src/renderer/src/data/agenda.ts`:
```ts
// Logique d'agenda : CRUD catégories/événements, expansion des occurrences,
// modes d'édition récurrente, rappels. Ne dépend que de l'interface `Db`.
import type { Db } from './db'
import type { CategorieDTO } from '../shared/types'

// ─── Catégories ───────────────────────────────────────────────────────────────

function catToDTO(r: Record<string, unknown>): CategorieDTO {
  return {
    id: r.id as number,
    nom: r.nom as string,
    couleur: r.couleur as string,
    emoji: (r.emoji as string | null) ?? null,
    estSysteme: Boolean(r.est_systeme)
  }
}

export function listCategories(db: Db): CategorieDTO[] {
  return (db.prepare('SELECT * FROM categorie ORDER BY id').all() as Record<string, unknown>[]).map(catToDTO)
}

export function createCategorie(db: Db, nom: string, couleur: string, emoji: string | null): CategorieDTO {
  const res = db.prepare('INSERT INTO categorie (nom, couleur, emoji, est_systeme) VALUES (?, ?, ?, 0)')
    .run(nom, couleur, emoji)
  return catToDTO(db.prepare('SELECT * FROM categorie WHERE id = ?').get(res.lastInsertRowid) as Record<string, unknown>)
}

export function deleteCategorie(db: Db, id: number): void {
  // Les catégories système (est_systeme = 1) sont protégées.
  db.prepare('DELETE FROM categorie WHERE id = ? AND est_systeme = 0').run(id)
}
```

- [ ] **Step 4: Lancer → passe**

Run: `npm test -- agenda-categories`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/data/agenda.ts src/renderer/src/data/__tests__/agenda-categories.test.ts
git commit -m "feat: agenda.ts — CRUD catégories (système protégées)"
```

---

## Task 7: agenda.ts — créer un événement + lister les occurrences

**Files:**
- Modify: `src/renderer/src/data/agenda.ts`
- Test: `src/renderer/src/data/__tests__/agenda-evenements.test.ts`

`listEvenements(db, debut, fin)` (bornes `'YYYY-MM-DD'`) :
1. lit les maîtres dont la plage croise la fenêtre **OU** qui sont récurrents, **en excluant** tout `evenement` référencé comme `override_id` (anti-double-comptage) ;
2. pour chaque maître : si non récurrent → 1 occurrence si dans la fenêtre ; si récurrent → `expanseRecurrence` ;
3. retire les occurrences ayant une exception `supprimee` ;
4. remplace les occurrences `deplacee` par leur override.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/renderer/src/data/__tests__/agenda-evenements.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'
import * as A from '../agenda'

describe('événements & occurrences', () => {
  it('crée un événement ponctuel et le retrouve dans la fenêtre', async () => {
    const db = await makeTestDb()
    const ev = A.createEvenement(db, { titre: 'Dentiste', debut: '2026-06-10 14:00', fin: '2026-06-10 15:00', categorieId: 4 })
    expect(ev.id).toBeGreaterThan(0)
    const occ = A.listEvenements(db, '2026-06-08', '2026-06-12')
    expect(occ).toHaveLength(1)
    expect(occ[0]).toMatchObject({ titre: 'Dentiste', masterId: ev.id, estRecurrent: false })
    expect(occ[0].categorie?.nom).toBe('Admin')
  })

  it('exclut un événement hors fenêtre', async () => {
    const db = await makeTestDb()
    A.createEvenement(db, { titre: 'Loin', debut: '2026-07-10 14:00', fin: '2026-07-10 15:00' })
    expect(A.listEvenements(db, '2026-06-01', '2026-06-30')).toHaveLength(0)
  })

  it('déroule un événement récurrent hebdomadaire', async () => {
    const db = await makeTestDb()
    A.createEvenement(db, {
      titre: 'Sport', debut: '2026-06-01 18:00', fin: '2026-06-01 19:00',
      recurrence: { freq: 'hebdo', intervalle: 1, jours: ['LU'] }
    })
    const occ = A.listEvenements(db, '2026-06-01', '2026-06-30')
    expect(occ.map((o) => o.dateOccurrence)).toEqual(['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29'])
    expect(occ.every((o) => o.estRecurrent)).toBe(true)
  })
})
```

- [ ] **Step 2: Lancer → échoue**

Run: `npm test -- agenda-evenements`
Expected: FAIL (`createEvenement` non exporté).

- [ ] **Step 3: Implémenter create + listEvenements**

Modify `src/renderer/src/data/agenda.ts` — ajouter les imports en tête puis le code :
```ts
// (en haut du fichier, compléter les imports)
import type { EvenementDTO, EvenementInput, OccurrenceDTO, RecurrenceRule } from '../shared/types'
import { serialiserRRULE, parserRRULE, expanseRecurrence, parseDateTime, fmtDateTime } from './recurrence'
```
```ts
// ─── Événements ───────────────────────────────────────────────────────────────

function evToDTO(r: Record<string, unknown>): EvenementDTO {
  const rrule = r.recurrence as string | null
  return {
    id: r.id as number,
    titre: r.titre as string,
    debut: r.debut as string,
    fin: r.fin as string,
    allDay: Boolean(r.all_day),
    categorieId: (r.categorie_id as number | null) ?? null,
    description: (r.description as string | null) ?? null,
    tacheId: (r.tache_id as number | null) ?? null,
    recurrence: rrule ? parserRRULE(rrule) : null,
    rappelMin: (r.rappel_min as number | null) ?? null
  }
}

function getMaster(db: Db, id: number): Record<string, unknown> | undefined {
  return db.prepare('SELECT * FROM evenement WHERE id = ?').get(id) as Record<string, unknown> | undefined
}

export function createEvenement(db: Db, input: EvenementInput): EvenementDTO {
  const rrule = input.recurrence ? serialiserRRULE(input.recurrence) : null
  const res = db.prepare(`
    INSERT INTO evenement (titre, debut, fin, all_day, categorie_id, description, tache_id, recurrence, rappel_min)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.titre, input.debut, input.fin, input.allDay ? 1 : 0,
    input.categorieId ?? null, input.description ?? null, input.tacheId ?? null,
    rrule, input.rappelMin ?? null
  )
  return evToDTO(getMaster(db, Number(res.lastInsertRowid)) as Record<string, unknown>)
}

// Durée d'un maître en millisecondes (pour reporter la fin sur une occurrence)
function dureeMs(debut: string, fin: string): number {
  return parseDateTime(fin).getTime() - parseDateTime(debut).getTime()
}

function finDepuisDebut(debutOcc: string, dureeMs: number): string {
  return fmtDateTime(new Date(parseDateTime(debutOcc).getTime() + dureeMs))
}

function occToDTO(
  master: Record<string, unknown>,
  debutOcc: string,
  dateOcc: string,
  estRecurrent: boolean,
  categories: Map<number, CategorieDTO>
): OccurrenceDTO {
  const ev = evToDTO(master)
  return {
    masterId: ev.id,
    dateOccurrence: dateOcc,
    titre: ev.titre,
    debut: debutOcc,
    fin: finDepuisDebut(debutOcc, dureeMs(ev.debut, ev.fin)),
    allDay: ev.allDay,
    categorie: ev.categorieId ? (categories.get(ev.categorieId) ?? null) : null,
    description: ev.description,
    tacheId: ev.tacheId,
    estRecurrent,
    rappelMin: ev.rappelMin
  }
}

export function listEvenements(db: Db, fenetreDebut: string, fenetreFin: string): OccurrenceDTO[] {
  const cats = new Map(listCategories(db).map((c) => [c.id, c]))

  // Maîtres candidats : non référencés comme override, et (récurrents OU croisant la fenêtre)
  const masters = db.prepare(`
    SELECT * FROM evenement
    WHERE id NOT IN (SELECT override_id FROM evenement_exception WHERE override_id IS NOT NULL)
      AND (recurrence IS NOT NULL OR (date(debut) <= ? AND date(fin) >= ?))
  `).all(fenetreFin, fenetreDebut) as Record<string, unknown>[]

  const occurrences: OccurrenceDTO[] = []

  for (const m of masters) {
    const exceptions = db.prepare('SELECT * FROM evenement_exception WHERE evenement_id = ?')
      .all(m.id) as Record<string, unknown>[]
    const supprimees = new Set(exceptions.filter((e) => e.type === 'supprimee').map((e) => e.date_occurrence as string))
    const deplacees = new Map(
      exceptions.filter((e) => e.type === 'deplacee' && e.override_id != null)
        .map((e) => [e.date_occurrence as string, e.override_id as number])
    )

    const rrule = m.recurrence as string | null
    if (!rrule) {
      const dateOcc = (m.debut as string).slice(0, 10)
      if (dateOcc >= fenetreDebut && dateOcc <= fenetreFin) {
        occurrences.push(occToDTO(m, m.debut as string, dateOcc, false, cats))
      }
      continue
    }

    const rule = parserRRULE(rrule)
    for (const debutOcc of expanseRecurrence(rule, m.debut as string, fenetreDebut, fenetreFin)) {
      const dateOcc = debutOcc.slice(0, 10)
      if (supprimees.has(dateOcc)) continue
      const overrideId = deplacees.get(dateOcc)
      if (overrideId != null) {
        const ov = getMaster(db, overrideId)
        if (ov) {
          const od = (ov.debut as string).slice(0, 10)
          if (od >= fenetreDebut && od <= fenetreFin) {
            occurrences.push(occToDTO(ov, ov.debut as string, dateOcc, true, cats))
          }
        }
        continue
      }
      occurrences.push(occToDTO(m, debutOcc, dateOcc, true, cats))
    }
  }

  occurrences.sort((a, b) => a.debut.localeCompare(b.debut))
  return occurrences
}
```

- [ ] **Step 4: Lancer → passe**

Run: `npm test -- agenda-evenements`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/data/agenda.ts src/renderer/src/data/__tests__/agenda-evenements.test.ts
git commit -m "feat: agenda.ts — createEvenement + listEvenements (expansion + exceptions)"
```

---

## Task 8: agenda.ts — éditer/supprimer (3 modes) + scission

**Files:**
- Modify: `src/renderer/src/data/agenda.ts`
- Test: `src/renderer/src/data/__tests__/agenda-modes.test.ts`

Règles :
- **serie** : `UPDATE`/`DELETE` direct sur le maître (les exceptions tombent en CASCADE à la suppression).
- **occurrence** :
  - suppression → INSERT exception `supprimee(dateOccurrence)`.
  - édition → crée un événement détaché (override, sans `recurrence`) avec les champs fusionnés, puis INSERT exception `deplacee(dateOccurrence, override_id)`.
- **suivantes** :
  - on pose `UNTIL = veille de dateOccurrence` sur la `recurrence` du maître ;
  - on crée un **nouveau maître** récurrent démarrant à `dateOccurrence`, avec les champs/règle fusionnés ;
  - les exceptions du maître dont `date_occurrence >= dateOccurrence` sont **réaffectées** au nouveau maître ;
  - pour une **suppression** « suivantes », on pose simplement `UNTIL = veille` sans nouveau maître.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/renderer/src/data/__tests__/agenda-modes.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'
import * as A from '../agenda'

async function dbAvecSerie() {
  const db = await makeTestDb()
  const ev = A.createEvenement(db, {
    titre: 'Standup', debut: '2026-06-01 09:00', fin: '2026-06-01 09:15',
    recurrence: { freq: 'quotidien', intervalle: 1 }
  })
  return { db, id: ev.id }
}

describe('modes de récurrence', () => {
  it('supprime une seule occurrence', async () => {
    const { db, id } = await dbAvecSerie()
    A.deleteEvenement(db, id, '2026-06-03', 'occurrence')
    const dates = A.listEvenements(db, '2026-06-01', '2026-06-05').map((o) => o.dateOccurrence)
    expect(dates).toEqual(['2026-06-01', '2026-06-02', '2026-06-04', '2026-06-05'])
  })

  it('édite une seule occurrence (titre)', async () => {
    const { db, id } = await dbAvecSerie()
    A.updateEvenement(db, id, '2026-06-03', 'occurrence', { titre: 'Standup spécial' })
    const occ = A.listEvenements(db, '2026-06-01', '2026-06-05')
    const le3 = occ.find((o) => o.dateOccurrence === '2026-06-03')
    expect(le3?.titre).toBe('Standup spécial')
    expect(occ.filter((o) => o.titre === 'Standup')).toHaveLength(4)
  })

  it('supprime cette occurrence et les suivantes', async () => {
    const { db, id } = await dbAvecSerie()
    A.deleteEvenement(db, id, '2026-06-03', 'suivantes')
    const dates = A.listEvenements(db, '2026-06-01', '2026-06-10').map((o) => o.dateOccurrence)
    expect(dates).toEqual(['2026-06-01', '2026-06-02'])
  })

  it('édite cette occurrence et les suivantes (scission)', async () => {
    const { db, id } = await dbAvecSerie()
    A.updateEvenement(db, id, '2026-06-04', 'suivantes', { titre: 'Standup v2' })
    const occ = A.listEvenements(db, '2026-06-01', '2026-06-06')
    expect(occ.filter((o) => o.titre === 'Standup')).toHaveLength(3)   // 1,2,3
    expect(occ.filter((o) => o.titre === 'Standup v2')).toHaveLength(3) // 4,5,6
  })

  it('édite toute la série', async () => {
    const { db, id } = await dbAvecSerie()
    A.updateEvenement(db, id, '2026-06-03', 'serie', { titre: 'Daily' })
    const occ = A.listEvenements(db, '2026-06-01', '2026-06-05')
    expect(occ.every((o) => o.titre === 'Daily')).toBe(true)
  })

  it('supprime toute la série', async () => {
    const { db, id } = await dbAvecSerie()
    A.deleteEvenement(db, id, '2026-06-03', 'serie')
    expect(A.listEvenements(db, '2026-06-01', '2026-06-30')).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Lancer → échoue**

Run: `npm test -- agenda-modes`
Expected: FAIL (`updateEvenement`/`deleteEvenement` non exportés).

- [ ] **Step 3: Implémenter les modes**

Modify `src/renderer/src/data/agenda.ts` — ajouter à la fin (importer `ModeRecurrence` dans l'import de types existant) :
```ts
// (compléter l'import de types : ajouter ModeRecurrence)
// import type { ..., ModeRecurrence } from '../shared/types'

// Date locale -> veille au format 'YYYY-MM-DD'
function veille(dateOcc: string): string {
  const d = parseDateTime(`${dateOcc} 00:00`)
  d.setDate(d.getDate() - 1)
  return fmtDateTime(d).slice(0, 10)
}

// Fusionne un maître + des champs partiels en colonnes prêtes pour INSERT/UPDATE
function champsFusionnes(master: Record<string, unknown>, input: Partial<EvenementInput>) {
  const base = evToDTO(master)
  return {
    titre: input.titre ?? base.titre,
    debut: input.debut ?? base.debut,
    fin: input.fin ?? base.fin,
    all_day: (input.allDay ?? base.allDay) ? 1 : 0,
    categorie_id: input.categorieId !== undefined ? input.categorieId : base.categorieId,
    description: input.description !== undefined ? input.description : base.description,
    tache_id: input.tacheId !== undefined ? input.tacheId : base.tacheId,
    rappel_min: input.rappelMin !== undefined ? input.rappelMin : base.rappelMin
  }
}

function updateMaster(db: Db, id: number, c: ReturnType<typeof champsFusionnes>, recurrence: string | null): void {
  db.prepare(`
    UPDATE evenement SET titre=?, debut=?, fin=?, all_day=?, categorie_id=?, description=?, tache_id=?, rappel_min=?, recurrence=?
    WHERE id=?
  `).run(c.titre, c.debut, c.fin, c.all_day, c.categorie_id, c.description, c.tache_id, c.rappel_min, recurrence, id)
}

export function deleteEvenement(db: Db, masterId: number, dateOccurrence: string, mode: ModeRecurrence): void {
  if (mode === 'serie') {
    db.prepare('DELETE FROM evenement WHERE id = ?').run(masterId)
    return
  }
  if (mode === 'occurrence') {
    db.prepare("INSERT INTO evenement_exception (evenement_id, date_occurrence, type) VALUES (?, ?, 'supprimee')")
      .run(masterId, dateOccurrence)
    return
  }
  // suivantes : borne le maître à la veille
  const m = getMaster(db, masterId)
  if (!m) return
  const rule = parserRRULE(m.recurrence as string)
  rule.fin = { type: 'date', date: veille(dateOccurrence) }
  db.prepare('UPDATE evenement SET recurrence = ? WHERE id = ?').run(serialiserRRULE(rule), masterId)
  // nettoie les exceptions désormais hors série
  db.prepare('DELETE FROM evenement_exception WHERE evenement_id = ? AND date_occurrence >= ?')
    .run(masterId, dateOccurrence)
}

export function updateEvenement(
  db: Db, masterId: number, dateOccurrence: string, mode: ModeRecurrence, input: Partial<EvenementInput>
): void {
  const m = getMaster(db, masterId)
  if (!m) return
  const recurrenceActuelle = m.recurrence as string | null

  if (mode === 'serie' || !recurrenceActuelle) {
    const c = champsFusionnes(m, input)
    const rrule = input.recurrence !== undefined
      ? (input.recurrence ? serialiserRRULE(input.recurrence) : null)
      : recurrenceActuelle
    updateMaster(db, masterId, c, rrule)
    return
  }

  if (mode === 'occurrence') {
    // crée un override détaché (sans récurrence) + exception 'deplacee'
    const c = champsFusionnes(m, input)
    const res = db.prepare(`
      INSERT INTO evenement (titre, debut, fin, all_day, categorie_id, description, tache_id, recurrence, rappel_min)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
    `).run(c.titre, c.debut, c.fin, c.all_day, c.categorie_id, c.description, c.tache_id, c.rappel_min)
    db.prepare("INSERT INTO evenement_exception (evenement_id, date_occurrence, type, override_id) VALUES (?, ?, 'deplacee', ?)")
      .run(masterId, dateOccurrence, Number(res.lastInsertRowid))
    return
  }

  // suivantes : borne le maître à la veille, crée un nouveau maître à partir de dateOccurrence
  const rule = parserRRULE(recurrenceActuelle)
  const ruleAncienne: RecurrenceRule = { ...rule, fin: { type: 'date', date: veille(dateOccurrence) } }
  db.prepare('UPDATE evenement SET recurrence = ? WHERE id = ?').run(serialiserRRULE(ruleAncienne), masterId)

  const c = champsFusionnes(m, input)
  // le nouveau maître démarre à dateOccurrence en conservant l'heure d'origine
  const heure = (m.debut as string).slice(11)
  const nouveauDebut = input.debut ?? `${dateOccurrence} ${heure}`
  const nouvelleRecurrence = input.recurrence ? serialiserRRULE(input.recurrence) : serialiserRRULE({ ...rule, fin: undefined })
  const res = db.prepare(`
    INSERT INTO evenement (titre, debut, fin, all_day, categorie_id, description, tache_id, recurrence, rappel_min)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    c.titre, nouveauDebut, finDepuisDebut(nouveauDebut, dureeMs(m.debut as string, m.fin as string)),
    c.all_day, c.categorie_id, c.description, c.tache_id, nouvelleRecurrence, c.rappel_min
  )
  // réaffecte les exceptions >= dateOccurrence au nouveau maître
  db.prepare('UPDATE evenement_exception SET evenement_id = ? WHERE evenement_id = ? AND date_occurrence >= ?')
    .run(Number(res.lastInsertRowid), masterId, dateOccurrence)
}
```

- [ ] **Step 4: Lancer → passe**

Run: `npm test -- agenda-modes`
Expected: PASS (6 tests).

- [ ] **Step 5: Lancer toute la suite**

Run: `npm test`
Expected: PASS (tous les tests agenda + récurrence + smoke).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/data/agenda.ts src/renderer/src/data/__tests__/agenda-modes.test.ts
git commit -m "feat: agenda.ts — édition/suppression 3 modes (occurrence/suivantes/série)"
```

---

## Task 9: agenda.ts — rappels à venir

**Files:**
- Modify: `src/renderer/src/data/agenda.ts`
- Test: `src/renderer/src/data/__tests__/agenda-rappels.test.ts`

`listProchainsRappels(db, maintenant, horizonJours)` renvoie, pour les occurrences ayant `rappel_min`, l'objet `RappelOccurrence` dont **l'instant de rappel** (`debut - rappel_min`) est `>= maintenant` et dont l'occurrence tombe avant `maintenant + horizon`.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/renderer/src/data/__tests__/agenda-rappels.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'
import * as A from '../agenda'

describe('rappels', () => {
  it('renvoie les occurrences à rappeler dans l’horizon', async () => {
    const db = await makeTestDb()
    A.createEvenement(db, { titre: 'RDV', debut: '2026-06-02 10:00', fin: '2026-06-02 11:00', rappelMin: 30 })
    A.createEvenement(db, { titre: 'Sans rappel', debut: '2026-06-02 12:00', fin: '2026-06-02 13:00' })
    const rappels = A.listProchainsRappels(db, '2026-06-01 09:00', 14)
    expect(rappels).toHaveLength(1)
    expect(rappels[0]).toMatchObject({ titre: 'RDV', rappelMin: 30, debut: '2026-06-02 10:00' })
  })

  it('ignore un rappel déjà passé', async () => {
    const db = await makeTestDb()
    A.createEvenement(db, { titre: 'Passé', debut: '2026-06-01 09:10', fin: '2026-06-01 09:40', rappelMin: 30 })
    // instant de rappel = 08:40, déjà passé à 09:00
    const rappels = A.listProchainsRappels(db, '2026-06-01 09:00', 14)
    expect(rappels).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Lancer → échoue**

Run: `npm test -- agenda-rappels`
Expected: FAIL (`listProchainsRappels` non exporté).

- [ ] **Step 3: Implémenter**

Modify `src/renderer/src/data/agenda.ts` — ajouter à la fin (compléter l'import de types avec `RappelOccurrence`) :
```ts
// import type { ..., RappelOccurrence } from '../shared/types'

export function listProchainsRappels(db: Db, maintenant: string, horizonJours: number): RappelOccurrence[] {
  const debutFenetre = maintenant.slice(0, 10)
  const finDate = parseDateTime(`${debutFenetre} 00:00`)
  finDate.setDate(finDate.getDate() + horizonJours)
  const finFenetre = fmtDateTime(finDate).slice(0, 10)

  const maintenantMs = parseDateTime(maintenant).getTime()
  const rappels: RappelOccurrence[] = []

  for (const o of listEvenements(db, debutFenetre, finFenetre)) {
    if (o.rappelMin == null) continue
    const instantRappel = parseDateTime(o.debut).getTime() - o.rappelMin * 60_000
    if (instantRappel >= maintenantMs) {
      rappels.push({ masterId: o.masterId, dateOccurrence: o.dateOccurrence, titre: o.titre, debut: o.debut, rappelMin: o.rappelMin })
    }
  }
  rappels.sort((a, b) => a.debut.localeCompare(b.debut))
  return rappels
}
```

- [ ] **Step 4: Lancer → passe**

Run: `npm test -- agenda-rappels`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/data/agenda.ts src/renderer/src/data/__tests__/agenda-rappels.test.ts
git commit -m "feat: agenda.ts — listProchainsRappels (occurrences à notifier)"
```

---

## Task 10: Brancher l'API + planification des rappels

**Files:**
- Modify: `src/renderer/src/data/api.ts`

> Pas de test unitaire ici (couche d'intégration navigateur). Validation par typecheck + build.

- [ ] **Step 1: Importer agenda + helper de date**

Modify `src/renderer/src/data/api.ts` — en tête, après `import * as G from './game'` :
```ts
import * as A from './agenda'
```
Et ajouter un helper local `maintenantLocal()` près des autres helpers de fichier :
```ts
function maintenantLocal(): string {
  const d = new Date()
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
```

- [ ] **Step 2: Planification des rappels d'agenda**

Modify `src/renderer/src/data/api.ts` — ajouter, après la section des timers de rendez-vous (les `const timers = new Map(...)` existants), un second registre dédié à l'agenda :
```ts
// ─── Rappels d'agenda : planification glissante (horizon 14 j) ─────────────────
const HORIZON_RAPPELS = 14
const timersAgenda = new Map<string, ReturnType<typeof setTimeout>>()

function cleRappel(masterId: number, dateOccurrence: string): string {
  return `${masterId}|${dateOccurrence}`
}

function notifierAgenda(titre: string, debut: string): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`⏰ ${titre}`, { body: `Commence à ${debut.slice(11)}` })
  }
}

function replanifierRappelsAgenda(): void {
  for (const t of timersAgenda.values()) clearTimeout(t)
  timersAgenda.clear()
  const maintenant = maintenantLocal()
  for (const r of A.listProchainsRappels(db, maintenant, HORIZON_RAPPELS)) {
    const instant = new Date(r.debut.replace(' ', 'T')).getTime() - r.rappelMin * 60_000
    const delai = instant - Date.now()
    if (delai < 0 || delai > MAX_DELAY) continue
    const cle = cleRappel(r.masterId, r.dateOccurrence)
    timersAgenda.set(cle, setTimeout(() => { notifierAgenda(r.titre, r.debut); timersAgenda.delete(cle) }, delai))
  }
}
```

- [ ] **Step 3: Ajouter les méthodes agenda à `rawApi`**

Modify `src/renderer/src/data/api.ts` — dans l'objet `rawApi`, avant la fermeture, ajouter :
```ts
  // Agenda
  listCategories: async () => A.listCategories(db),
  createCategorie: async (nom, couleur, emoji) => A.createCategorie(db, nom, couleur, emoji),
  deleteCategorie: async (id) => {
    A.deleteCategorie(db, id)
  },
  listEvenements: async (debut, fin) => A.listEvenements(db, debut, fin),
  createEvenement: async (input) => {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission()
    const ev = A.createEvenement(db, input)
    replanifierRappelsAgenda()
    return ev
  },
  updateEvenement: async (masterId, dateOccurrence, mode, input) => {
    A.updateEvenement(db, masterId, dateOccurrence, mode, input)
    replanifierRappelsAgenda()
  },
  deleteEvenement: async (masterId, dateOccurrence, mode) => {
    A.deleteEvenement(db, masterId, dateOccurrence, mode)
    replanifierRappelsAgenda()
  },
```

- [ ] **Step 4: Replanifier au démarrage**

Modify `src/renderer/src/data/api.ts` — dans `initApi()`, après la boucle qui replanifie les rendez-vous (`for (const rv of G.listRendezVousAPlanifier(db)) planifier(rv)`), ajouter :
```ts
  replanifierRappelsAgenda()
```

- [ ] **Step 5: Typecheck + build**

Run: `npm run build`
Expected: PASS (typecheck vert — les méthodes manquantes de `NeuroBoostApi` sont désormais toutes implémentées — et build Vite OK).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/data/api.ts
git commit -m "feat: api — méthodes agenda + planification glissante des rappels"
```

---

## Task 11: Helpers de navigation de dates (purs, testés)

**Files:**
- Create: `src/renderer/src/data/agendaNav.ts`
- Test: `src/renderer/src/data/__tests__/agenda-nav.test.ts`

Ces helpers calculent, pour une **vue** et une **date d'ancrage**, la plage `[debut, fin]` (`'YYYY-MM-DD'`) à charger, le libellé de période, et la date d'ancrage après navigation ‹ ›.

Types de vue : `'jour' | 'troisJours' | 'semaine' | 'mois' | 'trimestre' | 'semestre' | 'neufMois' | 'annee'`.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/renderer/src/data/__tests__/agenda-nav.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { plageVue, libellePeriode, naviguer, type VueAgenda } from '../agendaNav'

describe('agendaNav', () => {
  it('plage jour', () => {
    expect(plageVue('jour', '2026-06-10')).toEqual({ debut: '2026-06-10', fin: '2026-06-10' })
  })
  it('plage semaine (lundi→dimanche) pour un mercredi', () => {
    // 2026-06-10 est un mercredi
    expect(plageVue('semaine', '2026-06-10')).toEqual({ debut: '2026-06-08', fin: '2026-06-14' })
  })
  it('plage mois', () => {
    expect(plageVue('mois', '2026-06-10')).toEqual({ debut: '2026-06-01', fin: '2026-06-30' })
  })
  it('plage trimestre (3 mois à partir du mois courant)', () => {
    expect(plageVue('trimestre', '2026-06-10')).toEqual({ debut: '2026-06-01', fin: '2026-08-31' })
  })
  it('navigation jour suivant', () => {
    expect(naviguer('jour', '2026-06-10', 1)).toBe('2026-06-11')
  })
  it('navigation mois précédent', () => {
    expect(naviguer('mois', '2026-06-10', -1)).toBe('2026-05-10')
  })
  it('libellé mois', () => {
    expect(libellePeriode('mois', '2026-06-10')).toMatch(/juin 2026/i)
  })
})
```

- [ ] **Step 2: Lancer → échoue**

Run: `npm test -- agenda-nav`
Expected: FAIL (`agendaNav.ts` introuvable).

- [ ] **Step 3: Implémenter**

Create `src/renderer/src/data/agendaNav.ts`:
```ts
// Helpers purs de navigation de l'agenda : plage de dates à charger, libellé de
// période, et déplacement ‹ › selon la vue. Dates au format 'YYYY-MM-DD'.
export type VueAgenda =
  | 'jour' | 'troisJours' | 'semaine'
  | 'mois'
  | 'trimestre' | 'semestre' | 'neufMois' | 'annee'

export const NB_MOIS: Record<string, number> = { trimestre: 3, semestre: 6, neufMois: 9, annee: 12 }

const p2 = (n: number): string => n.toString().padStart(2, '0')
const fmt = (d: Date): string => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
const parse = (s: string): Date => {
  const [y, m, j] = s.split('-').map(Number)
  return new Date(y, m - 1, j)
}

function lundiDe(d: Date): Date {
  const r = new Date(d)
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7))
  return r
}

export function plageVue(vue: VueAgenda, ancre: string): { debut: string; fin: string } {
  const d = parse(ancre)
  if (vue === 'jour') return { debut: ancre, fin: ancre }
  if (vue === 'troisJours') {
    const fin = new Date(d); fin.setDate(d.getDate() + 2)
    return { debut: ancre, fin: fmt(fin) }
  }
  if (vue === 'semaine') {
    const lundi = lundiDe(d)
    const dim = new Date(lundi); dim.setDate(lundi.getDate() + 6)
    return { debut: fmt(lundi), fin: fmt(dim) }
  }
  // mois & multi-mois : du 1er du mois d'ancrage au dernier jour du dernier mois
  const nb = vue === 'mois' ? 1 : NB_MOIS[vue]
  const debut = new Date(d.getFullYear(), d.getMonth(), 1)
  const fin = new Date(d.getFullYear(), d.getMonth() + nb, 0) // jour 0 = dernier du mois précédent
  return { debut: fmt(debut), fin: fmt(fin) }
}

export function naviguer(vue: VueAgenda, ancre: string, sens: 1 | -1): string {
  const d = parse(ancre)
  if (vue === 'jour') d.setDate(d.getDate() + sens)
  else if (vue === 'troisJours') d.setDate(d.getDate() + 3 * sens)
  else if (vue === 'semaine') d.setDate(d.getDate() + 7 * sens)
  else if (vue === 'mois') d.setMonth(d.getMonth() + sens)
  else d.setMonth(d.getMonth() + NB_MOIS[vue] * sens)
  return fmt(d)
}

export function libellePeriode(vue: VueAgenda, ancre: string): string {
  const d = parse(ancre)
  if (vue === 'jour' || vue === 'troisJours') {
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  if (vue === 'semaine') {
    const { debut, fin } = plageVue('semaine', ancre)
    return `${parse(debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${parse(fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }
  if (vue === 'mois') return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  const { debut, fin } = plageVue(vue, ancre)
  return `${parse(debut).toLocaleDateString('fr-FR', { month: 'short' })} – ${parse(fin).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`
}
```

- [ ] **Step 4: Lancer → passe**

Run: `npm test -- agenda-nav`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/data/agendaNav.ts src/renderer/src/data/__tests__/agenda-nav.test.ts
git commit -m "feat: helpers purs de navigation d'agenda (plages, libellés, ‹ ›)"
```

---

## Task 12: Calcul de positionnement timeline (pur, testé)

**Files:**
- Create: `src/renderer/src/components/agenda/timelineLayout.ts`
- Test: `src/renderer/src/data/__tests__/timeline-layout.test.ts`

Pur : convertit une occurrence en `{ top, height }` en pixels selon une hauteur d'heure et l'heure de début affichée.

- [ ] **Step 1: Écrire le test (échoue)**

Create `src/renderer/src/data/__tests__/timeline-layout.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { positionOccurrence } from '../../components/agenda/timelineLayout'

describe('positionOccurrence', () => {
  it('place un créneau 10:00–11:00 avec heure de base 8 et 48px/h', () => {
    const r = positionOccurrence('2026-06-10 10:00', '2026-06-10 11:00', 8, 48)
    expect(r).toEqual({ top: 96, height: 48 }) // (10-8)*48=96 ; 1h=48
  })
  it('hauteur minimale de 18px pour un créneau très court', () => {
    const r = positionOccurrence('2026-06-10 10:00', '2026-06-10 10:05', 8, 48)
    expect(r.height).toBe(18)
  })
})
```

- [ ] **Step 2: Lancer → échoue**

Run: `npm test -- timeline-layout`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

Create `src/renderer/src/components/agenda/timelineLayout.ts`:
```ts
// Calcul pur de la position verticale d'une occurrence sur la grille horaire.
function minutesDepuis(debut: string): number {
  const [h, m] = debut.slice(11).split(':').map(Number)
  return h * 60 + m
}

export function positionOccurrence(
  debut: string, fin: string, heureBase: number, pxParHeure: number
): { top: number; height: number } {
  const top = ((minutesDepuis(debut) - heureBase * 60) / 60) * pxParHeure
  const dureeMin = minutesDepuis(fin) - minutesDepuis(debut)
  const height = Math.max(18, (dureeMin / 60) * pxParHeure)
  return { top, height }
}
```

- [ ] **Step 4: Lancer → passe**

Run: `npm test -- timeline-layout`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/agenda/timelineLayout.ts src/renderer/src/data/__tests__/timeline-layout.test.ts
git commit -m "feat: calcul pur de positionnement timeline"
```

---

## Task 13: EvenementModal + CategoriePicker

**Files:**
- Create: `src/renderer/src/components/agenda/CategoriePicker.tsx`
- Create: `src/renderer/src/components/agenda/EvenementModal.tsx`

> Composants UI : validés par build + revue manuelle (pas de test unitaire DOM dans ce plan).

- [ ] **Step 1: CategoriePicker**

Create `src/renderer/src/components/agenda/CategoriePicker.tsx`:
```tsx
import { useState } from 'react'
import type { CategorieDTO } from '../../shared/types'

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
```

- [ ] **Step 2: EvenementModal**

Create `src/renderer/src/components/agenda/EvenementModal.tsx`:
```tsx
import { useState } from 'react'
import type { CategorieDTO, EvenementInput, JourSemaine, ModeRecurrence, OccurrenceDTO, RecurrenceRule } from '../../shared/types'
import CategoriePicker from './CategoriePicker'

interface Props {
  occurrence: OccurrenceDTO | null // null = création
  debutInitial: string             // 'YYYY-MM-DD HH:MM' pré-rempli (création)
  categories: CategorieDTO[]
  onCreerCategorie: (nom: string, couleur: string) => Promise<void>
  onValider: (input: EvenementInput, mode: ModeRecurrence) => Promise<void>
  onSupprimer: (mode: ModeRecurrence) => Promise<void>
  onFermer: () => void
}

const JOURS: { code: JourSemaine; label: string }[] = [
  { code: 'LU', label: 'L' }, { code: 'MA', label: 'M' }, { code: 'ME', label: 'M' },
  { code: 'JE', label: 'J' }, { code: 'VE', label: 'V' }, { code: 'SA', label: 'S' }, { code: 'DI', label: 'D' }
]
const RAPPELS: { min: number | null; label: string }[] = [
  { min: null, label: 'Aucun' }, { min: 5, label: '5 min' }, { min: 10, label: '10 min' },
  { min: 30, label: '30 min' }, { min: 60, label: '1 h' }, { min: 1440, label: 'La veille' }
]

function toInput(s: string): string { return s.replace(' ', 'T') }
function fromInput(s: string): string { return s.replace('T', ' ').slice(0, 16) }

export default function EvenementModal(props: Props): JSX.Element {
  const { occurrence, debutInitial, categories } = props
  const enEdition = occurrence !== null

  const [titre, setTitre] = useState(occurrence?.titre ?? '')
  const [debut, setDebut] = useState(occurrence?.debut ?? debutInitial)
  const [fin, setFin] = useState(occurrence?.fin ?? `${debutInitial.slice(0, 11)}${String(Number(debutInitial.slice(11, 13)) + 1).padStart(2, '0')}${debutInitial.slice(13)}`)
  const [allDay, setAllDay] = useState(occurrence?.allDay ?? false)
  const [categorieId, setCategorieId] = useState<number | null>(occurrence?.categorie?.id ?? null)
  const [description, setDescription] = useState(occurrence?.description ?? '')
  const [rappelMin, setRappelMin] = useState<number | null>(occurrence?.rappelMin ?? null)

  const [recurrent, setRecurrent] = useState(occurrence?.estRecurrent ?? false)
  const [freq, setFreq] = useState<RecurrenceRule['freq']>('hebdo')
  const [intervalle, setIntervalle] = useState(1)
  const [jours, setJours] = useState<JourSemaine[]>(['LU'])
  const [finType, setFinType] = useState<'jamais' | 'date' | 'count'>('jamais')
  const [finDate, setFinDate] = useState(debut.slice(0, 10))
  const [finCount, setFinCount] = useState(10)

  const [mode, setMode] = useState<ModeRecurrence>('serie')
  const [rappelPerso, setRappelPerso] = useState(false)

  function construireRecurrence(): RecurrenceRule | null {
    if (!recurrent) return null
    const rule: RecurrenceRule = { freq, intervalle: Math.max(1, intervalle) }
    if (freq === 'hebdo') rule.jours = jours
    if (finType === 'date') rule.fin = { type: 'date', date: finDate }
    else if (finType === 'count') rule.fin = { type: 'count', count: finCount }
    return rule
  }

  async function valider(): Promise<void> {
    if (!titre.trim()) return
    const input: EvenementInput = {
      titre: titre.trim(), debut, fin, allDay,
      categorieId, description: description.trim() || null,
      recurrence: construireRecurrence(), rappelMin
    }
    await props.onValider(input, occurrence?.estRecurrent ? mode : 'serie')
  }

  function toggleJour(j: JourSemaine): void {
    setJours((p) => (p.includes(j) ? p.filter((x) => x !== j) : [...p, j]))
  }

  return (
    <div className="modal-overlay" onClick={props.onFermer}>
      <div className="modal card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>{enEdition ? 'Modifier' : 'Nouvel événement'}</strong>
          <button className="btn-icon" onClick={props.onFermer}>✕</button>
        </div>

        <input className="input" placeholder="Titre" value={titre} autoFocus
          onChange={(e) => setTitre(e.target.value)} style={{ marginTop: 10 }} />

        <label className="row" style={{ gap: 8, marginTop: 10 }}>
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> Journée entière
        </label>

        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <input type={allDay ? 'date' : 'datetime-local'} className="input"
            value={allDay ? debut.slice(0, 10) : toInput(debut)}
            onChange={(e) => setDebut(allDay ? `${e.target.value} 00:00` : fromInput(e.target.value))} />
          <input type={allDay ? 'date' : 'datetime-local'} className="input"
            value={allDay ? fin.slice(0, 10) : toInput(fin)}
            onChange={(e) => setFin(allDay ? `${e.target.value} 23:59` : fromInput(e.target.value))} />
        </div>

        <div style={{ marginTop: 10 }}>
          <CategoriePicker categories={categories} valeur={categorieId}
            onChange={setCategorieId} onCreer={props.onCreerCategorie} />
        </div>

        <textarea className="input" placeholder="Notes (optionnel)" value={description}
          onChange={(e) => setDescription(e.target.value)} style={{ marginTop: 10, minHeight: 50 }} />

        {/* Rappel */}
        <div className="label" style={{ marginTop: 10 }}>Rappel</div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {RAPPELS.map((r) => (
            <button key={String(r.min)} type="button"
              className={`cat-chip${!rappelPerso && rappelMin === r.min ? ' active' : ''}`}
              onClick={() => { setRappelPerso(false); setRappelMin(r.min) }}>{r.label}</button>
          ))}
          <button type="button" className={`cat-chip${rappelPerso ? ' active' : ''}`} onClick={() => setRappelPerso(true)}>Perso…</button>
          {rappelPerso && (
            <input className="input" type="number" min={0} style={{ width: 90 }} placeholder="min"
              value={rappelMin ?? 0} onChange={(e) => setRappelMin(Number(e.target.value))} />
          )}
        </div>

        {/* Récurrence */}
        <label className="row" style={{ gap: 8, marginTop: 10 }}>
          <input type="checkbox" checked={recurrent} onChange={(e) => setRecurrent(e.target.checked)} /> Répéter
        </label>
        {recurrent && (
          <div className="col" style={{ gap: 8, marginTop: 6 }}>
            <div className="row" style={{ gap: 8 }}>
              <span>tous les</span>
              <input className="input" type="number" min={1} style={{ width: 60 }}
                value={intervalle} onChange={(e) => setIntervalle(Number(e.target.value))} />
              <select className="input" value={freq} onChange={(e) => setFreq(e.target.value as RecurrenceRule['freq'])}>
                <option value="quotidien">jour(s)</option>
                <option value="hebdo">semaine(s)</option>
                <option value="mensuel">mois</option>
                <option value="annuel">an(s)</option>
              </select>
            </div>
            {freq === 'hebdo' && (
              <div className="row" style={{ gap: 4 }}>
                {JOURS.map((j) => (
                  <button key={j.code} type="button"
                    className={`cat-chip${jours.includes(j.code) ? ' active' : ''}`}
                    onClick={() => toggleJour(j.code)} style={{ width: 30, padding: 4 }}>{j.label}</button>
                ))}
              </div>
            )}
            <div className="row" style={{ gap: 8 }}>
              <select className="input" value={finType} onChange={(e) => setFinType(e.target.value as 'jamais' | 'date' | 'count')}>
                <option value="jamais">sans fin</option>
                <option value="date">jusqu'au</option>
                <option value="count">nombre</option>
              </select>
              {finType === 'date' && <input className="input" type="date" value={finDate} onChange={(e) => setFinDate(e.target.value)} />}
              {finType === 'count' && <input className="input" type="number" min={1} value={finCount} onChange={(e) => setFinCount(Number(e.target.value))} style={{ width: 80 }} />}
            </div>
          </div>
        )}

        {/* Mode d'application (édition d'un récurrent) */}
        {enEdition && occurrence?.estRecurrent && (
          <div className="col" style={{ gap: 4, marginTop: 10 }}>
            <div className="label">Appliquer à</div>
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value as ModeRecurrence)}>
              <option value="occurrence">Cette occurrence</option>
              <option value="suivantes">Cette occurrence et les suivantes</option>
              <option value="serie">Toute la série</option>
            </select>
          </div>
        )}

        <div className="row" style={{ gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          {enEdition && (
            <button className="btn-icon" title="Supprimer"
              onClick={() => props.onSupprimer(occurrence?.estRecurrent ? mode : 'serie')}>🗑</button>
          )}
          <button className="btn-launch" onClick={valider} disabled={!titre.trim()}>
            {enEdition ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS (typecheck OK).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/agenda/CategoriePicker.tsx src/renderer/src/components/agenda/EvenementModal.tsx
git commit -m "feat: EvenementModal + CategoriePicker (récurrence, rappel, mode)"
```

---

## Task 14: TimelineView (jour / 3 jours / semaine) + interactions

**Files:**
- Create: `src/renderer/src/components/agenda/TimelineView.tsx`

> Drag/resize via pointer events natifs (pas de lib). Drop ouvre la modal pré-remplie pour confirmer (et choisir le mode si récurrent), plutôt qu'un commit silencieux — plus sûr et cohérent avec l'édition.

- [ ] **Step 1: Implémenter TimelineView**

Create `src/renderer/src/components/agenda/TimelineView.tsx`:
```tsx
import { useRef } from 'react'
import type { OccurrenceDTO } from '../../shared/types'
import { positionOccurrence } from './timelineLayout'

const HEURE_BASE = 7
const HEURE_FIN = 23
const PX_H = 48

interface Props {
  jours: string[] // ['YYYY-MM-DD', ...] (1, 3 ou 7)
  occurrences: OccurrenceDTO[]
  onCreer: (debut: string) => void          // clic créneau vide
  onEditer: (occ: OccurrenceDTO) => void     // clic occurrence
  onDeplacer: (occ: OccurrenceDTO, nouveauDebut: string) => void // drop
}

function p2(n: number): string { return n.toString().padStart(2, '0') }

export default function TimelineView({ jours, occurrences, onCreer, onEditer, onDeplacer }: Props): JSX.Element {
  const heures = Array.from({ length: HEURE_FIN - HEURE_BASE }, (_, i) => HEURE_BASE + i)
  const drag = useRef<{ occ: OccurrenceDTO } | null>(null)

  function clicColonne(jour: string, e: React.MouseEvent): void {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const minutes = ((e.clientY - rect.top) / PX_H) * 60 + HEURE_BASE * 60
    const h = Math.floor(minutes / 60)
    const m = Math.floor((minutes % 60) / 15) * 15
    onCreer(`${jour} ${p2(h)}:${p2(m)}`)
  }

  function deposer(jour: string, e: React.MouseEvent): void {
    if (!drag.current) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const minutes = ((e.clientY - rect.top) / PX_H) * 60 + HEURE_BASE * 60
    const h = Math.floor(minutes / 60)
    const m = Math.floor((minutes % 60) / 15) * 15
    onDeplacer(drag.current.occ, `${jour} ${p2(h)}:${p2(m)}`)
    drag.current = null
  }

  return (
    <div className="timeline">
      <div className="timeline-gutter">
        {heures.map((h) => <div key={h} className="timeline-heure" style={{ height: PX_H }}>{p2(h)}:00</div>)}
      </div>
      {jours.map((jour) => (
        <div key={jour} className="timeline-col" onClick={(e) => clicColonne(jour, e)}
          onMouseUp={(e) => deposer(jour, e)}
          style={{ height: PX_H * (HEURE_FIN - HEURE_BASE) }}>
          {occurrences.filter((o) => o.dateOccurrence === jour && !o.allDay).map((o) => {
            const { top, height } = positionOccurrence(o.debut, o.fin, HEURE_BASE, PX_H)
            return (
              <div key={`${o.masterId}-${o.dateOccurrence}`} className="timeline-event"
                style={{ top, height, background: o.categorie?.couleur ?? '#7c3aed' }}
                onClick={(e) => { e.stopPropagation(); onEditer(o) }}
                onMouseDown={(e) => { e.stopPropagation(); drag.current = { occ: o } }}>
                <span className="timeline-event-titre">{o.estRecurrent ? '↻ ' : ''}{o.titre}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/agenda/TimelineView.tsx
git commit -m "feat: TimelineView (jour/3j/semaine) + clic-créer, édition, drag"
```

---

## Task 15: MoisView + MultiMoisView

**Files:**
- Create: `src/renderer/src/components/agenda/MoisView.tsx`
- Create: `src/renderer/src/components/agenda/MultiMoisView.tsx`

- [ ] **Step 1: MoisView**

Create `src/renderer/src/components/agenda/MoisView.tsx`:
```tsx
import type { OccurrenceDTO } from '../../shared/types'

interface Props {
  ancre: string // 'YYYY-MM-DD' dans le mois affiché
  occurrences: OccurrenceDTO[]
  onCreerJour: (date: string) => void
  onEditer: (occ: OccurrenceDTO) => void
  onDeplacer: (occ: OccurrenceDTO, nouvelleDate: string) => void
}

function p2(n: number): string { return n.toString().padStart(2, '0') }

export default function MoisView({ ancre, occurrences, onCreerJour, onEditer, onDeplacer }: Props): JSX.Element {
  const [y, m] = ancre.split('-').map(Number)
  const premier = new Date(y, m - 1, 1)
  const decalLundi = (premier.getDay() + 6) % 7
  const debutGrille = new Date(premier); debutGrille.setDate(1 - decalLundi)
  const cases = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(debutGrille); d.setDate(debutGrille.getDate() + i)
    return d
  })
  let dragOcc: OccurrenceDTO | null = null
  const fmt = (d: Date): string => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`

  return (
    <div className="mois-grid">
      {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((j) => (
        <div key={j} className="mois-entete">{j}</div>
      ))}
      {cases.map((d) => {
        const date = fmt(d)
        const duMois = d.getMonth() === m - 1
        const occ = occurrences.filter((o) => o.dateOccurrence === date)
        return (
          <div key={date} className={`mois-case${duMois ? '' : ' hors-mois'}`}
            onClick={() => onCreerJour(date)}
            onMouseUp={() => { if (dragOcc) { onDeplacer(dragOcc, date); dragOcc = null } }}>
            <div className="mois-num">{d.getDate()}</div>
            {occ.slice(0, 3).map((o) => (
              <div key={`${o.masterId}-${o.dateOccurrence}`} className="mois-pastille"
                style={{ background: o.categorie?.couleur ?? '#7c3aed' }}
                onClick={(e) => { e.stopPropagation(); onEditer(o) }}
                onMouseDown={(e) => { e.stopPropagation(); dragOcc = o }}>
                {o.titre}
              </div>
            ))}
            {occ.length > 3 && <div className="mois-plus">+{occ.length - 3}</div>}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: MultiMoisView**

Create `src/renderer/src/components/agenda/MultiMoisView.tsx`:
```tsx
import type { OccurrenceDTO } from '../../shared/types'

interface Props {
  ancre: string
  nbMois: number
  occurrences: OccurrenceDTO[]
  onCreerJour: (date: string) => void  // clic
  onZoomJour: (date: string) => void   // double-clic
}

function p2(n: number): string { return n.toString().padStart(2, '0') }

function MiniMois({ y, m, parDate, onCreerJour, onZoomJour }: {
  y: number; m: number; parDate: Map<string, OccurrenceDTO[]>
  onCreerJour: (d: string) => void; onZoomJour: (d: string) => void
}): JSX.Element {
  const premier = new Date(y, m, 1)
  const decalLundi = (premier.getDay() + 6) % 7
  const debut = new Date(premier); debut.setDate(1 - decalLundi)
  const cases = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(debut); d.setDate(debut.getDate() + i); return d
  })
  const fmt = (d: Date): string => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
  return (
    <div className="mini-mois">
      <div className="mini-mois-titre">{premier.toLocaleDateString('fr-FR', { month: 'long' })}</div>
      <div className="mini-grid">
        {cases.map((d) => {
          const date = fmt(d)
          const has = (parDate.get(date)?.length ?? 0) > 0
          const couleur = parDate.get(date)?.[0]?.categorie?.couleur ?? '#7c3aed'
          return (
            <button key={date} className={`mini-jour${d.getMonth() === m ? '' : ' hors'}`}
              onClick={() => onCreerJour(date)} onDoubleClick={() => onZoomJour(date)}>
              <span>{d.getDate()}</span>
              {has && <span className="mini-point" style={{ background: couleur }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function MultiMoisView({ ancre, nbMois, occurrences, onCreerJour, onZoomJour }: Props): JSX.Element {
  const [y, m] = ancre.split('-').map(Number)
  const parDate = new Map<string, OccurrenceDTO[]>()
  for (const o of occurrences) {
    const arr = parDate.get(o.dateOccurrence) ?? []
    arr.push(o); parDate.set(o.dateOccurrence, arr)
  }
  const mois = Array.from({ length: nbMois }, (_, i) => {
    const d = new Date(y, m - 1 + i, 1)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  // Regroupement par trimestre (bandeaux) si >= 3 mois
  return (
    <div className="multi-mois">
      {mois.map(({ y: yy, m: mm }, i) => (
        <div key={`${yy}-${mm}`} className="multi-mois-cell">
          {nbMois >= 3 && mm % 3 === 0 && <div className="multi-bandeau">T{Math.floor(mm / 3) + 1} {yy}</div>}
          <MiniMois y={yy} m={mm} parDate={parDate} onCreerJour={onCreerJour} onZoomJour={onZoomJour} />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/agenda/MoisView.tsx src/renderer/src/components/agenda/MultiMoisView.tsx
git commit -m "feat: MoisView + MultiMoisView (création, zoom, regroupements)"
```

---

## Task 16: AgendaScreen (conteneur) + onglet sidebar + CSS

**Files:**
- Create: `src/renderer/src/screens/AgendaScreen.tsx`
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/assets/main.css`

- [ ] **Step 1: AgendaScreen**

Create `src/renderer/src/screens/AgendaScreen.tsx`:
```tsx
import { useState, useEffect, useCallback } from 'react'
import type { CategorieDTO, EvenementInput, ModeRecurrence, OccurrenceDTO } from '../shared/types'
import { plageVue, naviguer, libellePeriode, type VueAgenda, NB_MOIS } from '../data/agendaNav'
import TimelineView from '../components/agenda/TimelineView'
import MoisView from '../components/agenda/MoisView'
import MultiMoisView from '../components/agenda/MultiMoisView'
import EvenementModal from '../components/agenda/EvenementModal'

const VUES: { id: VueAgenda; label: string }[] = [
  { id: 'jour', label: 'Jour' }, { id: 'troisJours', label: '3 jours' }, { id: 'semaine', label: 'Semaine' },
  { id: 'mois', label: 'Mois' }, { id: 'trimestre', label: 'Trim.' }, { id: 'semestre', label: 'Sem.' },
  { id: 'neufMois', label: '9 mois' }, { id: 'annee', label: 'Année' }
]

function aujourdHui(): string {
  const d = new Date(); const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function joursEntre(debut: string, fin: string): string[] {
  const out: string[] = []
  const d = new Date(debut); const f = new Date(fin)
  while (d <= f) { const p = (n: number) => n.toString().padStart(2, '0'); out.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`); d.setDate(d.getDate() + 1) }
  return out
}

export default function AgendaScreen(): JSX.Element {
  const [vue, setVue] = useState<VueAgenda>('semaine')
  const [ancre, setAncre] = useState(aujourdHui())
  const [occ, setOcc] = useState<OccurrenceDTO[]>([])
  const [categories, setCategories] = useState<CategorieDTO[]>([])
  const [modal, setModal] = useState<{ occurrence: OccurrenceDTO | null; debut: string } | null>(null)

  const plage = plageVue(vue, ancre)

  const charger = useCallback(async () => {
    setOcc(await window.api.listEvenements(plage.debut, plage.fin))
    setCategories(await window.api.listCategories())
  }, [plage.debut, plage.fin])

  useEffect(() => { charger() }, [charger])

  async function creerCategorie(nom: string, couleur: string): Promise<void> {
    await window.api.createCategorie(nom, couleur, null)
    setCategories(await window.api.listCategories())
  }

  async function valider(input: EvenementInput, mode: ModeRecurrence): Promise<void> {
    if (modal?.occurrence) await window.api.updateEvenement(modal.occurrence.masterId, modal.occurrence.dateOccurrence, mode, input)
    else await window.api.createEvenement(input)
    setModal(null); charger()
  }

  async function supprimer(mode: ModeRecurrence): Promise<void> {
    if (modal?.occurrence) await window.api.deleteEvenement(modal.occurrence.masterId, modal.occurrence.dateOccurrence, mode)
    setModal(null); charger()
  }

  function zoomJour(date: string): void { setVue('jour'); setAncre(date) }

  return (
    <div className="screen">
      {/* Barre de navigation */}
      <div className="agenda-bar">
        <div className="row" style={{ gap: 6 }}>
          <button className="btn-icon" onClick={() => setAncre(naviguer(vue, ancre, -1))}>‹</button>
          <button className="btn-secondary" onClick={() => setAncre(aujourdHui())}>Aujourd'hui</button>
          <button className="btn-icon" onClick={() => setAncre(naviguer(vue, ancre, 1))}>›</button>
          <span className="agenda-periode">{libellePeriode(vue, ancre)}</span>
        </div>
        <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {VUES.map((v) => (
            <button key={v.id} className={`vue-chip${vue === v.id ? ' active' : ''}`} onClick={() => setVue(v.id)}>{v.label}</button>
          ))}
        </div>
      </div>

      {/* Moteur actif */}
      {(vue === 'jour' || vue === 'troisJours' || vue === 'semaine') && (
        <TimelineView
          jours={joursEntre(plage.debut, plage.fin)}
          occurrences={occ}
          onCreer={(debut) => setModal({ occurrence: null, debut })}
          onEditer={(o) => setModal({ occurrence: o, debut: o.debut })}
          onDeplacer={(o, nouveauDebut) => setModal({ occurrence: o, debut: nouveauDebut })}
        />
      )}
      {vue === 'mois' && (
        <MoisView ancre={ancre} occurrences={occ}
          onCreerJour={(date) => setModal({ occurrence: null, debut: `${date} 09:00` })}
          onEditer={(o) => setModal({ occurrence: o, debut: o.debut })}
          onDeplacer={(o, date) => setModal({ occurrence: o, debut: `${date} ${o.debut.slice(11)}` })} />
      )}
      {(vue === 'trimestre' || vue === 'semestre' || vue === 'neufMois' || vue === 'annee') && (
        <MultiMoisView ancre={ancre} nbMois={NB_MOIS[vue]} occurrences={occ}
          onCreerJour={(date) => setModal({ occurrence: null, debut: `${date} 09:00` })}
          onZoomJour={zoomJour} />
      )}

      {modal && (
        <EvenementModal
          occurrence={modal.occurrence} debutInitial={modal.debut}
          categories={categories} onCreerCategorie={creerCategorie}
          onValider={valider} onSupprimer={supprimer} onFermer={() => setModal(null)} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Onglet sidebar dans App.tsx**

Modify `src/renderer/src/App.tsx`:
1. Ajouter l'import : `import AgendaScreen from './screens/AgendaScreen'`
2. Élargir le type `Onglet` :
```ts
type Onglet = 'accueil' | 'quetes' | 'agenda' | 'tunnel' | 'captures' | 'coaching' | 'timer' | 'rendezvous' | 'recompenses'
```
3. Ajouter l'entrée de nav (après la ligne `{nav('quetes', ...)}`) :
```tsx
        {nav('agenda', '📅', 'Agenda')}
```
4. Ajouter le rendu (après `{onglet === 'quetes' && <QuestesScreen />}`) :
```tsx
        {onglet === 'agenda' && <AgendaScreen />}
```

- [ ] **Step 3: CSS agenda**

Modify `src/renderer/src/assets/main.css` — ajouter à la fin :
```css
/* ─── Agenda ─────────────────────────────────────────────────────────────── */
.agenda-bar { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:14px; }
.agenda-periode { font-weight:700; margin-left:8px; text-transform:capitalize; }
.vue-chip, .cat-chip { background:transparent; border:1px solid rgba(124,58,237,.4); color:var(--text,#e8e1ff); border-radius:999px; padding:5px 12px; cursor:pointer; font-size:13px; }
.vue-chip.active { background:#7c3aed; border-color:#7c3aed; }
.cat-chip.active { color:#fff; }
.btn-secondary { background:var(--bg-card,#241a3d); border:1px solid rgba(124,58,237,.3); color:inherit; border-radius:8px; padding:5px 12px; cursor:pointer; }

/* Timeline */
.timeline { display:flex; overflow-y:auto; max-height:70vh; border:1px solid rgba(124,58,237,.2); border-radius:12px; }
.timeline-gutter { width:48px; flex-shrink:0; }
.timeline-heure { font-size:11px; color:#9a8fc0; text-align:right; padding-right:6px; border-top:1px solid rgba(124,58,237,.12); }
.timeline-col { flex:1; position:relative; border-left:1px solid rgba(124,58,237,.12); background:repeating-linear-gradient(transparent,transparent 47px,rgba(124,58,237,.12) 48px); }
.timeline-event { position:absolute; left:3px; right:3px; border-radius:6px; padding:2px 6px; color:#fff; font-size:12px; overflow:hidden; cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,.3); }
.timeline-event-titre { font-weight:600; }

/* Grille de mois */
.mois-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:4px; }
.mois-entete { font-size:12px; color:#9a8fc0; text-align:center; padding:4px; }
.mois-case { min-height:84px; background:var(--bg-card,#241a3d); border-radius:8px; padding:4px; cursor:pointer; }
.mois-case.hors-mois { opacity:.4; }
.mois-num { font-size:12px; color:#c0b5e0; margin-bottom:2px; }
.mois-pastille { font-size:11px; color:#fff; border-radius:4px; padding:1px 5px; margin-bottom:2px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; cursor:pointer; }
.mois-plus { font-size:10px; color:#9a8fc0; }

/* Multi-mois */
.multi-mois { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:14px; }
.multi-bandeau { font-size:12px; font-weight:700; color:#9a8fc0; margin-bottom:4px; }
.mini-mois-titre { font-size:13px; font-weight:600; text-transform:capitalize; margin-bottom:4px; }
.mini-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
.mini-jour { position:relative; aspect-ratio:1; background:var(--bg-card,#241a3d); border:none; border-radius:4px; color:#c0b5e0; font-size:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.mini-jour.hors { opacity:.3; }
.mini-point { position:absolute; bottom:2px; width:5px; height:5px; border-radius:50%; }

/* Modal */
.modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center; z-index:50; }
.modal { width:90%; max-height:90vh; overflow-y:auto; }
```

- [ ] **Step 4: Build + test complet**

Run: `npm run build && npm test`
Expected: build PASS, tous les tests PASS.

- [ ] **Step 5: Vérification manuelle (dev server)**

Run: `npm run dev`
Vérifier dans le navigateur :
1. L'onglet 📅 Agenda apparaît dans la sidebar.
2. Vue Semaine : clic sur un créneau → la modal s'ouvre avec l'heure pré-remplie ; créer un événement avec une catégorie → il apparaît coloré.
3. Créer un événement récurrent hebdo (LU, ME) → il apparaît sur les bons jours.
4. Cliquer un événement récurrent, choisir « Cette occurrence », changer le titre → seule l'occurrence change.
5. Changer de vue (Mois, Trimestre, Année) → les événements apparaissent ; double-clic sur un jour en Année → zoom vers Jour.
6. Définir un rappel « 5 min » sur un événement proche → autoriser les notifications → vérifier la notif.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/screens/AgendaScreen.tsx src/renderer/src/App.tsx src/renderer/src/assets/main.css
git commit -m "feat: AgendaScreen (3 moteurs) + onglet sidebar + styles agenda"
```

---

## Self-Review (effectuée à l'écriture)

**Couverture spec :**
- 3 moteurs de vues → Tasks 14, 15 (+ helpers 11, 12). ✓
- Type `Événement` (début/fin, all-day, catégorie, description, lien tâche, rappel) → Tasks 3, 7. ✓
- Catégories prédéfinies + perso → Tasks 2 (seed), 6 (CRUD), 13 (picker). ✓
- Récurrence (création + 3 modes, dès le départ) → Tasks 4, 5, 8. ✓
- Multi-mois **créable** + zoom (retour utilisateur) → Task 15 (`onCreerJour` + `onZoomJour`), 16. ✓
- Rappels presets 5/10/30/60/veille + perso (retour utilisateur) → Task 13 (`RAPPELS` + « Perso… »), notifs Tasks 9, 10. ✓
- Colonnes dormantes `source`/`google_id` → Task 2. ✓
- Anti-double-comptage des overrides → Task 7 (`id NOT IN (SELECT override_id ...)`). ✓
- Lien quête : `tache_id` présent dans le modèle/DTO/CRUD (Tasks 2, 3, 7) ; le bouton « Terminer la quête » dans la modal est volontairement **non câblé dans ce jet** — voir note ci-dessous.

**Note de portée (lien quête)** : la spec mentionne un bouton « Terminer la quête » réutilisant `api.terminerTache`. Le champ `tacheId` est porté de bout en bout, mais le sélecteur de quête + le bouton dans `EvenementModal` ne sont pas implémentés dans ce plan pour rester focalisé sur l'agenda. À ajouter en suivi (petite tâche : sélecteur de tâche dans la modal + bouton appelant `window.api.terminerTache`). 

**Placeholders :** aucun (`TODO`/`TBD` absents ; tout step de code montre le code).

**Cohérence des types/signatures :** `OccurrenceDTO`, `EvenementInput`, `ModeRecurrence`, `RecurrenceRule`, `RappelOccurrence`, `VueAgenda`, `NB_MOIS` utilisés de façon cohérente entre `agenda.ts`, `agendaNav.ts`, l'API et l'UI. `expanseRecurrence`/`parseDateTime`/`fmtDateTime` exportés par `recurrence.ts` et consommés par `agenda.ts`.

