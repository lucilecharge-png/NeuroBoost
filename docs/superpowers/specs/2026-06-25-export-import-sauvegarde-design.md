# Export / Import de la sauvegarde — Design

**Date :** 2026-06-25
**Statut :** validé en brainstorming, prêt pour plan d'implémentation

## Contexte & objectif

NeuroBoost est une PWA dont la couche données est 100 % navigateur :

- `src/renderer/src/data/db.ts` — SQLite via **sql.js** (WASM). La base vit en
  mémoire (`dbInstance: Database`) et est sérialisée en `Uint8Array` puis
  persistée dans **IndexedDB** (localforage, clé `neuroboost-db`) via `persist()`.
- `src/renderer/src/data/api.ts` — pose `window.api`, déclenche `schedulePersist()`
  (différé 200 ms) après chaque mutation.
- `src/renderer/src/data/migrations.ts` — migrations versionnées via
  `PRAGMA user_version`, rejouées au démarrage dans `initDb()`.

**Problème :** les données ne vivent que dans IndexedDB. Elles peuvent disparaître
(vidage du cache navigateur, éviction sous pression de stockage, navigation
privée) et ne sont pas transférables vers un autre appareil/navigateur. Il
n'existe aujourd'hui **aucune sauvegarde hors-navigateur**.

**Objectif :** permettre à l'utilisatrice d'**exporter** toutes ses données dans
un fichier qu'elle contrôle, et de les **réimporter** (même appareil après un
effacement, ou nouvel appareil).

## Décisions de cadrage (issues du brainstorming)

- **Format de fichier** : `.sqlite` binaire brut (le `Uint8Array` de
  `dbInstance.export()`). Fidèle à 100 %, code minimal, aligné sur l'architecture
  existante. Écarté : JSON par table (beaucoup de code, fragile au schéma) et
  base64/texte (aucun avantage).
- **Emplacement UI** : bouton discret « 💾 Sauvegarde » en bas de la barre
  latérale, ouvrant une **modale** avec Export et Import.
- **Modèle d'import** : remplacement **complet** de la base (le fichier est la
  base entière), précédé d'une **confirmation** explicite.
- **Périmètre** : pas de synchronisation cloud, pas de backup automatique, pas
  d'export JSON. Uniquement export/import manuel d'un fichier.

## Architecture

### 1. Logique données — `src/renderer/src/data/db.ts`

Deux fonctions exportées, à côté de `persist()` :

```ts
// Sérialise la base en mémoire (fichier SQLite complet).
export function exportDb(): Uint8Array

// Remplace la base courante par le contenu d'un fichier importé.
export async function importDb(bytes: Uint8Array): Promise<void>
```

**`exportDb()`**
- Lève une erreur si `dbInstance` est nul (base non initialisée).
- Retourne `dbInstance.export()`.

**`importDb(bytes)`** — ordre des étapes choisi pour la sûreté :
1. `const next = new SQL.Database(bytes)` — **valide** le fichier. Si ce n'est pas
   une base SQLite valide, sql.js lève → on laisse l'erreur remonter **avant**
   d'avoir touché à `dbInstance`. Les données actuelles restent intactes.
2. `next.run('PRAGMA foreign_keys = ON')`.
3. **Rejoue les migrations** sur `next` (même boucle que `initDb`, en
   factorisant la logique dans une fonction interne `runMigrations(database)`
   réutilisée par `initDb` et `importDb`) — un backup d'une version antérieure de
   l'app est ainsi mis à niveau automatiquement.
4. Remplace `dbInstance = next` et `dbWrapped = wrap(next)`.
5. `await persist()` — écrit immédiatement la nouvelle base dans IndexedDB.

`SQL` (le `SqlJsStatic`) est déjà mémorisé au niveau module par `initDb` ;
`importDb` suppose que `initDb` a déjà tourné (vrai : l'app appelle `initApi`
au démarrage). Si `SQL` est nul, `importDb` lève une erreur claire.

### 2. UI — `src/renderer/src/components/BackupModal.tsx`

Nouveau composant modale, dans le style des modales existantes
(`TemplatesModal`, `RevueHebdoModal`). Props : `{ onFermer: () => void }`.

**Export**
- Bouton « Exporter mes données ».
- `const octets = exportDb()` → `new Blob([octets], { type: 'application/x-sqlite3' })`
  → `URL.createObjectURL` → `<a download>` cliqué par programmation → `revokeObjectURL`.
- Nom de fichier : `neuroboost-sauvegarde-AAAA-MM-JJ.sqlite` (date du jour).

**Import**
- Bouton « Importer une sauvegarde » → `<input type="file" accept=".sqlite">`.
- À la sélection : **confirmation** (« Importer cette sauvegarde remplacera
  toutes tes données actuelles. Continuer ? »).
- Si confirmé : lit le fichier (`file.arrayBuffer()` → `new Uint8Array`),
  appelle `await importDb(bytes)`, puis `window.location.reload()` pour que tous
  les écrans repartent sur les nouvelles données.
- En cas d'erreur (`importDb` lève) : affiche un message d'erreur dans la modale,
  ne recharge pas, les données actuelles sont préservées.

Pour garder la frontière propre, `exportDb`/`importDb` sont importés directement
depuis `./data/db` par la modale (ce ne sont pas des opérations « métier » qui
passent par `window.api`).

### 3. Branchement — `src/renderer/src/App.tsx`

- État `const [backup, setBackup] = useState(false)`.
- Bouton « 💾 Sauvegarde » ajouté dans la sidebar près du bouton « 🌙 Rituel »
  (après le `<div style={{ flex: 1 }} />`).
- Rendu conditionnel `{backup && <BackupModal onFermer={() => setBackup(false)} />}`.

## Gestion d'erreurs

| Cas | Comportement |
|-----|--------------|
| Fichier importé non-SQLite / corrompu | `new SQL.Database` lève → message dans la modale, base actuelle intacte |
| `dbInstance`/`SQL` nul à l'export/import | Fonction lève une erreur claire ; en pratique impossible après démarrage |
| Annulation de la confirmation d'import | Aucune action, modale reste ouverte |

Invariant central : **`dbInstance` n'est jamais remplacé tant que le nouveau
fichier n'a pas été validé**. Un import raté est sans conséquence.

## Tests

Test unitaire (Vitest, infra `__tests__/` + `testDb.ts` existante) :
`src/renderer/src/data/__tests__/backup.test.ts`

- **Round-trip** : créer une base, écrire des données (ex. profil + une quête),
  sérialiser via la même mécanique que `exportDb`, recharger dans une nouvelle
  instance via la même mécanique que `importDb`, vérifier que les données sont
  identiques.
- **Fichier invalide** : tenter de charger un `Uint8Array` non-SQLite et vérifier
  que ça lève (donc que l'ancienne base serait préservée).

Note : `exportDb`/`importDb` réels touchent `localforage`/`window` ; le test
valide la logique de round-trip sql.js sous-jacente avec `makeTestDb`, sans
dépendance navigateur, ou en factorisant la partie pure (sérialisation +
migrations) testable isolément.

## Hors périmètre (volontairement)

- Synchronisation cloud (Cloudflare) — chantier séparé, voir
  `architecture-pwa-cloudflare`.
- Sauvegarde automatique périodique.
- `navigator.storage.persist()` (protection anti-éviction) — amélioration
  complémentaire possible plus tard.
- Export JSON lisible.
