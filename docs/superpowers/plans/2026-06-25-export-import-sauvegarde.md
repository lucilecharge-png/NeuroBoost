# Export / Import de la sauvegarde — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre d'exporter toutes les données de NeuroBoost dans un fichier `.sqlite` et de les réimporter (même appareil après effacement, ou nouvel appareil).

**Architecture:** La base sql.js en mémoire est déjà sérialisée en `Uint8Array` pour IndexedDB. L'export télécharge ce `Uint8Array` ; l'import recharge un fichier dans une nouvelle instance sql.js, rejoue les migrations, remplace la base et persiste. Une modale accessible via un bouton de la sidebar pilote les deux actions.

**Tech Stack:** TypeScript, React, sql.js (WASM), localforage (IndexedDB), Vitest.

---

## Référence : design

Voir `docs/superpowers/specs/2026-06-25-export-import-sauvegarde-design.md`.

## Structure de fichiers

- **Créer** `src/renderer/src/data/migrate.ts` — fonction `runMigrations(database)` sans dépendance navigateur (importe seulement `MIGRATIONS`). Réutilisée par `db.ts` et testable directement, dans l'esprit de `testDb.ts`.
- **Modifier** `src/renderer/src/data/db.ts` — utilise `runMigrations` ; ajoute `exportDb()` et `importDb(bytes)`.
- **Créer** `src/renderer/src/data/__tests__/backup.test.ts` — round-trip + fichier invalide (browser-free, via sql.js + `runMigrations`).
- **Créer** `src/renderer/src/components/BackupModal.tsx` — UI export/import.
- **Modifier** `src/renderer/src/App.tsx` — bouton sidebar + rendu de la modale.

---

## Task 1: Extraire `runMigrations` dans un module testable

**Files:**
- Create: `src/renderer/src/data/migrate.ts`
- Test: `src/renderer/src/data/__tests__/backup.test.ts`
- Modify: `src/renderer/src/data/db.ts:78-101`

- [ ] **Step 1: Write the failing test**

Créer `src/renderer/src/data/__tests__/backup.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import initSqlJs from 'sql.js'
import { createRequire } from 'module'
import { runMigrations } from '../migrate'
import { MIGRATIONS } from '../migrations'

const require = createRequire(import.meta.url)

async function loadSql() {
  return initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') })
}

describe('runMigrations', () => {
  it('applique toutes les migrations et fixe user_version', async () => {
    const SQL = await loadSql()
    const db = new SQL.Database()
    runMigrations(db)
    const version = db.exec('PRAGMA user_version')[0].values[0][0]
    expect(version).toBe(MIGRATIONS.length)
    // Le profil seed existe (preuve que les migrations ont tourné)
    const r = db.exec("SELECT pseudo FROM profil WHERE id = 1")
    expect(r[0].values[0][0]).toBe('Héros')
  })

  it('est idempotent (ne rejoue pas les migrations déjà appliquées)', async () => {
    const SQL = await loadSql()
    const db = new SQL.Database()
    runMigrations(db)
    runMigrations(db) // 2e passage : ne doit pas relever d'erreur "table exists"
    const version = db.exec('PRAGMA user_version')[0].values[0][0]
    expect(version).toBe(MIGRATIONS.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- backup`
