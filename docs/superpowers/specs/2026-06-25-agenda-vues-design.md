# Agenda multi-vues + base pour Google Calendar — Design

**Date :** 2026-06-25
**Statut :** validé en brainstorming, prêt pour plan d'implémentation

## Contexte & objectif

NeuroBoost migre d'Electron vers une PWA déployable sur Cloudflare Pages. La
couche données est désormais 100 % navigateur :

- `src/renderer/src/data/db.ts` — SQLite via **sql.js** (WASM), persisté dans
  IndexedDB (localforage). L'adaptateur `Db` imite l'API better-sqlite3
  (`prepare().get/all/run`, `exec`, `transaction`).
- `src/renderer/src/data/game.ts` — logique métier.
- `src/renderer/src/data/migrations.ts` — migrations versionnées via
  `PRAGMA user_version`.
- `src/renderer/src/data/api.ts` — implémente `NeuroBoostApi`, pose `window.api`,
  persiste (différé/coalescé) après chaque appel.

On ajoute un **agenda multi-vues**. La connexion Google Calendar viendra dans
une **phase ultérieure** (après stabilisation de l'archi Cloudflare) ; ce design
prépare le terrain mais ne la code pas.

### Décisions de cadrage (issues du brainstorming)

- **Cible de conception** : future version Cloudflare (web). Tout reste portable
  vers un D1/SQLite serveur car on ne dépend que de l'interface `Db`.
- **Séquence** : système de vues d'abord ; Google Calendar ensuite.
- **Données affichées** : nouveau type **`Événement`** (début/fin, catégorie,
  couleur), distinct des Rendez-vous Fantômes et des Tâches/Quêtes.
- **Interaction** : niveau maximal — création/édition par clic **+
  glisser-déposer** (déplacer/redimensionner).
- **Catégories** : jeu prédéfini **+** catégories personnalisées.
- **Récurrence** : incluse dès le premier jet, avec les **3 modes d'édition**.
- **Rappels/notifications** : inclus dès le premier jet.

## Les 3 moteurs d'affichage

Les 10 vues demandées (jour, 3 jours, semaine, mois, trimestre, semestre,
9 mois, année) se ramènent à **3 moteurs paramétrés** consommant tous la même
liste d'occurrences aplaties :

1. **Timeline** (`nbJours` = 1 / 3 / 7) → Jour · 3 jours · Semaine. Colonnes =
   jours, lignes = heures, ligne « journée entière » en tête, trait « maintenant ».
2. **Grille de mois** → Mois. Grille semaines × 7, pastilles colorées par jour,
   « +N » en cas de débordement.
3. **Multi-mois** (`nbMois` = 3 / 6 / 9 / 12) → Trimestre · Semestre · 9 mois ·
   Année. Grille de mini-mois ; « par trimestre / semestre » = bandeaux de
   regroupement (T1/T2… ou S1/S2). Clic sur un jour → modal de **création**
   (date pré-remplie) ; **double-clic** (ou loupe au survol) → zoom vers le
   moteur Jour à cette date.

## Architecture / fichiers

| Fichier | Rôle |
|---|---|
| `data/migrations.ts` | +1 migration : tables `categorie`, `evenement`, `evenement_exception` + seed des 4 catégories système |
| `data/agenda.ts` *(nouveau)* | Logique agenda isolée de `game.ts` : CRUD événements/catégories, **expansion des récurrences**, rappels |
| `shared/types.ts` | Nouveaux DTO + signatures `NeuroBoostApi` |
| `data/api.ts` | Branche les nouvelles méthodes ; planifie les rappels (réutilise le mécanisme `setTimeout` + `Notification` des rendez-vous) |
| `screens/AgendaScreen.tsx` *(nouveau)* | Conteneur : barre de navigation + sélecteur de vue + moteur actif |
| `components/agenda/TimelineView.tsx` | Moteur 1 |
| `components/agenda/MoisView.tsx` | Moteur 2 |
| `components/agenda/MultiMoisView.tsx` | Moteur 3 |
| `components/agenda/EvenementModal.tsx` | Création/édition (commun) |
| `components/agenda/CategoriePicker.tsx` | Sélection/création de catégories |
| `App.tsx` | Nouvel onglet sidebar 📅 Agenda |

**Principe d'isolation** : `agenda.ts` ne touche que l'interface `Db` (portable
D1) ; chaque moteur est un composant autonome et testable ; on garde `game.ts`
inchangé (déjà volumineux).

## Modèle de données (migration unique)

### `categorie`
```
id INTEGER PRIMARY KEY
nom TEXT NOT NULL
couleur TEXT NOT NULL            -- hex, ex '#7c3aed'
emoji TEXT
est_systeme INTEGER NOT NULL DEFAULT 0   -- 1 = seed non supprimable
```
Seed : 🟣 Perso `#7c3aed`, 🔵 Travail `#3b82f6`, 🟢 Santé `#10b981`,
🟡 Admin `#f59e0b`. L'utilisateur crée/supprime uniquement ses propres
catégories (`est_systeme = 0`).

### `evenement` (le « maître »)
```
id INTEGER PRIMARY KEY
titre TEXT NOT NULL
debut TEXT NOT NULL              -- 'YYYY-MM-DD HH:MM' heure locale
fin   TEXT NOT NULL
all_day INTEGER NOT NULL DEFAULT 0
categorie_id INTEGER NULL REFERENCES categorie(id) ON DELETE SET NULL
description TEXT NULL
tache_id INTEGER NULL REFERENCES tache(id) ON DELETE SET NULL
recurrence TEXT NULL             -- RRULE iCal, ex 'FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20260901'
rappel_min INTEGER NULL          -- minutes avant le début ; NULL = pas de rappel
source TEXT NOT NULL DEFAULT 'local'   -- dormant : 'local' | 'google'
google_id TEXT NULL              -- dormant : id Google pour dédup future
cree_le TEXT NOT NULL
```

### `evenement_exception` (gère « cette occurrence »)
```
evenement_id INTEGER NOT NULL REFERENCES evenement(id) ON DELETE CASCADE
date_occurrence TEXT NOT NULL    -- date de l'occurrence concernée
type TEXT NOT NULL               -- 'supprimee' | 'deplacee'
override_id INTEGER NULL REFERENCES evenement(id) ON DELETE CASCADE  -- si déplacée/modifiée
```

**Choix clé** : les occurrences concrètes ne sont **jamais** stockées. Le maître
porte la `recurrence` (RRULE) ; les occurrences sont **calculées à la volée**
pour la plage affichée. Stocker la RRULE au format RFC 5545 = format exact de
Google Calendar → mapping direct lors de la synchro future. `source`/`google_id`
sont des colonnes dormantes pour éviter une migration douloureuse plus tard.

## Récurrence

**Supportée à la création/édition :**
- Aucune · Quotidien · Hebdo (choix des jours `BYDAY`) · Mensuel (même
  quantième) · Annuel.
- Intervalle « tous les N » (`INTERVAL`) + fin par **date** (`UNTIL`) ou
  **nombre d'occurrences** (`COUNT`).

**3 modes d'édition/suppression d'un événement récurrent :**
1. **Cette occurrence** — ajoute une ligne `evenement_exception`
   (`supprimee` pour une suppression ; `deplacee` + `override_id` pointant vers
   un événement détaché pour une modif/déplacement).
2. **Cette occurrence et les suivantes** — scission : on pose
   `UNTIL = veille de D` sur le maître original et on crée un **nouveau maître**
   démarrant à D avec les champs/règle modifiés ; les exceptions ≥ D migrent
   vers le nouveau maître, celles < D restent.
3. **Toute la série** — modifie/supprime le maître (et ses exceptions).

**Expansion** : `listEvenements(db, debut, fin)` lit les maîtres dont la plage
croise `[debut, fin]`, déroule chaque RRULE dans la fenêtre, retire les
exceptions `supprimee`, applique les overrides `deplacee`, et renvoie des
`OccurrenceDTO` (événement aplati + `dateOccurrence` + `masterId`). Les 3 moteurs
ne consomment que cette liste.

**Anti-double-comptage** : un override `deplacee` est lui-même une ligne
`evenement` (sans `recurrence`) référencée par `evenement_exception.override_id`.
Pour qu'il ne soit pas listé *deux fois* (une fois comme occurrence déplacée du
maître, une fois comme événement autonome), le scan des « maîtres » **exclut**
toute ligne `evenement` dont l'`id` figure dans
`evenement_exception.override_id`.

