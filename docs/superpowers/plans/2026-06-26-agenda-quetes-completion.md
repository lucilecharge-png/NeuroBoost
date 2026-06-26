# Agenda ↔ Quêtes : marquer un événement « fait » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de cocher un événement de l'agenda comme « fait » : on termine la quête liée si elle existe, sinon on crée une quête éclair terminée — avec XP + coins + célébration, et annulation propre.

**Architecture:** Une table `evenement_completion` (clé `masterId + date`) mémorise la complétion par occurrence. La logique de complétion/annulation vit dans `agenda.ts` et réutilise `createTache`/`terminerTache`/`deleteTache` de `game.ts`, plus une nouvelle fonction `annulerCompletion` (revert XP/coins/niveau) dans `game.ts`. `listEvenements` enrichit chaque occurrence d'un booléen `fait`. L'UI ajoute une case sur les pastilles et un sélecteur « lier une quête » dans le modal.

**Tech Stack:** TypeScript, React 19, sql.js (WASM), Vitest. DB via l'interface `Db` (`prepare().get/all/run`).

---

## Référence rapide (constantes existantes)

- XP par énergie (`game.ts`) : `micro:5, faible:15, moyenne:30, haute:60`.
- Coins par énergie : `micro:3, faible:7, moyenne:15, haute:30`.
- `xpPourNiveau(n) = n * 100` ; profil démarre niveau 1, `xp_prochain_niveau = 100`.
- Catégories système seedées (id) : Perso=1, Travail=2, Santé=3, Admin=4.
- Tests : `makeTestDb()` (`src/renderer/src/data/__tests__/testDb.ts`) rejoue tout `MIGRATIONS` sur une base sql.js en mémoire.
- Commande tests : `npm test` (vitest run). Build/typecheck : `npm run build`.

---

## File Structure

- `src/renderer/src/data/migrations.ts` — **Modify** : ajout migration v11 (table `evenement_completion`).
- `src/renderer/src/data/game.ts` — **Modify** : `annulerCompletion(db, xp, coins)` (revert XP/coins/total/niveau). Export de `XP_PAR_ENERGIE`/`COINS_PAR_ENERGIE` non requis.
- `src/renderer/src/data/agenda.ts` — **Modify** : `dureeVersEnergie`, `terminerEvenement`, `annulerEvenement`, enrichissement `fait` dans `listEvenements`/`occToDTO`.
- `src/shared/types.ts` — **Modify** : champ `fait` sur `OccurrenceDTO` ; signatures `terminerEvenement`/`annulerEvenement` sur `NeuroBoostApi`.
- `src/renderer/src/data/api.ts` — **Modify** : exposition des deux méthodes.
- `src/renderer/src/components/agenda/EvenementModal.tsx` — **Modify** : sélecteur « lier une quête » + bouton « Marquer fait / Annuler ».
- `src/renderer/src/components/agenda/TimelineView.tsx` — **Modify** : case à cocher sur pastilles (timed + all-day).
- `src/renderer/src/components/agenda/MoisView.tsx` — **Modify** : case à cocher sur pastilles.
- `src/renderer/src/screens/AgendaScreen.tsx` — **Modify** : état célébration, handler `onToggleFait`, chargement quêtes actives pour le modal.
- Tests créés : `__tests__/migration-completion.test.ts`, `__tests__/agenda-completion.test.ts`, `__tests__/game-revert.test.ts`.

---

## Task 1 : Migration v11 — table `evenement_completion`

**Files:**
- Modify: `src/renderer/src/data/migrations.ts` (fin du tableau `MIGRATIONS`)
- Test: `src/renderer/src/data/__tests__/migration-completion.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/renderer/src/data/__tests__/migration-completion.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'

describe('migration v11 — evenement_completion', () => {
  it('crée la table evenement_completion', async () => {
    const db = await makeTestDb()
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[])
      .map((t) => t.name)
    expect(tables).toContain('evenement_completion')
  })

  it('a les colonnes attendues', async () => {
    const db = await makeTestDb()
    const cols = (db.prepare("PRAGMA table_info('evenement_completion')").all() as { name: string }[])
      .map((c) => c.name)
    expect(cols).toEqual(
      expect.arrayContaining(['evenement_id', 'date_occurrence', 'tache_id', 'auto_creee', 'completee_le'])
    )
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- migration-completion`
Expected: FAIL (`expected [ ... ] to contain 'evenement_completion'`)

- [ ] **Step 3 : Ajouter la migration v11**

Dans `src/renderer/src/data/migrations.ts`, ajouter une virgule après la dernière chaîne du tableau (la migration v10) puis cette entrée à la fin :

```ts
  ,
  // v11 — Complétion d'événements d'agenda (par occurrence) → quêtes
  `
  CREATE TABLE evenement_completion (
    evenement_id    INTEGER NOT NULL,
    date_occurrence TEXT NOT NULL,
    tache_id        INTEGER REFERENCES taches(id) ON DELETE SET NULL,
    auto_creee      INTEGER NOT NULL DEFAULT 0,
    completee_le    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    PRIMARY KEY (evenement_id, date_occurrence)
  );
  `
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npm test -- migration-completion`
Expected: PASS (2 tests)

- [ ] **Step 5 : Commit**

