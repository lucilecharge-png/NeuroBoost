# Découpe d'une tâche en sous-tâches (Tunnel) — Design

**Date** : 2026-06-25
**Statut** : validé (à implémenter)

## Objectif

Dans le Tunnel, permettre à l'utilisateur de découper la tâche en cours
(« Maintenant ») en N sous-tâches. L'IA propose N sous-tâches adaptées au
titre/contexte ; l'utilisateur les modifie, en ajoute ou en supprime, puis les
crée comme vraies quêtes enfants.

Exemple : « Préparer mon anniversaire » → l'utilisateur choisit 3 → l'IA propose
*Fixer la date et le lieu* / *Inviter les gens* / *Prévoir gâteau & boissons* →
l'utilisateur ajuste → 3 quêtes enfants sont créées.

## Décisions validées

1. **Sous-tâches = vraies quêtes enfants** (pas une simple checklist). Chacune a
   sa propre XP/coins et défile dans le Tunnel une par une.
2. **Génération par IA** via Claude (la seule fonctionnalité réseau de l'app,
   sinon 100 % hors-ligne).
3. **Clé API côté serveur** dans une Cloudflare Pages Function — jamais exposée
   au navigateur.
4. **Modèle `claude-haiku-4-5`** (rapide et économe ; le découpage est simple).
5. **Le parent devient un « projet contenant »** : auto-complété quand sa
   dernière sous-tâche est terminée (effet « boss vaincu » + sa propre XP).
6. **Repli gracieux** : si l'IA est injoignable (hors-ligne, ou `vite` sans
   backend), le panneau s'ouvre avec N champs vides + indices pour un découpage
   manuel. La fonctionnalité ne casse jamais.

## Comportement (UX)

Sur la carte « 👉 Maintenant » du Tunnel, ajouter un bouton **« ✂️ Découper »**.
Au clic, un panneau s'ouvre **dans la carte** :