## Interactions

**Timeline** : clic créneau vide → modal pré-remplie (heure cliquée) ; drag =
déplacer (vertical = heure, horizontal = jour) ; resize par le bord bas = durée.
**Grille de mois** : clic jour → modal (journée) ; clic pastille → édition ;
drag pastille entre jours = changer la date (heure conservée).
**Multi-mois** : clic jour → modal de création (date pré-remplie) ;
double-clic (ou loupe au survol) → zoom vers le moteur Jour.

Drag/édition sur une occurrence récurrente → on demande le mode d'application
(occurrence / suivantes / série) avant d'appliquer.

**`EvenementModal`** : titre · début/fin (ou toggle journée entière) ·
`CategoriePicker` (système + perso + « ＋ créer ») · description · lien quête
optionnel · bloc récurrence (fréq/intervalle/jours/fin) · rappel. En édition
d'un récurrent : sélecteur du mode d'application.

## Rappels / notifications (premier jet)

- `rappel_min` sur l'événement ; presets UI : « 5 min », « 10 min », « 30 min »,
  « 1 h », « la veille » **+ horaire personnalisé** (champ libre en minutes — la
  modal le convertit en `rappel_min`). `NULL` = pas de rappel.
- `agenda.ts` expose `listProchainsRappels(db, horizonJours)` → occurrences à
  venir avec rappel, déjà aplaties.