```bash
git add src/renderer/src/data/migrations.ts src/renderer/src/data/__tests__/migration-completion.test.ts
git commit -m "feat: migration v11 — table evenement_completion"
```

---

## Task 2 : Helper `dureeVersEnergie`

**Files:**
- Modify: `src/renderer/src/data/agenda.ts`
- Test: `src/renderer/src/data/__tests__/agenda-completion.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/renderer/src/data/__tests__/agenda-completion.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { dureeVersEnergie } from '../agenda'

describe('dureeVersEnergie', () => {
  it('mappe la durée sur un niveau d\'énergie', () => {
    expect(dureeVersEnergie('2026-06-10 09:00', '2026-06-10 09:03', false)).toBe('micro')   // 3 min
    expect(dureeVersEnergie('2026-06-10 09:00', '2026-06-10 09:10', false)).toBe('faible')  // 10 min
    expect(dureeVersEnergie('2026-06-10 09:00', '2026-06-10 09:30', false)).toBe('moyenne') // 30 min
    expect(dureeVersEnergie('2026-06-10 09:00', '2026-06-10 11:00', false)).toBe('haute')   // 120 min
  })

  it('traite les bornes (5/15/45)', () => {
    expect(dureeVersEnergie('2026-06-10 09:00', '2026-06-10 09:05', false)).toBe('faible')  // 5 min
    expect(dureeVersEnergie('2026-06-10 09:00', '2026-06-10 09:15', false)).toBe('moyenne') // 15 min
    expect(dureeVersEnergie('2026-06-10 09:00', '2026-06-10 09:45', false)).toBe('haute')   // 45 min
  })

  it('renvoie faible pour une journée entière', () => {
    expect(dureeVersEnergie('2026-06-10 00:00', '2026-06-10 23:59', true)).toBe('faible')
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- agenda-completion`
Expected: FAIL (`dureeVersEnergie is not a function` / import error)

- [ ] **Step 3 : Implémenter le helper**

Dans `src/renderer/src/data/agenda.ts`, ajouter (après les imports, `parseDateTime` est déjà importé) :

```ts
import type { NiveauEnergie } from '../../../shared/types'

// Déduit un niveau d'énergie de la durée d'un événement (mêmes seuils que les Quêtes).
export function dureeVersEnergie(debut: string, fin: string, allDay: boolean): NiveauEnergie {
  if (allDay) return 'faible'
  const min = (parseDateTime(fin).getTime() - parseDateTime(debut).getTime()) / 60000
  if (min < 5) return 'micro'
  if (min < 15) return 'faible'
  if (min < 45) return 'moyenne'
  return 'haute'
}
```

Note : si `NiveauEnergie` est déjà importé en haut du fichier, n'ajoute pas un second import — complète la ligne d'import existante depuis `'../../../shared/types'`.

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npm test -- agenda-completion`
Expected: PASS (3 tests)

- [ ] **Step 5 : Commit**

```bash
git add src/renderer/src/data/agenda.ts src/renderer/src/data/__tests__/agenda-completion.test.ts
git commit -m "feat: dureeVersEnergie — durée d'événement vers niveau d'énergie"
```

---

## Task 3 : `annulerCompletion` (revert XP/coins/niveau) dans game.ts

**Files:**
- Modify: `src/renderer/src/data/game.ts`
- Test: `src/renderer/src/data/__tests__/game-revert.test.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `src/renderer/src/data/__tests__/game-revert.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { makeTestDb } from './testDb'
import { createTache, terminerTache, annulerCompletion, getProfil } from '../game'

describe('annulerCompletion — revert XP/coins/niveau', () => {
  it('ramène le profil à son état antérieur après une complétion simple', async () => {
    const db = await makeTestDb()
    const avant = getProfil(db)
    const t = createTache(db, { titre: 'X', niveauEnergie: 'moyenne' }) // +30 XP / +15 coins
    terminerTache(db, t.id)
    annulerCompletion(db, t.xpRecompense, t.coinsRecompense)
    const apres = getProfil(db)
    expect(apres.xp).toBe(avant.xp)
    expect(apres.niveau).toBe(avant.niveau)
    expect(apres.neurocoins).toBe(avant.neurocoins)
    expect(apres.totalTachesTerminees).toBe(avant.totalTachesTerminees)
  })

  it('redescend correctement d\'un niveau franchi', async () => {
    const db = await makeTestDb()
    const a = createTache(db, { titre: 'A', niveauEnergie: 'haute' }) // 60
    const b = createTache(db, { titre: 'B', niveauEnergie: 'haute' }) // 60 → total 120 ≥ 100 ⇒ niveau 2
    terminerTache(db, a.id)
    terminerTache(db, b.id)
    expect(getProfil(db).niveau).toBe(2)
    annulerCompletion(db, 60, 30)
    const p = getProfil(db)
    expect(p.niveau).toBe(1)
    expect(p.xp).toBe(60)
    expect(p.xpProchainNiveau).toBe(100)
  })

  it('borne à zéro sans passer négatif', async () => {
    const db = await makeTestDb()
    const t = createTache(db, { titre: 'X', niveauEnergie: 'micro' }) // 5 / 3
    terminerTache(db, t.id)
    annulerCompletion(db, 999, 999)
    const p = getProfil(db)
    expect(p.xp).toBeGreaterThanOrEqual(0)
    expect(p.neurocoins).toBeGreaterThanOrEqual(0)
    expect(p.niveau).toBe(1)
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- game-revert`
Expected: FAIL (`annulerCompletion is not exported` / not a function)

