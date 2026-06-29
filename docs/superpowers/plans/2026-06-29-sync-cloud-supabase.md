# Synchronisation cloud — Phase 1 (compte Google + Supabase) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'utilisatrice de retrouver toutes ses données NeuroBoost sur PC et téléphone en se connectant avec Google, via une synchronisation automatique de la base SQLite complète.

**Architecture:** L'app reste locale-first (sql.js + IndexedDB). Un moteur de synchro envoie/récupère le blob `.sqlite` complet vers Supabase Storage, par utilisateur. Stratégie « la plus récente gagne » avec archivage automatique (snapshots) de toute version remplacée. La logique de décision et le moteur sont des unités pures, testées avec des doublures ; la couche réseau Supabase est un adaptateur fin.

**Tech Stack:** TypeScript, React 19, Vite, sql.js, localforage, `@supabase/supabase-js`, vitest.

**Référence spec :** `docs/superpowers/specs/2026-06-29-sync-cloud-supabase-design.md`

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/renderer/src/data/supabase.ts` | Crée le client supabase-js depuis les variables Vite (ou `null` si non configuré). |
| `src/renderer/src/data/sync/types.ts` | Interfaces et types partagés (sans dépendance réseau). |
| `src/renderer/src/data/sync/decision.ts` | `decide()` — logique pure de décision (pull/push/diverge). |
| `src/renderer/src/data/sync/hash.ts` | `sha256()` d'un `Uint8Array` (détection de changement de contenu). |
| `src/renderer/src/data/sync/localMeta.ts` | Métadonnées locales (localforage) : deviceId, base, hash, dates. |
| `src/renderer/src/data/sync/engine.ts` | `runSync()` — orchestration pure (testable avec doublures). |
| `src/renderer/src/data/sync/supabaseRemote.ts` | Adaptateur `SyncRemote` réel (Supabase Storage + table `sync_meta`). |
| `src/renderer/src/data/sync/auth.ts` | Connexion Google, session, déconnexion. |
| `src/renderer/src/data/sync/controller.ts` | Câble runSync ↔ vraie app : déclencheurs auto, état, rechargement après pull. |
| `src/renderer/src/components/CompteSyncModal.tsx` | UI « Compte & Synchro » (connexion, état, archives). |
| `src/renderer/src/data/__tests__/sync-decision.test.ts` | Tests de `decide()`. |
| `src/renderer/src/data/__tests__/sync-engine.test.ts` | Tests de `runSync()` avec doublures. |
| `docs/supabase-setup.md` + `scripts/supabase/schema.sql` | Procédure de configuration Supabase (réalisée par l'utilisatrice). |

**Dépendances entre tâches :** les tâches 3 et 6 (logique pure + moteur) ne dépendent **pas** de Supabase et sont entièrement testables tout de suite. Les tâches 5, 7, 8, 9 ne peuvent être **vérifiées** qu'après la configuration Supabase (tâche 2), réalisée par l'utilisatrice.

---

## Task 1 : Dépendance + configuration d'environnement

**Files:**
- Modify: `package.json` (ajout dépendance)
- Create: `src/renderer/src/data/supabase.ts`
- Modify: `src/renderer/src/env.d.ts`
- Create: `.env.local.example`
- Modify: `.gitignore`

- [ ] **Step 1: Installer la dépendance**

Run: `npm install @supabase/supabase-js`
Expected: ajout de `@supabase/supabase-js` dans `dependencies`, pas d'erreur.

- [ ] **Step 2: Déclarer les variables d'environnement Vite**

Modifier `src/renderer/src/env.d.ts` — ajouter sous la ligne `/// <reference types="react/jsx-runtime" />` :

```ts
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 3: Créer le client Supabase (nul si non configuré)**

Create `src/renderer/src/data/supabase.ts` :

```ts
// Client Supabase partagé. Renvoie null si les variables ne sont pas définies
// (l'app reste alors 100 % locale, sans synchro).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } }) : null

export function syncConfigured(): boolean {
  return supabase !== null
}
```

- [ ] **Step 4: Exemple d'environnement + ignore**

Create `.env.local.example` :

```
VITE_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
VITE_SUPABASE_ANON_KEY=VOTRE_CLE_ANON_PUBLIQUE
```

Ajouter `.env.local` à `.gitignore` (vérifier qu'il n'y est pas déjà) :

```
.env.local
```

- [ ] **Step 5: Vérifier la compilation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/renderer/src/data/supabase.ts src/renderer/src/env.d.ts .env.local.example .gitignore
git commit -m "feat(sync): client Supabase + config d'environnement"
```

---

## Task 2 : Configuration du backend Supabase (réalisée par l'utilisatrice)

> Claude ne peut pas créer de compte ni saisir d'identifiants. Cette tâche produit
> la **procédure** et le **SQL** ; l'utilisatrice les exécute dans son tableau de bord Supabase.

**Files:**
- Create: `docs/supabase-setup.md`
- Create: `scripts/supabase/schema.sql`

