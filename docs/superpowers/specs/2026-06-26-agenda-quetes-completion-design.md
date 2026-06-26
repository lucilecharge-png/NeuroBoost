# Agenda ↔ Quêtes : marquer un événement « fait »

Date : 2026-06-26

## Objectif

Permettre de marquer un événement de l'agenda comme « fait » et que cette action
se répercute côté Quêtes : soit en terminant une quête déjà liée, soit en créant
une « quête éclair » terminée à la volée. La complétion rapporte XP + coins +
achievements (célébration), exactement comme terminer une quête.

## Décisions cadrées (issues du brainstorming)

- **Comportement** : les deux selon le cas. Si l'événement est lié à une quête
  active → on la termine. Sinon → on crée une quête à la volée et on la termine.
- **Déclencheur** : case à cocher directement sur la pastille de l'événement
  **et** bouton équivalent dans le modal.
- **Récurrence** : la complétion est **par occurrence** (cocher lundi prochain
  ne coche pas les lundis suivants).
- **Récompenses** : oui, XP + coins + achievements + célébration.
- **Annulation** : dé-cocher annule proprement (revert XP/coins, suppression ou
  réouverture de la quête).
- **Lien manuel** : le sélecteur « lier à une quête existante » est inclus dès
  cette version.

## Modèle de données — migration v11

```sql
CREATE TABLE evenement_completion (
  evenement_id    INTEGER NOT NULL,   -- masterId rapporté par l'occurrence
  date_occurrence TEXT NOT NULL,      -- 'YYYY-MM-DD'
  tache_id        INTEGER REFERENCES taches(id) ON DELETE SET NULL,
  auto_creee      INTEGER NOT NULL DEFAULT 0,  -- 1 = quête éclair, 0 = quête liée
  completee_le    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (evenement_id, date_occurrence)
);
```

La clé `(evenement_id, date_occurrence)` est cohérente avec la façon dont les
occurrences sont identifiées dans `listEvenements` :
- événement ponctuel → `masterId` = id de l'événement, `date_occurrence` = sa date ;
- série récurrente → `masterId` = id du maître, `date_occurrence` = date de l'occurrence ;
- occurrence déplacée (override) → `masterId` = id de l'override (estRecurrent = false).

`auto_creee` distingue, à l'annulation, la quête à **supprimer** (créée à la volée)
de la quête à **rouvrir** (liée préexistante).

## Logique de complétion

`terminerEvenement(db, masterId, dateOccurrence) → CompletionResult`