- [ ] **Step 3 : Implémenter `annulerCompletion`**

Dans `src/renderer/src/data/game.ts`, ajouter après `terminerTache` (avant `ignorerTache`) :

```ts
// Annule l'effet d'une complétion sur le profil : retire XP + coins, décrémente
// le compteur de tâches, et recalcule niveau / xp / xp_prochain à partir de l'XP
// absolu cumulé (robuste, sans soustraction approximative). Borné à 0.
// Note : les achievements déjà débloqués ne sont PAS re-verrouillés (à dessein).
export function annulerCompletion(db: Db, xp: number, coins: number): void {
  const profil = db.prepare('SELECT * FROM profil WHERE id = 1').get() as Record<string, unknown>
  const niveau = profil.niveau as number
  // XP absolu = somme des paliers franchis (k*100) + xp courant
  const cumulNiveau = 100 * (niveau - 1) * niveau / 2
  let total = Math.max(0, cumulNiveau + (profil.xp as number) - xp)

  let nNiveau = 1
  let prochain = xpPourNiveau(1) // 100
  while (total >= prochain) {
    total -= prochain
    nNiveau += 1
    prochain = xpPourNiveau(nNiveau)
  }

  const coinsFinal = Math.max(0, (profil.neurocoins as number) - coins)
  const totalTaches = Math.max(0, (profil.total_taches_terminees as number) - 1)

  db.prepare(`
    UPDATE profil SET xp = ?, niveau = ?, xp_prochain_niveau = ?, neurocoins = ?, total_taches_terminees = ? WHERE id = 1
  `).run(total, nNiveau, prochain, coinsFinal, totalTaches)
}
```

- [ ] **Step 4 : Lancer le test, vérifier le succès**

Run: `npm test -- game-revert`
Expected: PASS (3 tests)

- [ ] **Step 5 : Commit**

```bash
git add src/renderer/src/data/game.ts src/renderer/src/data/__tests__/game-revert.test.ts
git commit -m "feat: annulerCompletion — revert XP/coins/niveau"
```

---

## Task 4 : `terminerEvenement` (cas lié + à la volée + idempotence)

**Files:**
- Modify: `src/renderer/src/data/agenda.ts`
- Test: `src/renderer/src/data/__tests__/agenda-completion.test.ts` (compléter le fichier de Task 2)

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter dans `src/renderer/src/data/__tests__/agenda-completion.test.ts` :

```ts
import { makeTestDb } from './testDb'
import * as A from '../agenda'
import { createTache, getProfil } from '../game'

describe('terminerEvenement', () => {
  it('cas à la volée : crée une quête terminée et journalise la complétion', async () => {
    const db = await makeTestDb()
    const ev = A.createEvenement(db, { titre: 'Méditer', debut: '2026-06-10 09:00', fin: '2026-06-10 09:10' })
    const res = A.terminerEvenement(db, ev.id, '2026-06-10')
    expect(res.xpGagne).toBe(15) // 10 min ⇒ faible ⇒ 15 XP
    const row = db.prepare('SELECT * FROM evenement_completion WHERE evenement_id = ? AND date_occurrence = ?')
      .get(ev.id, '2026-06-10') as Record<string, unknown>
    expect(row.auto_creee).toBe(1)
    const tache = db.prepare('SELECT * FROM taches WHERE id = ?').get(row.tache_id) as Record<string, unknown>
    expect(tache.statut).toBe('terminee')
    expect(tache.titre).toBe('Méditer')
  })

  it('cas lié : termine la quête liée, auto_creee = 0', async () => {
    const db = await makeTestDb()
    const t = createTache(db, { titre: 'Dossier', niveauEnergie: 'haute' })
    const ev = A.createEvenement(db, { titre: 'Bloc dossier', debut: '2026-06-10 09:00', fin: '2026-06-10 10:00', tacheId: t.id })
    const res = A.terminerEvenement(db, ev.id, '2026-06-10')
    expect(res.xpGagne).toBe(60) // XP de la quête liée (haute)
    const row = db.prepare('SELECT * FROM evenement_completion WHERE evenement_id = ?').get(ev.id) as Record<string, unknown>
    expect(row.auto_creee).toBe(0)
    expect(row.tache_id).toBe(t.id)
    const tache = db.prepare('SELECT statut FROM taches WHERE id = ?').get(t.id) as { statut: string }
    expect(tache.statut).toBe('terminee')
  })

  it('idempotent : une 2ᵉ complétion de la même occurrence ne re-crédite pas', async () => {
    const db = await makeTestDb()
    const ev = A.createEvenement(db, { titre: 'X', debut: '2026-06-10 09:00', fin: '2026-06-10 09:30' })
    A.terminerEvenement(db, ev.id, '2026-06-10')
    const profilApres1 = getProfil(db)
    A.terminerEvenement(db, ev.id, '2026-06-10')
    const profilApres2 = getProfil(db)
    expect(profilApres2.xp).toBe(profilApres1.xp)
    expect(profilApres2.totalTachesTerminees).toBe(profilApres1.totalTachesTerminees)
    const n = db.prepare('SELECT COUNT(*) as n FROM evenement_completion WHERE evenement_id = ?').get(ev.id) as { n: number }
    expect(n.n).toBe(1)
  })

  it('occurrence récurrente : cocher une date n\'affecte pas les autres', async () => {
    const db = await makeTestDb()
    const ev = A.createEvenement(db, {
      titre: 'Sport', debut: '2026-06-01 18:00', fin: '2026-06-01 19:00',
      recurrence: { freq: 'hebdo', intervalle: 1, jours: ['LU'] }
    })
    A.terminerEvenement(db, ev.id, '2026-06-08')
    const n = db.prepare('SELECT COUNT(*) as n FROM evenement_completion WHERE evenement_id = ?').get(ev.id) as { n: number }
    expect(n.n).toBe(1)
    const row = db.prepare('SELECT date_occurrence FROM evenement_completion WHERE evenement_id = ?').get(ev.id) as { date_occurrence: string }
    expect(row.date_occurrence).toBe('2026-06-08')
  })
})
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `npm test -- agenda-completion`
Expected: FAIL (`A.terminerEvenement is not a function`)

- [ ] **Step 3 : Implémenter `terminerEvenement`**

Dans `src/renderer/src/data/agenda.ts`, ajouter en tête l'import des fonctions de jeu (après les imports existants) :

```ts
import { createTache, terminerTache, deleteTache, annulerCompletion, getProfil } from './game'
import type { CompletionResult } from '../../../shared/types'
```

Puis, à la fin du fichier, la section complétion :

```ts
// ─── Complétion d'événements → quêtes ─────────────────────────────────────────