- [ ] **Step 1: SQL du schéma (table de version + RLS)**

Create `scripts/supabase/schema.sql` :

```sql
-- Table de métadonnées de synchro : une ligne par utilisateur.
create table if not exists public.sync_meta (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  version    bigint not null default 0,
  device_id  text   not null default '',
  updated_at timestamptz not null default now()
);

alter table public.sync_meta enable row level security;

-- Chaque utilisateur ne lit/écrit que sa propre ligne.
create policy "sync_meta_select_own" on public.sync_meta
  for select using (auth.uid() = user_id);
create policy "sync_meta_upsert_own" on public.sync_meta
  for insert with check (auth.uid() = user_id);
create policy "sync_meta_update_own" on public.sync_meta
  for update using (auth.uid() = user_id);
```

- [ ] **Step 2: Procédure détaillée**

Create `docs/supabase-setup.md` :

````markdown
# Configuration Supabase — synchronisation NeuroBoost

## 1. Créer le projet
1. Crée un compte sur https://supabase.com et un nouveau projet (région proche de toi).
2. Note l'**URL du projet** et la **clé `anon` publique** (Settings → API).

## 2. Activer la connexion Google
1. Dans Google Cloud Console, crée un **identifiant OAuth 2.0** (type « Application Web »).
   - URI de redirection autorisée : `https://VOTRE-PROJET.supabase.co/auth/v1/callback`
2. Dans Supabase → Authentication → Providers → **Google** : colle le *Client ID* et le *Client secret*, active.
3. Dans Authentication → URL Configuration : ajoute l'URL de ton app (ex. `http://localhost:5173`
   en dev et l'URL Cloudflare Pages en prod) aux **Redirect URLs**.

## 3. Créer le stockage
1. Storage → New bucket → nom `db-sync` → **Privé** (décoche « Public »).

## 4. Politiques d'accès au stockage (Storage policies)
Dans Storage → Policies, sur le bucket `db-sync`, crée une politique autorisant
chaque utilisateur à gérer uniquement les fichiers sous son dossier `{user_id}/` :

```sql
create policy "db-sync owner all"
  on storage.objects for all
  using ( bucket_id = 'db-sync' and (storage.foldername(name))[1] = auth.uid()::text )
  with check ( bucket_id = 'db-sync' and (storage.foldername(name))[1] = auth.uid()::text );
```

## 5. Table de version
SQL Editor → exécute le contenu de `scripts/supabase/schema.sql`.

## 6. Brancher l'app
Copie `.env.local.example` en `.env.local` et renseigne `VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY`. Pour la prod, ajoute ces variables dans les paramètres
du projet Cloudflare Pages.
````

- [ ] **Step 3: Commit (docs uniquement)**

```bash
git add docs/supabase-setup.md scripts/supabase/schema.sql
git commit -m "docs(sync): procédure de configuration Supabase + schéma SQL"
```