- `api.ts` les planifie via le **même** `setTimeout` + `Notification` navigateur
  que les Rendez-vous Fantômes ; replanification glissante au démarrage
  (horizon ~14 jours pour rester léger).
- Notif : titre `⏰ {titre}`, corps = heure de début.

## Lien quête (léger)

`tache_id` optionnel. Dans la modal, sélecteur « relier à une quête ». Sur un
événement lié, bouton **« Terminer la quête »** → appelle `api.terminerTache`
existant (XP/coins via le flux déjà en place). **Aucune nouvelle logique de
gamification.**

## DTO & API (esquisse)

```ts
interface CategorieDTO { id: number; nom: string; couleur: string; emoji: string | null; estSysteme: boolean }

interface RecurrenceRule {
  freq: 'quotidien' | 'hebdo' | 'mensuel' | 'annuel'
  intervalle: number
  jours?: ('LU'|'MA'|'ME'|'JE'|'VE'|'SA'|'DI')[]   // hebdo
  fin?: { type: 'date'; date: string } | { type: 'count'; count: number }
}

interface EvenementInput {
  titre: string; debut: string; fin: string; allDay?: boolean
  categorieId?: number | null; description?: string | null
  tacheId?: number | null; recurrence?: RecurrenceRule | null; rappelMin?: number | null
}

interface OccurrenceDTO {
  masterId: number; dateOccurrence: string
  titre: string; debut: string; fin: string; allDay: boolean
  categorie: CategorieDTO | null; description: string | null
  tacheId: number | null; estRecurrent: boolean; rappelMin: number | null
}

type ModeRecurrence = 'occurrence' | 'suivantes' | 'serie'

// Ajouts à NeuroBoostApi
listEvenements(debut: string, fin: string): Promise<OccurrenceDTO[]>
createEvenement(input: EvenementInput): Promise<EvenementDTO>
updateEvenement(masterId: number, dateOccurrence: string, mode: ModeRecurrence, input: Partial<EvenementInput>): Promise<void>
deleteEvenement(masterId: number, dateOccurrence: string, mode: ModeRecurrence): Promise<void>
listCategories(): Promise<CategorieDTO[]>
createCategorie(nom: string, couleur: string, emoji: string | null): Promise<CategorieDTO>
deleteCategorie(id: number): Promise<void>
```
La conversion `RecurrenceRule ⇄ RRULE` vit dans `agenda.ts`.

## Tests

- **`agenda.ts` (cœur risqué)** : tests unitaires sur DB sql.js en mémoire —
  CRUD ; conversion `RecurrenceRule ⇄ RRULE` ; expansion (hebdo multi-jours,
  intervalle, `COUNT` vs `UNTIL`, bornes de plage) ; exceptions
  (`supprimee` / `deplacee`) ; scission « occurrence et suivantes » ;
  `listProchainsRappels`.
- **Composants de vue** : vérifs de rendu légères (placement des occurrences sur
  la grille horaire ; débordement « +N » en grille de mois).

## Hors périmètre (phases ultérieures)

- Connexion / synchro Google Calendar (OAuth, mapping RRULE↔Google, dédup via
  `google_id`, gestion des conflits).
- Fuseaux horaires multiples (on reste en heure locale comme les rendez-vous).
- Pièces jointes, invités, visioconférence.
```