function nomCategorie(db: Db, categorieId: number | null): string | null {
  if (categorieId == null) return null
  const r = db.prepare('SELECT nom FROM categorie WHERE id = ?').get(categorieId) as { nom: string } | undefined
  return r?.nom ?? null
}

// Marque une occurrence comme faite. Renvoie un CompletionResult vide (zéro gain)
// si l'occurrence est déjà complétée (idempotence).
export function terminerEvenement(db: Db, masterId: number, dateOccurrence: string): CompletionResult {
  const dejaFait = db.prepare(
    'SELECT 1 FROM evenement_completion WHERE evenement_id = ? AND date_occurrence = ?'
  ).get(masterId, dateOccurrence)
  if (dejaFait) {
    return {
      profil: getProfil(db),
      xpGagne: 0, coinsGagnes: 0, levelUp: false, nouveauNiveau: null, achievementsDebloques: []
    }
  }

  const m = getMaster(db, masterId)
  if (!m) throw new Error(`Événement ${masterId} introuvable`)

  const tacheLiee = m.tache_id as number | null
  let tacheCible: number
  let autoCreee: 0 | 1

  if (tacheLiee != null) {
    const statut = (db.prepare('SELECT statut FROM taches WHERE id = ?').get(tacheLiee) as { statut: string } | undefined)?.statut
    if (statut === 'active' || statut === 'en_cours') {
      tacheCible = tacheLiee
      autoCreee = 0
    } else {
      tacheCible = -1; autoCreee = 1
    }
  } else {
    tacheCible = -1; autoCreee = 1
  }

  if (autoCreee === 1) {
    const energie = dureeVersEnergie(m.debut as string, m.fin as string, Boolean(m.all_day))
    const tache = createTache(db, {
      titre: m.titre as string,
      niveauEnergie: energie,
      categorie: nomCategorie(db, (m.categorie_id as number | null) ?? null)
    })
    tacheCible = tache.id
  }

  const resultat = terminerTache(db, tacheCible)
  db.prepare(
    'INSERT INTO evenement_completion (evenement_id, date_occurrence, tache_id, auto_creee) VALUES (?, ?, ?, ?)'
  ).run(masterId, dateOccurrence, tacheCible, autoCreee)
  return resultat
}
```

Note : `getMaster` et `dureeVersEnergie` existent déjà dans ce fichier (Task 2). `Db` est déjà importé.

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npm test -- agenda-completion`
Expected: PASS (les 3 tests de Task 2 + les 4 de cette tâche)

- [ ] **Step 5 : Commit**

```bash
git add src/renderer/src/data/agenda.ts src/renderer/src/data/__tests__/agenda-completion.test.ts
git commit -m "feat: terminerEvenement — complète une occurrence vers une quête"
```

---

## Task 5 : `annulerEvenement` (dé-cocher)

**Files:**
- Modify: `src/renderer/src/data/agenda.ts`
- Test: `src/renderer/src/data/__tests__/agenda-completion.test.ts` (compléter)

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter dans `agenda-completion.test.ts` :