1. Sélecteur de nombre (− / N / +), bornes 2–6, défaut 3.
2. Bouton **« Proposer »** → appel IA → N propositions.
3. N **champs éditables** pré-remplis (texte modifiable, suppression possible,
   ajout d'un champ vide possible).
4. Bouton **« Créer les sous-tâches »** → crée N quêtes enfants `parentId =
   tache.id`, recharge le Tunnel sur la première sous-tâche.

États du panneau : `idle` → `chargement` (spinner pendant l'appel IA) →
`edition` (champs éditables) ; sur erreur réseau, bascule en `edition` avec des
champs vides (repli gracieux) et un message discret.

## Modèle de données (migration v9)

Ajout dans `migrations.ts` (nouvelle entrée du tableau `MIGRATIONS`, index 8 →
`user_version` 9) :

```sql
ALTER TABLE taches ADD COLUMN parent_id INTEGER REFERENCES taches(id) ON DELETE CASCADE;
CREATE INDEX idx_taches_parent ON taches(parent_id);
```

- `TacheDTO` gagne `parentId: number | null`.
- `tacheToDTO` mappe `parent_id` → `parentId`.

### Règles parent / enfants

- **Listing du Tunnel** : un parent qui a au moins une sous-tâche encore active
  (`statut IN ('active','en_cours')`) n'apparaît PAS dans la liste « Maintenant »
  — ce sont ses enfants qui défilent. Les enfants apparaissent normalement.
- **Auto-complétion du parent** : dans `terminerTache(enfant)`, après avoir
  terminé l'enfant, si l'enfant a un `parent_id` et qu'il ne reste plus aucune
  sous-tâche active pour ce parent, terminer aussi le parent (récompense +
  célébration). La célébration du parent peut être renvoyée/fusionnée dans le
  `CompletionResult`.
- **Suppression** : `ON DELETE CASCADE` supprime les enfants si le parent est
  supprimé.

## Architecture de l'appel IA

```
TunnelScreen (front)
  └─ window.api.decouperTache({ titre, description, pourquoi, categorie }, nombre)
       └─ fetch('/api/decoupe', { method: POST, body: {...} })
            └─ functions/api/decoupe.ts  (Cloudflare Pages Function)
                 ├─ lit env.ANTHROPIC_API_KEY (secret Cloudflare)
                 └─ Claude (claude-haiku-4-5) + sortie structurée JSON
                      → [{ titre, dureeEstimeeMin, niveauEnergie }, ...]
```

### Pages Function `functions/api/decoupe.ts`

- Méthode `onRequestPost`.
- Lit le corps `{ titre, description?, pourquoi?, categorie?, nombre }`.
- Valide `nombre` (2–6), `titre` non vide.
- Appelle Claude via `@anthropic-ai/sdk` :
  - `model: "claude-haiku-4-5"`
  - **PAS de paramètre `effort`** (non supporté par Haiku 4.5 → 400).
  - **PAS de `thinking`** (tâche simple).
  - `max_tokens` ~1024, non-streaming.
  - `output_config.format` = schéma JSON `{ sousTaches: [{ titre: string,
    dureeEstimeeMin: integer, niveauEnergie: enum }] }` (longueur attendue =
    `nombre`).
  - System prompt : « Tu aides une personne TDAH à découper une tâche en N
    étapes concrètes, actionnables, dans l'ordre logique. Étapes courtes et
    démarrables. Réponds en français. »
- Renvoie `{ sousTaches: SousTacheProposee[] }` en JSON.
- Sur erreur (clé manquante, 4xx/5xx Claude) : renvoyer un statut d'erreur ; le
  front bascule alors en repli gracieux.

### Types (`src/shared/types.ts`)

```ts
export interface SousTacheProposee {
  titre: string
  dureeEstimeeMin?: number
  niveauEnergie?: NiveauEnergie
}
```

Ajouts à `NeuroBoostApi` :

```ts
decouperTache: (
  input: { titre: string; description?: string | null; pourquoi?: string | null; categorie?: string | null },
  nombre: number
) => Promise<SousTacheProposee[]>            // RÉSEAU (seule méthode réseau)

creerSousTaches: (parentId: number, sousTaches: TacheInput[]) => Promise<TacheDTO[]>  // local
```

### Couche données (`src/renderer/src/data/`)

- `game.ts` :
  - `tacheToDTO` : ajoute `parentId`.
  - `listTaches` : exclut les parents ayant ≥1 sous-tâche active (sous-requête
    `NOT EXISTS`).
  - `creerSousTaches(db, parentId, sousTaches)` : insère N enfants (réutilise la
    logique XP/coins par énergie de `createTache`), renvoie les DTO.
  - `terminerTache` : après complétion, gère l'auto-complétion du parent.
- `api.ts` :
  - `decouperTache` : `fetch('/api/decoupe', ...)`, parse, renvoie le tableau ;
    relance/propagation d'erreur pour que le front gère le repli.
  - `creerSousTaches` : délègue à `G.creerSousTaches`.
  - **Ne pas** passer `decouperTache` par le proxy de persistance différée (pas
    d'écriture BDD) — ou neutre, mais éviter un `schedulePersist` inutile.

### UI (`src/renderer/src/screens/TunnelScreen.tsx`)

- État local : `decoupeOuvert`, `nombre`, `phase` (`idle|chargement|edition`),
  `propositions: string[]`.
- Bouton « ✂️ Découper » sur la carte « Maintenant ».
- Panneau : sélecteur de nombre, bouton « Proposer », liste de champs éditables
  (avec ajout/suppression), bouton « Créer les sous-tâches » → `creerSousTaches`
  → `charger()`.

## Déploiement & dev

- **Prod** : secret `ANTHROPIC_API_KEY` via dashboard Cloudflare ou
  `wrangler pages secret put ANTHROPIC_API_KEY`.
- **Dev** : fichier `.dev.vars` (gitignoré) avec `ANTHROPIC_API_KEY=...` ;
  tester avec `wrangler pages dev` (nouveau script `dev:cf`). Sous `vite` simple,
  l'appel échoue proprement → repli gracieux.
- `package.json` : ajouter `@anthropic-ai/sdk` en dépendance ; script
  `"dev:cf": "wrangler pages dev"` (à ajuster pour proxy vite si besoin).
- `.dev.vars.example` committé (sans secret) + `.gitignore` mis à jour
  (`.dev.vars`).

## Fichiers touchés

| Fichier | Changement |
|---|---|
| `functions/api/decoupe.ts` *(nouveau)* | Pages Function proxy → Claude |
| `src/renderer/src/data/migrations.ts` | migration v9 (`parent_id` + index) |
| `src/shared/types.ts` | `parentId`, `SousTacheProposee`, méthodes API |
| `src/renderer/src/data/game.ts` | `tacheToDTO`, `listTaches`, `creerSousTaches`, auto-complétion parent |
| `src/renderer/src/data/api.ts` | `decouperTache` (réseau) + `creerSousTaches` (local) |
| `src/renderer/src/screens/TunnelScreen.tsx` | bouton + panneau de découpe |
| `package.json` | dép `@anthropic-ai/sdk`, script `dev:cf` |
| `.dev.vars.example`, `.gitignore` *(nouveau/maj)* | clé API en dev |

## Hors périmètre (YAGNI)

- Découpe récursive (sous-sous-tâches).
- Réordonnancement des sous-tâches par glisser-déposer.
- Découpe depuis d'autres écrans que le Tunnel.
- Historique / régénération des propositions IA.
```