- [ ] **Step 4: Vérification (manuelle, par l'utilisatrice)**

L'utilisatrice confirme : projet créé, Google activé, bucket `db-sync` privé créé,
politiques appliquées, table `sync_meta` présente, `.env.local` renseigné.

---

## Task 3 : Types + logique de décision (TDD, pur)

**Files:**
- Create: `src/renderer/src/data/sync/types.ts`
- Create: `src/renderer/src/data/sync/decision.ts`
- Test: `src/renderer/src/data/__tests__/sync-decision.test.ts`

- [ ] **Step 1: Définir les types**

Create `src/renderer/src/data/sync/types.ts` :

```ts
export type RemoteMeta = { version: number; updatedAt: string; deviceId: string }
export type SnapshotInfo = { name: string; createdAt: string }

export interface SyncRemote {
  getMeta(): Promise<RemoteMeta | null>
  setMeta(version: number, deviceId: string): Promise<RemoteMeta>
  downloadCurrent(): Promise<Uint8Array | null>
  uploadCurrent(bytes: Uint8Array): Promise<void>
  copyCurrentToSnapshot(name: string): Promise<void>
  uploadSnapshot(name: string, bytes: Uint8Array): Promise<void>
  listSnapshots(): Promise<SnapshotInfo[]>
  downloadSnapshot(name: string): Promise<Uint8Array>
  deleteSnapshots(names: string[]): Promise<void>
}

export interface LocalDb {
  export(): Uint8Array
  import(bytes: Uint8Array): Promise<void>
}

export type LocalMeta = {
  deviceId: string
  baseVersion: number
  lastSyncedHash: string
  lastSeenHash: string
  lastEditAt: string
}

export interface LocalMetaStore {
  get(): Promise<LocalMeta>
  set(meta: LocalMeta): Promise<void>
}

export type SyncDecision =
  | 'noop' | 'push' | 'pull' | 'diverge-local-wins' | 'diverge-remote-wins'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'signed-out'

export type SyncResult = {
  decision: SyncDecision
  archived: boolean
  needsReload: boolean
}
```

- [ ] **Step 2: Écrire les tests (échouent)**

Create `src/renderer/src/data/__tests__/sync-decision.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { decide } from '../sync/decision'

const base = { localDirty: false, localEditAt: '2026-01-01T00:00:00Z', remoteVersion: 5, remoteUpdatedAt: '2026-01-01T00:00:00Z', baseVersion: 5 }

describe('decide', () => {
  it('noop quand rien n’a changé', () => {
    expect(decide(base)).toBe('noop')
  })
  it('push quand seul le local a changé', () => {
    expect(decide({ ...base, localDirty: true })).toBe('push')
  })
  it('pull quand seul le distant a avancé', () => {
    expect(decide({ ...base, remoteVersion: 6 })).toBe('pull')
  })
  it('push si aucune base distante mais contenu local', () => {
    expect(decide({ ...base, localDirty: true, remoteVersion: null, remoteUpdatedAt: null })).toBe('push')
  })
  it('noop si aucune base distante et rien en local', () => {
    expect(decide({ ...base, remoteVersion: null, remoteUpdatedAt: null })).toBe('noop')
  })
  it('divergence → local gagne si édité plus récemment', () => {
    expect(decide({ ...base, localDirty: true, remoteVersion: 6, localEditAt: '2026-02-02T00:00:00Z', remoteUpdatedAt: '2026-02-01T00:00:00Z' })).toBe('diverge-local-wins')
  })
  it('divergence → distant gagne si plus récent', () => {
    expect(decide({ ...base, localDirty: true, remoteVersion: 6, localEditAt: '2026-02-01T00:00:00Z', remoteUpdatedAt: '2026-02-02T00:00:00Z' })).toBe('diverge-remote-wins')
  })
})
```

- [ ] **Step 3: Lancer les tests (échec attendu)**

Run: `npx vitest run src/renderer/src/data/__tests__/sync-decision.test.ts`
Expected: FAIL (`decide` introuvable).

- [ ] **Step 4: Implémenter `decide`**

Create `src/renderer/src/data/sync/decision.ts` :

```ts
import type { SyncDecision } from './types'

export function decide(input: {
  localDirty: boolean
  localEditAt: string
  remoteVersion: number | null
  remoteUpdatedAt: string | null
  baseVersion: number
}): SyncDecision {
  const { localDirty, localEditAt, remoteVersion, remoteUpdatedAt, baseVersion } = input
  if (remoteVersion === null) return localDirty ? 'push' : 'noop'
  const remoteAdvanced = remoteVersion > baseVersion
  if (!remoteAdvanced && !localDirty) return 'noop'
  if (!remoteAdvanced && localDirty) return 'push'
  if (remoteAdvanced && !localDirty) return 'pull'
  return localEditAt >= (remoteUpdatedAt ?? '') ? 'diverge-local-wins' : 'diverge-remote-wins'
}
```

- [ ] **Step 5: Lancer les tests (succès)**

Run: `npx vitest run src/renderer/src/data/__tests__/sync-decision.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/data/sync/types.ts src/renderer/src/data/sync/decision.ts src/renderer/src/data/__tests__/sync-decision.test.ts
git commit -m "feat(sync): types + logique de décision (TDD)"
```

---

## Task 4 : Hash + métadonnées locales

**Files:**
- Create: `src/renderer/src/data/sync/hash.ts`
- Create: `src/renderer/src/data/sync/localMeta.ts`

- [ ] **Step 1: Fonction de hash**

Create `src/renderer/src/data/sync/hash.ts` :

```ts
// Empreinte SHA-256 d'un blob, en hexadécimal. Sert à détecter un changement
// de contenu de la base sans instrumenter chaque écriture.
export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}
```

- [ ] **Step 2: Magasin de métadonnées locales (localforage)**

Create `src/renderer/src/data/sync/localMeta.ts` :

```ts
import localforage from 'localforage'
import type { LocalMeta, LocalMetaStore } from './types'

const KEY = 'neuroboost-sync-meta'

function defaults(): LocalMeta {
  return {
    deviceId: crypto.randomUUID(),
    baseVersion: 0,
    lastSyncedHash: '',
    lastSeenHash: '',
    lastEditAt: new Date().toISOString()
  }
}

export const localMetaStore: LocalMetaStore = {
  async get() {
    const stored = await localforage.getItem<LocalMeta>(KEY)
    if (stored) return stored
    const fresh = defaults()
    await localforage.setItem(KEY, fresh)
    return fresh
  },
  async set(meta) {
    await localforage.setItem(KEY, meta)
  }
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/data/sync/hash.ts src/renderer/src/data/sync/localMeta.ts
git commit -m "feat(sync): hash de contenu + métadonnées locales"
```

---

## Task 5 : Moteur de synchro (TDD avec doublures)

**Files:**
- Create: `src/renderer/src/data/sync/engine.ts`
- Test: `src/renderer/src/data/__tests__/sync-engine.test.ts`

- [ ] **Step 1: Écrire les tests (échouent)**

Create `src/renderer/src/data/__tests__/sync-engine.test.ts` :

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { runSync } from '../sync/engine'
import type { LocalDb, LocalMeta, LocalMetaStore, RemoteMeta, SnapshotInfo, SyncRemote } from '../sync/types'

// Hash déterministe et lisible pour les tests : "h:<contenu>".
const hash = async (b: Uint8Array) => 'h:' + new TextDecoder().decode(b)
const bytesOf = (s: string) => new TextEncoder().encode(s)
const now = () => '2026-03-03T00:00:00Z'

function fakeLocal(initial: string): LocalDb & { content: string } {
  return {
    content: initial,
    export() { return bytesOf(this.content) },
    async import(b) { this.content = new TextDecoder().decode(b) }
  }
}

function fakeRemote(init?: { current?: string; meta?: RemoteMeta }): SyncRemote & { current: string | null; meta: RemoteMeta | null; snapshots: Record<string, string> } {
  return {
    current: init?.current ?? null,
    meta: init?.meta ?? null,
    snapshots: {},
    async getMeta() { return this.meta },
    async setMeta(version, deviceId) { this.meta = { version, deviceId, updatedAt: now() }; return this.meta },
    async downloadCurrent() { return this.current === null ? null : bytesOf(this.current) },
    async uploadCurrent(b) { this.current = new TextDecoder().decode(b) },
    async copyCurrentToSnapshot(name) { if (this.current !== null) this.snapshots[name] = this.current },
    async uploadSnapshot(name, b) { this.snapshots[name] = new TextDecoder().decode(b) },
    async listSnapshots() { return Object.keys(this.snapshots).map((name): SnapshotInfo => ({ name, createdAt: name })) },
    async downloadSnapshot(name) { return bytesOf(this.snapshots[name]) },
    async deleteSnapshots(names) { for (const n of names) delete this.snapshots[n] }
  }
}

function fakeStore(meta: LocalMeta): LocalMetaStore & { meta: LocalMeta } {
  return { meta, async get() { return this.meta }, async set(m) { this.meta = m } }
}

const baseMeta = (over: Partial<LocalMeta> = {}): LocalMeta => ({
  deviceId: 'devA', baseVersion: 0, lastSyncedHash: '', lastSeenHash: '', lastEditAt: '2026-01-01T00:00:00Z', ...over
})

describe('runSync', () => {
  it('push initial quand aucune base distante', async () => {
    const remote = fakeRemote()
    const local = fakeLocal('v1')
    const store = fakeStore(baseMeta())
    const res = await runSync(remote, local, store, hash, now)
    expect(res.decision).toBe('push')
    expect(remote.current).toBe('v1')
    expect(remote.meta?.version).toBe(1)
    expect(store.meta.baseVersion).toBe(1)
    expect(store.meta.lastSyncedHash).toBe('h:v1')
  })

  it('pull quand le distant a avancé et le local est propre', async () => {
    const remote = fakeRemote({ current: 'remoteV', meta: { version: 7, deviceId: 'devB', updatedAt: now() } })
    const local = fakeLocal('old')
    const store = fakeStore(baseMeta({ baseVersion: 6, lastSyncedHash: 'h:old', lastSeenHash: 'h:old' }))
    const res = await runSync(remote, local, store, hash, now)
    expect(res.decision).toBe('pull')
    expect(res.needsReload).toBe(true)
    expect(local.content).toBe('remoteV')
    expect(store.meta.baseVersion).toBe(7)
  })

  it('divergence → local gagne, archive le distant', async () => {
    const remote = fakeRemote({ current: 'remoteV', meta: { version: 7, deviceId: 'devB', updatedAt: '2026-02-01T00:00:00Z' } })
    const local = fakeLocal('localV')
    const store = fakeStore(baseMeta({ baseVersion: 6, lastSyncedHash: 'h:old', lastSeenHash: 'h:localV', lastEditAt: '2026-02-05T00:00:00Z' }))
    const res = await runSync(remote, local, store, hash, now)
    expect(res.decision).toBe('diverge-local-wins')
    expect(res.archived).toBe(true)
    expect(Object.values(remote.snapshots)).toContain('remoteV')
    expect(remote.current).toBe('localV')
    expect(remote.meta?.version).toBe(8)
  })

  it('divergence → distant gagne, archive le local', async () => {
    const remote = fakeRemote({ current: 'remoteV', meta: { version: 7, deviceId: 'devB', updatedAt: '2026-02-09T00:00:00Z' } })
    const local = fakeLocal('localV')
    const store = fakeStore(baseMeta({ baseVersion: 6, lastSyncedHash: 'h:old', lastSeenHash: 'h:localV', lastEditAt: '2026-02-05T00:00:00Z' }))
    const res = await runSync(remote, local, store, hash, now)
    expect(res.decision).toBe('diverge-remote-wins')
    expect(res.archived).toBe(true)
    expect(Object.values(remote.snapshots)).toContain('localV')
    expect(local.content).toBe('remoteV')
    expect(res.needsReload).toBe(true)
  })

  it('noop quand tout est aligné', async () => {
    const remote = fakeRemote({ current: 'same', meta: { version: 4, deviceId: 'devB', updatedAt: now() } })
    const local = fakeLocal('same')
    const store = fakeStore(baseMeta({ baseVersion: 4, lastSyncedHash: 'h:same', lastSeenHash: 'h:same' }))
    const res = await runSync(remote, local, store, hash, now)
    expect(res.decision).toBe('noop')
  })
})
```

- [ ] **Step 2: Lancer les tests (échec attendu)**

Run: `npx vitest run src/renderer/src/data/__tests__/sync-engine.test.ts`
Expected: FAIL (`runSync` introuvable).

- [ ] **Step 3: Implémenter le moteur**

Create `src/renderer/src/data/sync/engine.ts` :

```ts
import { decide } from './decision'
import type { LocalDb, LocalMetaStore, SyncRemote, SyncResult } from './types'

const RETENTION = 20

function snapName(iso: string): string {
  return `${iso.replace(/[:.]/g, '-')}.sqlite`
}

async function pruneNames(remote: SyncRemote): Promise<string[]> {
  const snaps = await remote.listSnapshots()
  const sorted = [...snaps].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)) // récents d'abord
  return sorted.slice(RETENTION).map((s) => s.name)
}