```ts
describe('annulerEvenement', () => {
  it('cas à la volée : supprime la quête éclair et revert XP/coins', async () => {
    const db = await makeTestDb()
    const avant = getProfil(db)
    const ev = A.createEvenement(db, { titre: 'X', debut: '2026-06-10 09:00', fin: '2026-06-10 09:30' })
    A.terminerEvenement(db, ev.id, '2026-06-10')
    const row = db.prepare('SELECT tache_id FROM evenement_completion WHERE evenement_id = ?').get(ev.id) as { tache_id: number }
    A.annulerEvenement(db, ev.id, '2026-06-10')
    const apres = getProfil(db)
    expect(apres.xp).toBe(avant.xp)
    expect(apres.neurocoins).toBe(avant.neurocoins)
    expect(apres.totalTachesTerminees).toBe(avant.totalTachesTerminees)
    expect(db.prepare('SELECT 1 FROM taches WHERE id = ?').get(row.tache_id)).toBeUndefined()
    expect(db.prepare('SELECT 1 FROM evenement_completion WHERE evenement_id = ?').get(ev.id)).toBeUndefined()
  })

  it('cas lié : rouvre la quête (active) sans la supprimer', async () => {
    const db = await makeTestDb()
    const t = createTache(db, { titre: 'Dossier', niveauEnergie: 'moyenne' })
    const ev = A.createEvenement(db, { titre: 'Bloc', debut: '2026-06-10 09:00', fin: '2026-06-10 09:30', tacheId: t.id })
    A.terminerEvenement(db, ev.id, '2026-06-10')
    A.annulerEvenement(db, ev.id, '2026-06-10')
    const tache = db.prepare('SELECT statut, completee_le FROM taches WHERE id = ?').get(t.id) as { statut: string; completee_le: string | null }
    expect(tache.statut).toBe('active')
    expect(tache.completee_le).toBeNull()
    expect(db.prepare('SELECT 1 FROM evenement_completion WHERE evenement_id = ?').get(ev.id)).toBeUndefined()
  })

  it('no-op si l\'occurrence n\'est pas complétée', async () => {
    const db = await makeTestDb()
    const ev = A.createEvenement(db, { titre: 'X', debut: '2026-06-10 09:00', fin: '2026-06-10 09:30' })
    expect(() => A.annulerEvenement(db, ev.id, '2026-06-10')).not.toThrow()
  })
})
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Run: `npm test -- agenda-completion`
Expected: FAIL (`A.annulerEvenement is not a function`)

- [ ] **Step 3 : Implémenter `annulerEvenement`**

Dans `src/renderer/src/data/agenda.ts`, après `terminerEvenement` :

```ts
// Annule la complétion d'une occurrence : revert XP/coins, puis supprime la quête
// éclair (auto_creee) ou rouvre la quête liée. No-op si non complétée.
export function annulerEvenement(db: Db, masterId: number, dateOccurrence: string): void {
  const comp = db.prepare(
    'SELECT tache_id, auto_creee FROM evenement_completion WHERE evenement_id = ? AND date_occurrence = ?'
  ).get(masterId, dateOccurrence) as { tache_id: number | null; auto_creee: number } | undefined
  if (!comp) return

  if (comp.tache_id != null) {
    const tache = db.prepare('SELECT xp_recompense, coins_recompense FROM taches WHERE id = ?')
      .get(comp.tache_id) as { xp_recompense: number; coins_recompense: number } | undefined
    if (tache) {
      annulerCompletion(db, tache.xp_recompense, tache.coins_recompense)
      if (comp.auto_creee === 1) {
        deleteTache(db, comp.tache_id)
      } else {
        db.prepare("UPDATE taches SET statut = 'active', completee_le = NULL WHERE id = ?").run(comp.tache_id)
      }
    }
  }

  db.prepare('DELETE FROM evenement_completion WHERE evenement_id = ? AND date_occurrence = ?')
    .run(masterId, dateOccurrence)
}
```

- [ ] **Step 4 : Lancer les tests, vérifier le succès**

Run: `npm test -- agenda-completion`
Expected: PASS (tous les tests du fichier)

- [ ] **Step 5 : Commit**

```bash
git add src/renderer/src/data/agenda.ts src/renderer/src/data/__tests__/agenda-completion.test.ts
git commit -m "feat: annulerEvenement — dé-cocher une occurrence (revert propre)"
```

---

## Task 6 : Champ `fait` sur les occurrences

**Files:**
- Modify: `src/shared/types.ts` (`OccurrenceDTO`)
- Modify: `src/renderer/src/data/agenda.ts` (`occToDTO`, `listEvenements`)
- Test: `src/renderer/src/data/__tests__/agenda-completion.test.ts` (compléter)

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans `agenda-completion.test.ts` :

```ts
describe('listEvenements — champ fait', () => {
  it('marque fait uniquement l\'occurrence complétée', async () => {
    const db = await makeTestDb()
    const ev = A.createEvenement(db, {
      titre: 'Sport', debut: '2026-06-01 18:00', fin: '2026-06-01 19:00',
      recurrence: { freq: 'hebdo', intervalle: 1, jours: ['LU'] }
    })
    A.terminerEvenement(db, ev.id, '2026-06-08')
    const occ = A.listEvenements(db, '2026-06-01', '2026-06-30')
    const fait = occ.filter((o) => o.fait).map((o) => o.dateOccurrence)
    expect(fait).toEqual(['2026-06-08'])
    expect(occ.find((o) => o.dateOccurrence === '2026-06-01')!.fait).toBe(false)
  })
})
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

Run: `npm test -- agenda-completion`
Expected: FAIL (`o.fait` est `undefined` → `fait` array vide ou propriété absente)

- [ ] **Step 3a : Ajouter `fait` au type**

Dans `src/shared/types.ts`, interface `OccurrenceDTO`, ajouter le champ (après `tacheId: number | null`) :

