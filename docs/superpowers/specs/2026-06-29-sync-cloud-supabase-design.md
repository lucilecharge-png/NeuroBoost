# Synchronisation cloud — Phase 1 : compte Google + base synchronisée (Supabase)

Date : 2026-06-29
Statut : conception validée (en attente de relecture utilisateur avant le plan d'implémentation)

## Problème

Aujourd'hui, les données de NeuroBoost sont **100 % locales** : la base SQLite
complète (sql.js / WASM) est sérialisée et stockée sous une seule clé dans
IndexedDB. Il n'existe ni compte, ni serveur. Conséquence : impossible de
retrouver ses tâches, quêtes, agenda, etc. d'un appareil à l'autre.

L'utilisatrice veut **retrouver les mêmes données sur son PC et son téléphone**,
en s'identifiant avec **Google**, avec une synchronisation **automatique**.

## Décisions de conception (verrouillées)

| Sujet | Décision |
|---|---|
| Identité / connexion | **Google** (via Supabase Auth) |
| Backend | **Supabase** (Auth + Storage) |
| Granularité de synchro | **Base entière** (un blob `.sqlite`), pas de fusion ligne par ligne |
| Conflits | **« La plus récente gagne »** + **archivage automatique** de la version remplacée (restaurable) |
| Déclenchement | **Automatique** : pull à l'ouverture, push débouncé après modification |
| Hors ligne | L'app reste 100 % utilisable en local ; la synchro reprend à la reconnexion |

## Périmètre

**Inclus (Phase 1) :**
- Connexion / déconnexion Google.
- Envoi (push) et récupération (pull) automatiques de la base complète.
- Détection de divergence entre appareils → conservation du plus récent + archivage de l'autre.
- Restauration d'une archive depuis l'interface.
- Indicateur d'état de synchro (synchronisé / en attente / hors ligne / non connecté).
- Fonctionnement hors ligne et sans compte inchangé.

**Exclu (Phase 2, spec séparée ultérieure) :**
- Fusion ligne par ligne (résolution automatique des modifications parallèles
  sans archivage). Nécessiterait : identifiants UUID, dates de modification par
  ligne, pierres tombales (tombstones), moteur de fusion. Non payé tant que le
  besoin réel n'est pas constaté.
- Chiffrement de bout en bout du blob.

## Architecture

### Côté Supabase (externe, configuré par l'utilisatrice)

1. **Auth** — fournisseur Google activé. Identifie l'utilisateur par son `user.id` Supabase.
2. **Storage** — bucket **privé** `db-sync` :
   - `{userId}/current.sqlite` — la base à jour.
   - `{userId}/snapshots/{ISO-timestamp}.sqlite` — archives des versions remplacées.
   - **RLS** (Row Level Security) : un utilisateur n'accède qu'aux objets sous son propre `{userId}/`.
3. **Métadonnée de version** par utilisateur — table `sync_meta (user_id,
   version, updated_at, device_id)` protégée par RLS (préférée à un objet JSON
   dans le bucket, car une table permet une vérification de version atomique et
   évite les conditions de course au moment du push). Sert à comparer « qui est
   le plus récent » sans télécharger tout le blob.

### Côté application (PWA)

- **`data/auth.ts`** — encapsule `supabase-js` : `signInWithGoogle()`,
  `signOut()`, `getSession()`, `onAuthStateChange()`.
- **`data/sync.ts`** — moteur de synchronisation. Responsabilités :
  - `pull()` / `push()` (réseau, via Supabase Storage),
  - décision de synchro (logique pure, testable) selon `(localVersion, remoteVersion, lastSyncedVersion)`,
  - archivage (snapshot) avant tout remplacement,
  - exposition de l'état de synchro à l'UI.
  S'appuie sur `exportDb()` / `importDb()` déjà présents dans `data/db.ts`.
- **Métadonnées locales** (localforage) : `lastSyncedVersion`, `localVersion`
  (incrémenté à chaque écriture, branché sur `schedulePersist()`), `deviceId`
  (UUID généré une fois par appareil).
- **UI « Compte & Synchro »** — section dans la barre latérale, près de
  « Sauvegarde » : bouton de connexion Google, état de synchro, heure de
  dernière synchro, liste des archives restaurables.

## Flux de données

### Numéro de version
Chaque écriture locale (déjà coalescée par `schedulePersist()`) incrémente
`localVersion`. La version distante est un compteur croissant côté serveur,
accompagné d'un horodatage `updated_at` et du `device_id` du dernier push.
`lastSyncedVersion` mémorise la dernière version commune connue (la « base »).

### Pull (à l'ouverture, si connectée)
Lire la version distante, puis comparer :
- **Distant > base** ET **local == base** (aucune modif locale en attente) →
  télécharger, valider, `importDb()`, `lastSyncedVersion = remote`, recharger la page.
- **Local > base** ET **distant == base** → push (voir ci-dessous).
- **Distant > base** ET **local > base** → **divergence** (voir ci-dessous).
- **Égalité** → rien à faire.

### Push (après modification, débouncé ~quelques secondes)
Avant d'écraser le distant, revérifier la version distante :
- Si elle n'a pas bougé depuis le dernier pull → archiver l'ancien `current.sqlite`
  distant dans `snapshots/`, téléverser le nouveau blob, incrémenter la version,
  mettre à jour `updated_at` + `device_id`, `lastSyncedVersion = nouvelle version`.
- Si elle a bougé → **divergence** (voir ci-dessous).

### Divergence (les deux appareils ont avancé depuis la base)
« La plus récente gagne » selon l'horodatage :
- La version la plus récente est conservée comme `current.sqlite`.
- La version perdante est **archivée** dans `snapshots/`.
- L'utilisatrice est notifiée : « Une version concurrente a été archivée — la restaurer ? ».

### Archives (filet de sécurité)
Avant tout remplacement (local ou distant), la version qui serait perdue est
copiée dans `snapshots/`. **Rétention** : conserver les **20 dernières** archives
(valeur par défaut, ajustable). Restauration depuis l'UI = `importDb()` du snapshot
choisi (avec rechargement de page, comme le mécanisme de sauvegarde actuel l'exige).

### Hors ligne / non connecté
Sans session ou sans réseau, l'app fonctionne entièrement en local (comportement
actuel). À la reconnexion, le moteur reprend : push des changements locaux en
attente, avec détection de divergence.

## Sécurité & confidentialité

- Bucket **privé** + **RLS** : seul le propriétaire accède à ses blobs. Transport HTTPS.
- La **clé anon** Supabase est publique et destinée au client ; la sécurité repose
  sur RLS, pas sur le secret de la clé.
- **Limite assumée en Phase 1** : la base n'est pas chiffrée de bout en bout ;
  Supabase voit la donnée au repos (comme tout backend). Chiffrement client = amélioration future possible.

## Gestion des erreurs

- **Hors ligne / échec réseau** : synchro reportée silencieusement ; app utilisable ; indicateur « non synchronisé ».
- **Session expirée / échec d'auth** : invite à se reconnecter, sans bloquer l'usage local.
- **Blob distant illisible/corrompu** : on ne remplace **jamais** la base locale
  sans validation préalable (réutilise la validation de `importDb()` : présence de
  la table `profil`). En cas d'échec, on conserve le local et on signale.
- **Échec d'archivage** : le remplacement est annulé (on ne perd jamais une version
  sans l'avoir d'abord archivée).