export async function runSync(
  remote: SyncRemote,
  local: LocalDb,
  store: LocalMetaStore,
  hash: (bytes: Uint8Array) => Promise<string>,
  now: () => string = () => new Date().toISOString()
): Promise<SyncResult> {
  const meta = await store.get()
  const localBytes = local.export()
  const localHash = await hash(localBytes)

  // Horloge d'édition : date le moment où le contenu local a changé.
  if (localHash !== meta.lastSeenHash) {
    meta.lastSeenHash = localHash
    meta.lastEditAt = now()
    await store.set(meta)
  }
  const localDirty = localHash !== meta.lastSyncedHash

  const remoteMeta = await remote.getMeta()
  const decision = decide({
    localDirty,
    localEditAt: meta.lastEditAt,
    remoteVersion: remoteMeta?.version ?? null,
    remoteUpdatedAt: remoteMeta?.updatedAt ?? null,
    baseVersion: meta.baseVersion
  })

  if (decision === 'noop') return { decision, archived: false, needsReload: false }

  if (decision === 'push' || decision === 'diverge-local-wins') {
    let archived = false
    if (remoteMeta) { await remote.copyCurrentToSnapshot(snapName(now())); archived = true }
    await remote.uploadCurrent(localBytes)
    const set = await remote.setMeta((remoteMeta?.version ?? 0) + 1, meta.deviceId)
    meta.baseVersion = set.version
    meta.lastSyncedHash = localHash
    await store.set(meta)
    await remote.deleteSnapshots(await pruneNames(remote))
    return { decision, archived, needsReload: false }
  }

  // pull ou diverge-remote-wins : la version distante l'emporte.
  let archived = false
  if (decision === 'diverge-remote-wins') {
    await remote.uploadSnapshot(snapName(now()), localBytes)
    archived = true
  }
  const bytes = await remote.downloadCurrent()
  if (!bytes) return { decision: 'noop', archived, needsReload: false }
  await local.import(bytes)
  const h = await hash(bytes)
  meta.baseVersion = remoteMeta!.version
  meta.lastSyncedHash = h
  meta.lastSeenHash = h
  await store.set(meta)
  if (archived) await remote.deleteSnapshots(await pruneNames(remote))
  return { decision, archived, needsReload: true }
}
```

- [ ] **Step 4: Lancer les tests (succès)**

Run: `npx vitest run src/renderer/src/data/__tests__/sync-engine.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/data/sync/engine.ts src/renderer/src/data/__tests__/sync-engine.test.ts
git commit -m "feat(sync): moteur de synchro orchestrant pull/push/divergence (TDD)"
```

---

## Task 6 : Adaptateur Supabase (`SyncRemote` réel)

**Files:**
- Create: `src/renderer/src/data/sync/supabaseRemote.ts`

- [ ] **Step 1: Implémenter l'adaptateur**

Create `src/renderer/src/data/sync/supabaseRemote.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RemoteMeta, SnapshotInfo, SyncRemote } from './types'