1. Garde d'idempotence : si une ligne `evenement_completion` existe déjà pour
   `(masterId, dateOccurrence)`, ne rien faire (retourner l'état courant).
2. Charger le maître (`SELECT * FROM evenement WHERE id = masterId`) pour lire
   `tache_id`, `titre`, `categorie_id`, `debut`, `fin`, `all_day`.
3. **Cas lié** : si `tache_id` non nul **et** la quête correspondante a un statut
   `active` ou `en_cours` → `tacheCible = tache_id`, `autoCreee = 0`.
4. **Cas à la volée** : sinon → créer une quête via `createTache` avec
   - `titre` = titre de l'événement ;
   - `niveauEnergie` = déduit de la durée (voir mapping) ;
   - `categorie` = nom de la catégorie agenda de l'événement (ou `null`) ;
   puis `tacheCible = nouvelleTache.id`, `autoCreee = 1`.
5. `resultat = terminerTache(db, tacheCible)` (rejoue XP + coins + achievements).
6. Insérer la ligne `evenement_completion(masterId, dateOccurrence, tacheCible, autoCreee)`.
7. Retourner `resultat` (pour déclencher la célébration côté UI).

### Mapping durée → niveau d'énergie

Reprend les seuils déjà affichés dans QuestesScreen :

| Durée de l'événement | Niveau   |
|----------------------|----------|
| < 5 min              | micro    |
| 5 – 15 min           | faible   |
| 15 – 45 min          | moyenne  |
| 45 min et +          | haute    |
| journée entière      | faible   |

Durée = `fin − debut` en minutes (les deux au format `'YYYY-MM-DD HH:MM'`).

## Annulation propre

`annulerEvenement(db, masterId, dateOccurrence) → void`

1. Lire la ligne `evenement_completion`. Absente → no-op.
2. **Revert XP/coins** via une fonction dédiée `revertCompletion(db, xp, coins)` :
   - XP absolu cumulé du profil = `cumulNiveau(niveau) + xp_courant`, où
     `cumulNiveau(L) = 100 * (L−1) * L / 2` (somme des paliers `k*100`).
   - Nouveau total absolu = `max(0, total − xpGagné)`.
   - Recalculer `niveau`, `xp`, `xp_prochain_niveau` à partir de ce total absolu.
   - `neurocoins = max(0, neurocoins − coinsGagnés)`.
   - `total_taches_terminees = max(0, total_taches_terminees − 1)`.

   On lit `xpGagné`/`coinsGagnés` directement sur la quête ciblée
   (`xp_recompense`, `coins_recompense`).
3. **Quête** : si `auto_creee = 1` → `deleteTache(tacheCible)`. Sinon →
   repasser la quête en `active` (`UPDATE taches SET statut='active', completee_le=NULL`).
4. Supprimer la ligne `evenement_completion`.

**Limite assumée (YAGNI)** : les achievements déjà débloqués ne sont pas
re-verrouillés (paliers à sens unique). La cascade parent de `terminerTache` n'est
pas annulée : acceptable car les quêtes éclair n'ont pas de parent, et lier un
événement à une sous-tâche reste un cas marginal.

## Couche API (NeuroBoostApi)

Deux nouvelles méthodes :

```ts
terminerEvenement: (masterId: number, dateOccurrence: string) => Promise<CompletionResult>
annulerEvenement:  (masterId: number, dateOccurrence: string) => Promise<void>
```

`listEvenements` enrichit chaque `OccurrenceDTO` d'un champ :

```ts
fait: boolean   // true s'il existe une ligne evenement_completion pour (masterId, dateOccurrence)
```

Implémentation : une jointure/lookup sur `evenement_completion` lors de la
construction des occurrences (`occToDTO`). Le `tacheId` déjà présent dans
`OccurrenceDTO` reste celui du maître (lien manuel).

## Interface

### Pastille d'événement (TimelineView, MoisView)

- Un rond cliquable (case à cocher) sur la pastille.
- `fait = true` → ✓ rempli, titre barré + opacité réduite.
- Clic → `onToggleFait(occurrence)` : appelle `terminerEvenement` ou
  `annulerEvenement` selon l'état courant, puis recharge.
- Le clic sur la case **ne doit pas** ouvrir le modal d'édition (stopPropagation).

### Modal d'événement (EvenementModal)

- Bouton « ✓ Marquer fait » / « ↩︎ Annuler » (selon `occurrence.fait`), visible
  uniquement en édition (pas à la création).
- Nouveau sélecteur **« Lier à une quête existante (optionnel) »** : liste les
  quêtes actives (`listTaches({ statut: 'active' })`), alimente `tacheId` de
  `EvenementInput`. C'est ce qui bascule la complétion dans le cas « lié ».
- En complétion depuis le modal, on remonte le `CompletionResult` à l'écran
  parent pour afficher la célébration.

### AgendaScreen

- Gère un état de célébration (`CompletionResult | null`) + composant `Celebration`,
  comme QuestesScreen.
- Handler `onToggleFait` partagé entre les vues et le modal.
- La barre de profil de la sidebar se rafraîchit déjà au changement d'onglet
  (App.tsx) — aucun câblage supplémentaire requis, comportement identique aux Quêtes.

## Découpage en unités

- `migrations.ts` : ajout v11 (table).
- `agenda.ts` : `terminerEvenement`, `annulerEvenement`, enrichissement `fait`
  dans `listEvenements`/`occToDTO`, helper `dureeVersEnergie`.
- `game.ts` : `revertCompletion` (revert XP/coins/niveau). Réutilise
  `createTache`, `terminerTache`, `deleteTache` existants.
- `api.ts` : exposition des deux méthodes + persistance.
- `types.ts` : `fait` sur `OccurrenceDTO`, signatures API.
- UI : `EvenementModal`, `TimelineView`, `MoisView`, `AgendaScreen`.

## Tests

- `dureeVersEnergie` : seuils (limites 5/15/45, all-day).
- `terminerEvenement` cas lié : termine la quête liée, écrit la complétion,
  `auto_creee = 0` ; idempotence si déjà fait.
- `terminerEvenement` cas à la volée : crée la quête, la termine, `auto_creee = 1`.
- `annulerEvenement` : revert XP/coins exact ; suppression quête éclair vs
  réouverture quête liée ; suppression de la ligne de complétion.
- `revertCompletion` : descente de niveau correcte (cas franchissant un palier),
  bornage à 0.
- `listEvenements` : `fait` correct par occurrence, y compris récurrence (une
  occurrence cochée n'affecte pas les autres).

## Hors périmètre

- Pas de re-verrouillage des achievements.
- Pas de synchronisation inverse Quêtes → Agenda (terminer une quête depuis
  l'écran Quêtes ne coche pas automatiquement l'événement lié).
- Pas de gestion Google Calendar (champ `source`/`google_id` déjà présents mais
  non concernés ici).