Expected: FAIL — `Cannot find module '../migrate'` (le fichier n'existe pas encore).

- [ ] **Step 3: Create `migrate.ts`**

Créer `src/renderer/src/data/migrate.ts` :

```ts
// Migrations versionnées via PRAGMA user_version. Aucune dépendance navigateur :
// opère sur une instance sql.js `Database` fournie par l'appelant. Partagé entre
// db.ts (init + import) et les tests.
import type { Database } from 'sql.js'
import { MIGRATIONS } from './migrations'

function userVersion(database: Database): number {
  const r = database.exec('PRAGMA user_version')
  return (r[0]?.values?.[0]?.[0] as number) ?? 0
}

// Rejoue les migrations manquantes, chacune dans une transaction. Idempotent.
export function runMigrations(database: Database): void {
  for (let v = userVersion(database); v < MIGRATIONS.length; v++) {
    database.exec('BEGIN')
    try {
      database.exec(MIGRATIONS[v])
      database.exec(`PRAGMA user_version = ${v + 1}`)
      database.exec('COMMIT')
    } catch (e) {
      database.exec('ROLLBACK')
      throw e
    }
  }
}
```

- [ ] **Step 4: Refactor `db.ts` to use `runMigrations`**

Dans `src/renderer/src/data/db.ts` : supprimer la fonction locale `userVersion` (lignes 78-81) et remplacer la boucle de migration dans `initDb` (lignes 90-101) par un appel à `runMigrations`. Ajouter l'import en tête.

Ajouter aux imports (après la ligne 8 `import { MIGRATIONS } from './migrations'`) :

```ts
import { runMigrations } from './migrate'
```

`MIGRATIONS` n'est plus utilisé directement dans `db.ts` → supprimer son import (ligne 8) pour éviter un avertissement de variable inutilisée.

Supprimer (lignes 78-81) :

```ts
function userVersion(database: Database): number {
  const r = database.exec('PRAGMA user_version')
  return (r[0]?.values?.[0]?.[0] as number) ?? 0
}
```

Remplacer dans `initDb` le bloc (lignes 90-101) :

```ts
  // Migrations versionnées (même mécanique que la version Electron)
  for (let v = userVersion(dbInstance); v < MIGRATIONS.length; v++) {
    dbInstance.exec('BEGIN')
    try {
      dbInstance.exec(MIGRATIONS[v])
      dbInstance.exec(`PRAGMA user_version = ${v + 1}`)
      dbInstance.exec('COMMIT')
    } catch (e) {
      dbInstance.exec('ROLLBACK')
      throw e
    }
  }
```

par :

```ts
  // Migrations versionnées (même mécanique que la version Electron)
  runMigrations(dbInstance)
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- backup`
Expected: PASS (2 tests).

- [ ] **Step 6: Run full suite + typecheck (pas de régression)**

Run: `npm run test`
Expected: tous les tests existants passent.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/data/migrate.ts src/renderer/src/data/db.ts src/renderer/src/data/__tests__/backup.test.ts
git commit -m "refactor: extrait runMigrations dans un module testable

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Ajouter `exportDb` et `importDb` dans `db.ts`

**Files:**
- Modify: `src/renderer/src/data/db.ts` (après `persist`, fin de fichier)
- Test: `src/renderer/src/data/__tests__/backup.test.ts` (ajout)

- [ ] **Step 1: Write the failing test (round-trip + fichier invalide)**

Ajouter à `src/renderer/src/data/__tests__/backup.test.ts` un bloc qui valide le mécanisme cœur de `importDb` (export → reload → migrations) sans dépendance navigateur :

```ts
describe('round-trip de sauvegarde (mécanisme export/import)', () => {
  it('préserve les données après export puis reload', async () => {
    const SQL = await loadSql()

    // Base source avec une donnée modifiée
    const source = new SQL.Database()
    runMigrations(source)
    source.run("UPDATE profil SET pseudo = ? WHERE id = 1", ['Lucile'])

    // Export (ce que fait exportDb) → bytes
    const bytes = source.export()

    // Import (ce que fait importDb) → nouvelle instance + migrations
    const restored = new SQL.Database(bytes)
    restored.run('PRAGMA foreign_keys = ON')
    runMigrations(restored) // no-op ici, mais mettrait à niveau un vieux backup

    const r = restored.exec("SELECT pseudo FROM profil WHERE id = 1")
    expect(r[0].values[0][0]).toBe('Lucile')
  })

  it('rejette un fichier qui n\'est pas une base SQLite', async () => {
    const SQL = await loadSql()
    const garbage = new Uint8Array([1, 2, 3, 4, 5])
    expect(() => new SQL.Database(garbage)).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it passes (le mécanisme sql.js existe déjà)**

Run: `npm run test -- backup`
Expected: PASS — ce test verrouille le contrat que `exportDb`/`importDb` doivent respecter. (Il n'échoue pas car il exerce sql.js directement ; il sert de garde-fou contre une régression du mécanisme.)

- [ ] **Step 3: Implémenter `exportDb` et `importDb` dans `db.ts`**

Ajouter à la fin de `src/renderer/src/data/db.ts` (après la fonction `persist`) :

```ts
// ── Sauvegarde / restauration par fichier ──

// Sérialise la base courante en fichier SQLite complet (Uint8Array).
export function exportDb(): Uint8Array {
  if (!dbInstance) throw new Error('Base non initialisée')
  return dbInstance.export()
}

// Remplace la base courante par le contenu d'un fichier importé.
// Sûreté : on ne touche dbInstance qu'après validation réussie du fichier.
export async function importDb(bytes: Uint8Array): Promise<void> {
  if (!SQL) throw new Error('Base non initialisée')
  // Lève si le fichier n'est pas une base SQLite valide — avant tout remplacement.
  const next = new SQL.Database(bytes)
  next.run('PRAGMA foreign_keys = ON')
  runMigrations(next) // met à niveau un backup d'une version antérieure
  dbInstance = next
  dbWrapped = wrap(next)
  await persist()
}
```

- [ ] **Step 4: Run tests + typecheck**

Run: `npm run test -- backup`
Expected: PASS.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/data/db.ts src/renderer/src/data/__tests__/backup.test.ts
git commit -m "feat: exportDb/importDb (sauvegarde fichier .sqlite)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Composant `BackupModal`

**Files:**
- Create: `src/renderer/src/components/BackupModal.tsx`

- [ ] **Step 1: Créer le composant**

Créer `src/renderer/src/components/BackupModal.tsx` (style aligné sur `TemplatesModal.tsx`) :

```tsx
import { useRef, useState } from 'react'
import { exportDb, importDb } from '../data/db'

interface Props {
  onFermer: () => void
}

export default function BackupModal({ onFermer }: Props): JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  function exporter(): void {
    try {
      const octets = exportDb()
      const blob = new Blob([octets], { type: 'application/x-sqlite3' })
      const url = URL.createObjectURL(blob)
      const date = new Date().toISOString().slice(0, 10) // AAAA-MM-JJ
      const a = document.createElement('a')
      a.href = url
      a.download = `neuroboost-sauvegarde-${date}.sqlite`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErreur('Export impossible : ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function fichierChoisi(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier plus tard
    if (!file) return
    const ok = window.confirm(
      'Importer cette sauvegarde remplacera TOUTES tes données actuelles. Continuer ?'
    )
    if (!ok) return
    setEnCours(true)
    setErreur(null)
    try {
      const buf = await file.arrayBuffer()
      await importDb(new Uint8Array(buf))
      window.location.reload() // tous les écrans repartent sur les nouvelles données
    } catch (err) {
      setErreur(
        "Fichier invalide ou illisible. Tes données actuelles n'ont pas été modifiées."
      )
      setEnCours(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onFermer}
    >
      <div
        style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '28px 24px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>💾 Sauvegarde des données</div>
          <button className="btn-ghost" style={{ fontSize: 20, padding: '2px 8px' }} onClick={onFermer}>✕</button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0, marginBottom: 20 }}>
          Tes données vivent dans ce navigateur. Exporte-les régulièrement dans un
          fichier pour ne rien perdre, et réimporte-le sur un autre appareil ou
          après un nettoyage du navigateur.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn-primary" style={{ padding: '12px 16px' }} disabled={enCours} onClick={exporter}>
            ⬇️ Exporter mes données
          </button>
          <button className="btn-ghost" style={{ padding: '12px 16px' }} disabled={enCours} onClick={() => fileRef.current?.click()}>
            ⬆️ Importer une sauvegarde
          </button>
          <input ref={fileRef} type="file" accept=".sqlite" style={{ display: 'none' }} onChange={fichierChoisi} />
        </div>

        {erreur && (
          <div style={{ marginTop: 16, color: 'var(--danger, #e5484d)', fontSize: 13 }}>{erreur}</div>
        )}
      </div>
    </div>
  )
}
```

Note : les classes `btn-primary`/`btn-ghost` et la variable `--danger` existent déjà dans `src/renderer/src/assets/main.css` (lignes 187, 196, 24). Le fallback inline `#e5484d` sur `--danger` reste par sécurité.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/BackupModal.tsx
git commit -m "feat: modale Sauvegarde (export/import de fichier)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Brancher la modale dans la sidebar

**Files:**
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Importer le composant et ajouter l'état**

Dans `src/renderer/src/App.tsx`, ajouter l'import (après la ligne 11 `import RituelEcran ...`) :

```tsx
import BackupModal from './components/BackupModal'
```

Ajouter l'état (après la ligne 19 `const [rituel, setRituel] = useState<Phase | null>(null)`) :

```tsx
  const [backupOuvert, setBackupOuvert] = useState(false)
```

- [ ] **Step 2: Ajouter le bouton sidebar**

Dans `src/renderer/src/App.tsx`, juste après le bouton Rituel (lignes 105-108) et avant `{nav('recompenses', ...)}` (ligne 109), insérer :

```tsx
        <button className="nav-item" onClick={() => setBackupOuvert(true)}>
          <span className="nav-icon">💾</span>
          Sauvegarde
        </button>
```

- [ ] **Step 3: Rendre la modale**

Dans `src/renderer/src/App.tsx`, juste après le bloc `{rituel && (...)}` (qui se termine ligne 59), ajouter :

```tsx
      {backupOuvert && <BackupModal onFermer={() => setBackupOuvert(false)} />}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

Run: `npm run test`
Expected: tous les tests passent.

- [ ] **Step 5: Vérification manuelle dans le navigateur**

Run: `npm run dev`
Puis dans l'app :
1. Cliquer « 💾 Sauvegarde » dans la sidebar → la modale s'ouvre.
2. Cliquer « Exporter mes données » → un fichier `neuroboost-sauvegarde-AAAA-MM-JJ.sqlite` se télécharge.
3. Modifier une donnée (ex. ajouter une quête).
4. Rouvrir la modale → « Importer une sauvegarde » → choisir le fichier exporté à l'étape 2 → confirmer → l'app se recharge et la quête ajoutée à l'étape 3 a disparu (retour à l'état sauvegardé). ✅
5. Réessayer l'import avec un fichier quelconque (ex. une image renommée `.sqlite`) → message d'erreur affiché, données intactes. ✅

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/App.tsx
git commit -m "feat: bouton Sauvegarde dans la sidebar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Couverture spec :** `exportDb`/`importDb` (Task 2), modale + emplacement sidebar (Tasks 3-4), confirmation + remplacement complet (Task 3 `window.confirm`), rejeu des migrations à l'import (Task 2 `runMigrations`), gestion d'erreur sans écrasement (Task 2 ordre des étapes + Task 3 `catch`), tests round-trip + fichier invalide (Tasks 1-2). ✅
- **Cohérence des types :** `exportDb(): Uint8Array`, `importDb(bytes: Uint8Array): Promise<void>`, `runMigrations(database: Database): void` — noms et signatures identiques entre toutes les tâches. ✅
- **Pas de placeholder :** chaque étape contient le code complet. ✅
- **Hypothèses confirmées :** classes CSS `btn-primary`/`btn-ghost` et variable `--danger` présentes dans `main.css`.