const BUCKET = 'db-sync'

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

// Crée un adaptateur lié à un utilisateur connecté (userId = auth.uid()).
export function createSupabaseRemote(supabase: SupabaseClient, userId: string): SyncRemote {
  const currentPath = `${userId}/current.sqlite`
  const snapDir = `${userId}/snapshots`
  const storage = supabase.storage.from(BUCKET)

  return {
    async getMeta(): Promise<RemoteMeta | null> {
      const { data, error } = await supabase
        .from('sync_meta')
        .select('version, device_id, updated_at')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return { version: Number(data.version), deviceId: data.device_id, updatedAt: data.updated_at }
    },

    async setMeta(version, deviceId): Promise<RemoteMeta> {
      const updated_at = new Date().toISOString()
      const { error } = await supabase
        .from('sync_meta')
        .upsert({ user_id: userId, version, device_id: deviceId, updated_at }, { onConflict: 'user_id' })
      if (error) throw error
      return { version, deviceId, updatedAt: updated_at }
    },

    async downloadCurrent(): Promise<Uint8Array | null> {
      const { data, error } = await storage.download(currentPath)
      if (error) return null // absent = première synchro
      return blobToBytes(data)
    },

    async uploadCurrent(bytes): Promise<void> {
      const { error } = await storage.upload(currentPath, new Blob([bytes]), {
        upsert: true,
        contentType: 'application/x-sqlite3'
      })
      if (error) throw error
    },

    async copyCurrentToSnapshot(name): Promise<void> {
      const { error } = await storage.copy(currentPath, `${snapDir}/${name}`)
      if (error) throw error
    },

    async uploadSnapshot(name, bytes): Promise<void> {
      const { error } = await storage.upload(`${snapDir}/${name}`, new Blob([bytes]), {
        upsert: true,
        contentType: 'application/x-sqlite3'
      })
      if (error) throw error
    },

    async listSnapshots(): Promise<SnapshotInfo[]> {
      const { data, error } = await storage.list(snapDir, { limit: 1000 })
      if (error) throw error
      return (data ?? []).map((f): SnapshotInfo => ({
        name: f.name,
        createdAt: f.created_at ?? f.name
      }))
    },

    async downloadSnapshot(name): Promise<Uint8Array> {
      const { data, error } = await storage.download(`${snapDir}/${name}`)
      if (error) throw error
      return blobToBytes(data)
    },

    async deleteSnapshots(names): Promise<void> {
      if (names.length === 0) return
      const { error } = await storage.remove(names.map((n) => `${snapDir}/${n}`))
      if (error) throw error
    }
  }
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/data/sync/supabaseRemote.ts
git commit -m "feat(sync): adaptateur Supabase Storage + table sync_meta"
```

---

## Task 7 : Authentification Google

**Files:**
- Create: `src/renderer/src/data/sync/auth.ts`

- [ ] **Step 1: Module d'auth**

Create `src/renderer/src/data/sync/auth.ts` :

```ts
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export type AuthUser = { id: string; email: string | null }

export async function getUser(): Promise<AuthUser | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const u = data.session?.user
  return u ? { id: u.id, email: u.email ?? null } : null
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error('Synchronisation non configurée')
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  })
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