```ts
  fait: boolean
```

- [ ] **Step 3b : Enrichir `occToDTO` et `listEvenements`**

Dans `src/renderer/src/data/agenda.ts` :

Modifier la signature et le corps de `occToDTO` pour accepter l'ensemble des complétions :

```ts
function occToDTO(
  master: Record<string, unknown>,
  debutOcc: string,
  dateOcc: string,
  estRecurrent: boolean,
  categories: Map<number, CategorieDTO>,
  faites: Set<string>
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
    fait: faites.has(`${ev.id}|${dateOcc}`),
    estRecurrent,
    recurrence: ev.recurrence,
    rappelMin: ev.rappelMin
  }
}
```

Dans `listEvenements`, juste après la ligne `const cats = new Map(...)`, construire l'ensemble des complétions de la fenêtre :

```ts
  const faites = new Set(
    (db.prepare(
      'SELECT evenement_id, date_occurrence FROM evenement_completion WHERE date_occurrence >= ? AND date_occurrence <= ?'
    ).all(fenetreDebut, fenetreFin) as { evenement_id: number; date_occurrence: string }[])
      .map((r) => `${r.evenement_id}|${r.date_occurrence}`)
  )
```

Puis passer `faites` à **chaque** appel de `occToDTO` (il y en a trois : occurrence ponctuelle, occurrence récurrente, override). Exemple :

```ts
        occurrences.push(occToDTO(m, m.debut as string, dateOcc, false, cats, faites))
...
      occurrences.push(occToDTO(m, debutOcc, dateOcc, true, cats, faites))
...
    occurrences.push(occToDTO(ov, ov.debut as string, dateOcc, false, cats, faites))
```

- [ ] **Step 4 : Lancer le test + toute la suite**

Run: `npm test`
Expected: PASS (tous fichiers — vérifie qu'aucun test agenda existant n'est cassé par le nouveau champ)

- [ ] **Step 5 : Commit**

```bash
git add src/shared/types.ts src/renderer/src/data/agenda.ts src/renderer/src/data/__tests__/agenda-completion.test.ts
git commit -m "feat: champ fait par occurrence dans listEvenements"
```

---

## Task 7 : Exposer l'API (`api.ts` + signatures `types.ts`)

**Files:**
- Modify: `src/shared/types.ts` (`NeuroBoostApi`)
- Modify: `src/renderer/src/data/api.ts`

- [ ] **Step 1 : Ajouter les signatures à `NeuroBoostApi`**

Dans `src/shared/types.ts`, section Agenda de l'interface `NeuroBoostApi`, après `deleteEvenement`, ajouter :

```ts
  terminerEvenement: (masterId: number, dateOccurrence: string) => Promise<CompletionResult>
  annulerEvenement: (masterId: number, dateOccurrence: string) => Promise<void>
```

- [ ] **Step 2 : Implémenter dans `api.ts`**

Dans `src/renderer/src/data/api.ts`, dans l'objet `rawApi`, section `// Agenda`, après `deleteEvenement` :

```ts
  terminerEvenement: async (masterId, dateOccurrence) => A.terminerEvenement(db, masterId, dateOccurrence),
  annulerEvenement: async (masterId, dateOccurrence) => {
    A.annulerEvenement(db, masterId, dateOccurrence)
  }
```

- [ ] **Step 3 : Vérifier le typecheck**

Run: `npm run build`
Expected: PASS (tsc sans erreur, build vite OK)

- [ ] **Step 4 : Commit**

```bash
git add src/shared/types.ts src/renderer/src/data/api.ts
git commit -m "feat: expose terminerEvenement/annulerEvenement dans l'API"
```

---

## Task 8 : Modal — sélecteur « lier une quête » + bouton « Marquer fait »

**Files:**
- Modify: `src/renderer/src/components/agenda/EvenementModal.tsx`

Le modal reçoit déjà `occurrence` (qui porte `fait`, `tacheId`, `masterId`, `dateOccurrence`). On lui ajoute deux props : la liste des quêtes actives et les handlers fait/annuler.

- [ ] **Step 1 : Étendre les props + l'état**

Dans `src/renderer/src/components/agenda/EvenementModal.tsx`, ajouter à l'import de types `TacheDTO` :

```ts
import type { CategorieDTO, EvenementInput, JourSemaine, ModeRecurrence, OccurrenceDTO, RecurrenceRule, TacheDTO } from '../../../../shared/types'
```

Étendre l'interface `Props` :

```ts
  quetesActives: TacheDTO[]
  onToggleFait: (occ: OccurrenceDTO) => Promise<void>
```

Ajouter un état pour la quête liée, à côté des autres `useState` :

```ts
  const [tacheId, setTacheId] = useState<number | null>(occurrence?.tacheId ?? null)
```

- [ ] **Step 2 : Inclure `tacheId` dans l'input validé**

Dans la fonction `valider()`, ajouter `tacheId` à l'objet `input` :

```ts
    const input: EvenementInput = {
      titre: titre.trim(), debut, fin, allDay,
      categorieId, description: description.trim() || null,
      recurrence: construireRecurrence(), rappelMin, tacheId
    }
```

- [ ] **Step 3 : Ajouter le sélecteur de quête (avant le bloc Rappel)**