## Tests

- **Unitaires (vitest)** sur la **logique de décision** du moteur de synchro,
  isolée du réseau via un stockage simulé (mock du client Storage) :
  - choix pull / push / divergence selon `(localVersion, remoteVersion, lastSyncedVersion)`,
  - sélection « la plus récente gagne » par horodatage,
  - déclenchement de l'archivage avant remplacement,
  - rétention des 20 dernières archives.
- **Non testé unitairement** : la couche réseau Supabase réelle (dépendance externe),
  vérifiée manuellement.
- S'inscrit dans la lignée des tests existants (`vitest`, `data/__tests__/testDb.ts`).

## Configuration requise (par l'utilisatrice, guidée pas à pas)

> Claude ne peut pas créer de compte ni saisir d'identifiants à la place de
> l'utilisatrice. Ces étapes sont réalisées par elle ; Claude fournit la marche à suivre.

1. Créer un projet **Supabase** gratuit.
2. Créer un **identifiant OAuth Google** (Google Cloud) et activer le fournisseur Google dans Supabase.
3. Créer le bucket privé `db-sync` et les politiques RLS.
4. Renseigner `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans la config front (variables Vite).

## Découpage

Cette spec couvre **la Phase 1 complète**. La Phase 2 (fusion ligne par ligne)
fera l'objet d'une spec distincte si l'usage réel en démontre le besoin.