// Notifie à chaque changement de session (connexion / déconnexion / refresh).
export function onAuthChange(cb: (user: AuthUser | null) => void): () => void {
  if (!supabase) { cb(null); return () => {} }
  const { data } = supabase.auth.onAuthStateChange((_e, session: Session | null) => {
    const u = session?.user
    cb(u ? { id: u.id, email: u.email ?? null } : null)
  })
  return () => data.subscription.unsubscribe()
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/data/sync/auth.ts
git commit -m "feat(sync): connexion Google (Supabase Auth)"
```

---

## Task 8 : Contrôleur de synchro (câblage app réelle)

**Files:**
- Create: `src/renderer/src/data/sync/controller.ts`
- Modify: `src/renderer/src/data/api.ts` (déclencheur après écriture)

- [ ] **Step 1: Contrôleur**

Create `src/renderer/src/data/sync/controller.ts` :

```ts
import { supabase } from '../supabase'
import { exportDb, importDb } from '../db'
import { runSync } from './engine'
import { sha256 } from './hash'
import { localMetaStore } from './localMeta'
import { createSupabaseRemote } from './supabaseRemote'
import { getUser, onAuthChange } from './auth'
import type { LocalDb, SyncStatus } from './types'

const localDb: LocalDb = {
  export: () => exportDb(),
  import: (bytes) => importDb(bytes)
}

let status: SyncStatus = 'idle'
const listeners = new Set<(s: SyncStatus) => void>()
let debounce: ReturnType<typeof setTimeout> | null = null
let running = false

function setStatus(s: SyncStatus): void {
  status = s
  for (const l of listeners) l(s)
}

export function getStatus(): SyncStatus { return status }
export function onStatus(cb: (s: SyncStatus) => void): () => void {
  listeners.add(cb); cb(status); return () => listeners.delete(cb)
}

export async function syncNow(): Promise<void> {
  if (!supabase || running) return
  if (!navigator.onLine) { setStatus('offline'); return }
  const user = await getUser()
  if (!user) { setStatus('signed-out'); return }
  running = true
  setStatus('syncing')
  try {
    const remote = createSupabaseRemote(supabase, user.id)
    const res = await runSync(remote, localDb, localMetaStore, sha256)
    setStatus('synced')
    if (res.needsReload) window.location.reload()
  } catch (err) {
    console.error('[sync] échec', err)
    setStatus('error')
  } finally {
    running = false
  }
}

// Déclencheur débouncé appelé après chaque opération de l'API.
export function scheduleSync(): void {
  if (!supabase) return
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(() => void syncNow(), 3000)
}

// À appeler une fois au démarrage de l'app.
export function initSyncController(): void {
  if (!supabase) { setStatus('idle'); return }
  onAuthChange((user) => { if (user) void syncNow(); else setStatus('signed-out') })
  window.addEventListener('online', () => void syncNow())
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void syncNow() })
  void syncNow() // pull initial
}