Juste avant `{/* Rappel */}` :

```tsx
        <div className="label" style={{ marginTop: 10 }}>Lier à une quête existante</div>
        <select className="input" value={tacheId ?? ''} onChange={(e) => setTacheId(e.target.value ? Number(e.target.value) : null)}>
          <option value="">— Aucune (créera une quête en cochant « fait »)</option>
          {props.quetesActives.map((q) => (
            <option key={q.id} value={q.id}>{q.titre}</option>
          ))}
        </select>
```

- [ ] **Step 4 : Ajouter le bouton « Marquer fait / Annuler » (en édition)**

Dans la barre de boutons du bas, avant le bouton « Enregistrer », et seulement en édition :

```tsx
          {enEdition && occurrence && (
            <button
              className="btn-secondary"
              onClick={async () => { await props.onToggleFait(occurrence); props.onFermer() }}
            >
              {occurrence.fait ? '↩︎ Annuler « fait »' : '✓ Marquer fait'}
            </button>
          )}
```

- [ ] **Step 5 : Vérifier le typecheck**

Run: `npm run build`
Expected: échec attendu côté `AgendaScreen` (props `quetesActives`/`onToggleFait` non encore fournies) — c'est normal, corrigé en Task 10. Si tu veux un build vert immédiat, enchaîne Task 9 + 10 avant de relancer. Vérifie au moins que `EvenementModal.tsx` n'a pas d'erreur interne propre.

- [ ] **Step 6 : Commit**

```bash
git add src/renderer/src/components/agenda/EvenementModal.tsx
git commit -m "feat: modal agenda — lier une quête + bouton marquer fait"
```

---

## Task 9 : Case à cocher sur les pastilles (TimelineView + MoisView)

**Files:**
- Modify: `src/renderer/src/components/agenda/TimelineView.tsx`
- Modify: `src/renderer/src/components/agenda/MoisView.tsx`

- [ ] **Step 1 : TimelineView — ajouter la prop `onToggleFait`**

Dans `Props` de `TimelineView.tsx`, ajouter :

```ts
  onToggleFait: (occ: OccurrenceDTO) => void
```

et l'ajouter à la déstructuration : `export default function TimelineView({ jours, occurrences, onCreer, onEditer, onDeplacer, onToggleFait }: Props)`.

- [ ] **Step 2 : TimelineView — case sur la pastille horaire**

Dans la pastille `.timeline-event`, à l'intérieur, avant le `<span className="timeline-event-titre">`, insérer la case ; et appliquer un style « fait » sur le conteneur :

```tsx
                <div key={`${o.masterId}-${o.dateOccurrence}`} className="timeline-event"
                  style={{ top, height, background: o.categorie?.couleur ?? '#7c3aed', opacity: o.fait ? 0.55 : 1 }}
                  onClick={(e) => { e.stopPropagation(); onEditer(o) }}
                  onMouseDown={(e) => { e.stopPropagation(); drag.current = { occ: o } }}>
                  <button className="event-check" title={o.fait ? 'Fait' : 'Marquer fait'}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onToggleFait(o) }}>
                    {o.fait ? '☑' : '☐'}
                  </button>
                  <span className="timeline-event-titre" style={{ textDecoration: o.fait ? 'line-through' : 'none' }}>
                    {o.estRecurrent ? '↻ ' : ''}{o.titre}
                  </span>
                </div>
```

- [ ] **Step 3 : TimelineView — case sur la pastille all-day**

Dans `.allday-chip`, idem :

```tsx
              <div key={`${o.masterId}-${o.dateOccurrence}`} className="allday-chip"
                style={{ background: o.categorie?.couleur ?? '#7c3aed', opacity: o.fait ? 0.55 : 1 }}
                onClick={(e) => { e.stopPropagation(); onEditer(o) }}>
                <button className="event-check" title={o.fait ? 'Fait' : 'Marquer fait'}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onToggleFait(o) }}>
                  {o.fait ? '☑' : '☐'}
                </button>
                <span style={{ textDecoration: o.fait ? 'line-through' : 'none' }}>
                  {o.estRecurrent ? '↻ ' : ''}{o.titre}
                </span>
              </div>
```

- [ ] **Step 4 : MoisView — prop + case sur la pastille**

Dans `Props` de `MoisView.tsx`, ajouter `onToggleFait: (occ: OccurrenceDTO) => void` et la déstructurer. Modifier `.mois-pastille` :

```tsx
              <div key={`${o.masterId}-${o.dateOccurrence}`} className="mois-pastille"
                style={{ background: o.categorie?.couleur ?? '#7c3aed', opacity: o.fait ? 0.55 : 1, textDecoration: o.fait ? 'line-through' : 'none' }}
                onClick={(e) => { e.stopPropagation(); onEditer(o) }}
                onMouseDown={(e) => { e.stopPropagation(); dragOcc.current = o }}>
                <span onClick={(e) => { e.stopPropagation(); onToggleFait(o) }}
                  onMouseDown={(e) => e.stopPropagation()} style={{ cursor: 'pointer', marginRight: 4 }}>
                  {o.fait ? '☑' : '☐'}
                </span>
                {o.titre}
              </div>
```

- [ ] **Step 5 : Style minimal `.event-check`**