// Pour l'UI : liste et restauration d'archives.
export async function listArchives() {
  if (!supabase) return []
  const user = await getUser()
  if (!user) return []
  return createSupabaseRemote(supabase, user.id).listSnapshots()
}

export async function restoreArchive(name: string): Promise<void> {
  if (!supabase) return
  const user = await getUser()
  if (!user) return
  const remote = createSupabaseRemote(supabase, user.id)
  const bytes = await remote.downloadSnapshot(name)
  await importDb(bytes)
  // L'archive restaurée devient la base locale ; la prochaine synchro la propagera.
  const meta = await localMetaStore.get()
  meta.lastSyncedHash = ''
  meta.lastSeenHash = ''
  meta.lastEditAt = new Date().toISOString()
  await localMetaStore.set(meta)
  window.location.reload()
}
```

- [ ] **Step 2: Brancher le déclencheur après écriture**

Modifier `src/renderer/src/data/api.ts`. Ajouter l'import en tête (près des autres imports) :

```ts
import { scheduleSync } from './sync/controller'
```

Puis, dans le `Proxy` (méthode `get`, après `schedulePersist()`), ajouter l'appel :

```ts
    return (...args: unknown[]) => {
      const result = (value as (...a: unknown[]) => unknown)(...args)
      schedulePersist()
      scheduleSync()
      return result
    }
```

- [ ] **Step 3: Vérifier la compilation + tests existants**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run`
Expected: compilation OK, tous les tests existants + sync passent.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/data/sync/controller.ts src/renderer/src/data/api.ts
git commit -m "feat(sync): contrôleur (déclencheurs auto, état, restauration d'archives)"
```

---

## Task 9 : Interface « Compte & Synchro » + démarrage

**Files:**
- Create: `src/renderer/src/components/CompteSyncModal.tsx`
- Modify: `src/renderer/src/App.tsx` (entrée de menu + modale)
- Modify: `src/renderer/src/main.tsx` (init du contrôleur)
- Modify: `src/renderer/src/components/Icon.tsx` (icône `compte`)

- [ ] **Step 1: Icône compte**

Dans `src/renderer/src/components/Icon.tsx`, ajouter `'compte'` au type `IconName` et au mapping `PATHS` :

```tsx
  // Compte — silhouette
  compte: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
```

- [ ] **Step 2: Modale Compte & Synchro**

Create `src/renderer/src/components/CompteSyncModal.tsx` :

```tsx
import { useEffect, useState } from 'react'
import { syncConfigured } from '../data/supabase'
import { getUser, signInWithGoogle, signOut, type AuthUser } from '../data/sync/auth'
import { getStatus, onStatus, syncNow, listArchives, restoreArchive } from '../data/sync/controller'
import type { SyncStatus } from '../data/sync/types'
import type { SnapshotInfo } from '../data/sync/types'

const STATUT_LABEL: Record<SyncStatus, string> = {
  idle: 'Inactif', syncing: 'Synchronisation…', synced: 'Synchronisé',
  offline: 'Hors ligne', error: 'Erreur', 'signed-out': 'Non connecté'
}

export default function CompteSyncModal({ onFermer }: { onFermer: () => void }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [statut, setStatut] = useState<SyncStatus>(getStatus())
  const [archives, setArchives] = useState<SnapshotInfo[]>([])
  const configured = syncConfigured()

  useEffect(() => {
    getUser().then(setUser)
    return onStatus(setStatut)
  }, [])

  useEffect(() => {
    if (user) listArchives().then(setArchives).catch(console.error)
  }, [user, statut])

  return (
    <div className="modal-overlay" onClick={onFermer}>
      <div className="card modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 18, fontFamily: 'var(--font-display)' }}>Compte & Synchro</div>
          <button className="btn-icon" onClick={onFermer}>✕</button>
        </div>

        {!configured ? (
          <div className="text-muted">
            La synchronisation n'est pas configurée. Voir <code>docs/supabase-setup.md</code>.
          </div>
        ) : !user ? (
          <>
            <div className="text-muted" style={{ marginBottom: 14 }}>
              Connecte-toi pour retrouver tes données sur tous tes appareils.
            </div>
            <button className="btn-launch" onClick={() => void signInWithGoogle()}>
              Se connecter avec Google
            </button>
          </>
        ) : (
          <>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{user.email}</div>
                <div className="text-muted">État : {STATUT_LABEL[statut]}</div>
              </div>
              <button className="btn-ghost" onClick={() => void signOut()}>Se déconnecter</button>
            </div>
            <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => void syncNow()}>
              Synchroniser maintenant
            </button>

            <div className="section-header">Archives</div>
            {archives.length === 0 ? (
              <div className="text-muted">Aucune archive.</div>
            ) : (
              <div className="col" style={{ gap: 6 }}>
                {archives.map((a) => (
                  <div key={a.name} className="row-between">
                    <span className="text-muted">{a.createdAt}</span>
                    <button
                      className="btn-ghost"
                      onClick={() => { if (confirm('Restaurer cette archive ? La base actuelle sera remplacée (et sauvegardée).')) void restoreArchive(a.name) }}
                    >
                      Restaurer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Initialiser le contrôleur au démarrage**

Modifier `src/renderer/src/main.tsx` :

```tsx
import './assets/main.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initApi } from './data/api'
import { initSyncController } from './data/sync/controller'

initApi().then(() => {
  initSyncController()
  ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
```

- [ ] **Step 4: Entrée de menu + modale dans App**

Dans `src/renderer/src/App.tsx` :

a) ajouter l'état près de `backupOuvert` :

```tsx
  const [compteOuvert, setCompteOuvert] = useState(false)
```

b) importer la modale (près des autres imports de composants) :

```tsx
import CompteSyncModal from './components/CompteSyncModal'
```

c) afficher la modale (près de `{backupOuvert && <BackupModal … />}`) :

```tsx
      {compteOuvert && <CompteSyncModal onFermer={() => setCompteOuvert(false)} />}
```

d) ajouter le bouton dans la barre latérale, juste avant le bouton « Sauvegarde » :

```tsx
        <button className="nav-item" onClick={() => { setCompteOuvert(true); setSidebarOuvert(false) }}>
          <span className="nav-icon"><Icon name="compte" /></span>
          Compte & Synchro
        </button>
```

- [ ] **Step 5: Vérifier compilation + build + tests**

Run: `npx tsc --noEmit -p tsconfig.json && npx vitest run`
Expected: compilation OK, tous les tests passent.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/components/CompteSyncModal.tsx src/renderer/src/components/Icon.tsx src/renderer/src/App.tsx src/renderer/src/main.tsx
git commit -m "feat(sync): interface Compte & Synchro + init au démarrage"
```

---

## Task 10 : Vérification de bout en bout + mémoire

> Nécessite la configuration Supabase (tâche 2) et `.env.local` renseigné.

- [ ] **Step 1: Vérification manuelle (un appareil)**

1. `npm run dev`, ouvrir l'app.
2. Ouvrir « Compte & Synchro » → « Se connecter avec Google » → autoriser.
3. Créer une tâche. Attendre ~3 s → l'état passe à « Synchronisé ».
4. Vérifier dans Supabase → Storage → `db-sync/{userId}/current.sqlite` présent ;
   table `sync_meta` : `version` ≥ 1.

- [ ] **Step 2: Vérification manuelle (deux appareils / deux navigateurs)**

1. Sur un 2ᵉ navigateur (ou le téléphone), se connecter avec le même compte Google.
2. À l'ouverture, l'app récupère la base et recharge ; la tâche créée à l'étape
   précédente apparaît.
3. Modifier des deux côtés hors ligne (couper le réseau, éditer, rétablir) →
   vérifier qu'une **archive** est créée et restaurable, sans perte de données.

- [ ] **Step 3: Mettre à jour la mémoire projet**

Mettre à jour `C:\Users\lucil\.claude\projects\C--Users-lucil-Documents-neuroboost\memory\data-safety-backup.md`
pour indiquer que la **synchro cloud Phase 1 (Google + Supabase, blob entier, plus-récent-gagne + archives)**
est livrée, et que la fusion ligne par ligne reste en Phase 2. Mettre à jour la ligne correspondante de `MEMORY.md`.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "docs(sync): vérification E2E + mise à jour mémoire projet"
```

---

## Auto-revue du plan (effectuée)

- **Couverture spec :** connexion Google (T7), Auth Supabase (T1/T7), stockage blob par utilisateur (T6), pull/push auto (T5/T8), divergence + plus-récent-gagne (T5/T3), archives + rétention 20 + restauration (T5/T8/T9), indicateur d'état (T8/T9), hors-ligne non bloquant (T8), RLS/bucket privé (T2), gestion d'erreurs (T8), tests unitaires logique+moteur (T3/T5). ✔ Toutes les sections de la spec sont couvertes.
- **Placeholders :** aucun « TODO/TBD » ; tout le code des modules testés est complet. Les tâches non testables automatiquement (Supabase/UI) ont des étapes de vérification manuelle explicites.
- **Cohérence des types :** `SyncRemote`, `LocalMeta`, `SyncDecision`, `SyncResult`, `RemoteMeta`, `SnapshotInfo` définis en T3 et réutilisés à l'identique en T5/T6/T7/T8/T9. `runSync(remote, local, store, hash, now)` cohérent entre engine et controller. `decide({...})` cohérent entre tests et engine.