Ajouter dans `src/renderer/src/assets/main.css` (où vivent déjà `.timeline-event`, `.mois-pastille`, `.allday-chip`) :

```css
.event-check {
  background: transparent;
  border: none;
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  padding: 0 4px 0 0;
  line-height: 1;
}
```

- [ ] **Step 5b : Style `.event-check` côté MoisView**

La case de MoisView utilise un `<span>` stylé inline (cf. Task 9 Step 4) — aucun ajout CSS supplémentaire requis.

- [ ] **Step 6 : Commit**

```bash
git add src/renderer/src/components/agenda/TimelineView.tsx src/renderer/src/components/agenda/MoisView.tsx
git commit -m "feat: case à cocher fait sur les pastilles d'agenda"
```

---

## Task 10 : Câblage AgendaScreen (handler + célébration + quêtes du modal)

**Files:**
- Modify: `src/renderer/src/screens/AgendaScreen.tsx`

- [ ] **Step 1 : Imports + état**

Dans `src/renderer/src/screens/AgendaScreen.tsx`, ajouter aux imports :

```ts
import type { CategorieDTO, EvenementInput, ModeRecurrence, OccurrenceDTO, TacheDTO, CompletionResult } from '../../../shared/types'
import Celebration from '../components/Celebration'
```

Ajouter deux états à côté des autres `useState` :

```ts
  const [quetes, setQuetes] = useState<TacheDTO[]>([])
  const [celebration, setCelebration] = useState<CompletionResult | null>(null)
```

- [ ] **Step 2 : Charger les quêtes actives**

Dans `charger` (le `useCallback`), ajouter le chargement des quêtes actives :

```ts
  const charger = useCallback(async () => {
    setOcc(await window.api.listEvenements(plage.debut, plage.fin))
    setCategories(await window.api.listCategories())
    setQuetes(await window.api.listTaches({ statut: 'active' }))
  }, [plage.debut, plage.fin])
```

- [ ] **Step 3 : Handler `onToggleFait`**

Ajouter avant le `return` :

```ts
  async function basculerFait(o: OccurrenceDTO): Promise<void> {
    if (o.fait) {
      await window.api.annulerEvenement(o.masterId, o.dateOccurrence)
    } else {
      const res = await window.api.terminerEvenement(o.masterId, o.dateOccurrence)
      if (res.xpGagne > 0) setCelebration(res)
    }
    await charger()
  }
```

- [ ] **Step 4 : Brancher dans le rendu**

Ajouter `<Celebration result={celebration} onClose={() => setCelebration(null)} />` en haut du `return` (juste après `<div className="screen">`).

Passer `onToggleFait={basculerFait}` à `TimelineView`, `MoisView`. (`MultiMoisView` n'affiche pas de pastilles individuelles — ne pas y toucher.)

Passer au modal les nouvelles props :

```tsx
        <EvenementModal
          occurrence={modal.occurrence} debutInitial={modal.debut}
          categories={categories} onCreerCategorie={creerCategorie}
          quetesActives={quetes}
          onToggleFait={basculerFait}
          onValider={valider} onSupprimer={supprimer} onFermer={() => setModal(null)} />
```

- [ ] **Step 5 : Typecheck + build**

Run: `npm run build`
Expected: PASS (tsc + vite). Corriger toute erreur de type résiduelle (props manquantes).

- [ ] **Step 6 : Vérification manuelle (dev server)**

Run: `npm run dev` puis dans le navigateur :
1. Créer un événement ponctuel de 30 min → cocher sa case → confetti + « +30 XP » ; l'événement se barre.
2. Changer d'onglet puis revenir sur Agenda → la barre XP de la sidebar a augmenté ; l'événement reste coché.
3. Dé-cocher → l'événement redevient normal ; la quête éclair a disparu de l'écran Quêtes.
4. Créer un événement, l'ouvrir, le lier à une quête active, cocher → la quête liée passe « terminée » dans l'écran Quêtes.
5. Événement récurrent hebdo : cocher une occurrence → seules cette date est barrée, pas les autres.

- [ ] **Step 7 : Commit**

```bash
git add src/renderer/src/screens/AgendaScreen.tsx
git commit -m "feat: agenda — câblage fait/annuler + célébration + quêtes du modal"
```

---

## Task 11 : Suite complète + revue finale

- [ ] **Step 1 : Lancer toute la suite de tests**

Run: `npm test`
Expected: PASS (tous les fichiers, dont les tests agenda existants non régressés).

- [ ] **Step 2 : Build de production**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3 : Commit éventuel de finition**

Si des ajustements ont été nécessaires :

```bash
git add -A
git commit -m "chore: finitions complétion agenda↔quêtes"
```

---

## Notes d'implémentation

- **Dépendance `agenda.ts → game.ts`** : à sens unique (game n'importe pas agenda), donc pas de cycle.
- **Achievements non annulés** : volontaire (cf. spec). Un léger gonflement d'XP est possible si un achievement à bonus a été débloqué puis l'événement dé-coché ; accepté.
- **Rafraîchissement de la sidebar** : repose sur le refresh existant au changement d'onglet (`App.tsx`), identique au comportement actuel des Quêtes — aucun câblage supplémentaire.
- **Localisation du CSS** (`.event-check`) : si introuvable, le style inline des pastilles suffit ; ne pas bloquer dessus.
