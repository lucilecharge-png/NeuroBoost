# Découper une quête en mini-tâches (depuis l'écran Quêtes)

_Design — 2026-06-26_

## Problème

Le mécanisme « quête → mini-tâches » existe déjà côté données (`decouperTache`,
`creerSousTaches`, auto-masquage/auto-complétion du parent), mais son UI n'est
accessible que depuis **Le Tunnel** (carte « Maintenant »). Depuis l'écran
**Quêtes**, on ne peut pas découper une quête.

But : pouvoir transformer une quête en mini-tâches **(1)** juste après l'avoir
créée et **(2)** à tout moment via un bouton sur sa carte.

## Approche

Extraire le panneau de découpe — aujourd'hui en dur dans `TunnelScreen`
(lignes ~131-182) — en un composant réutilisable, puis l'utiliser dans Le Tunnel
(comportement inchangé) **et** dans Quêtes.

## Composant `DecoupeQuete` (nouveau)

`src/renderer/src/components/DecoupeQuete.tsx`

- Props : `tache: TacheDTO`, `onTermine: () => void`, `onAnnuler: () => void`
- État interne : `nombre` (2-6, défaut 3), `phase` (`idle | chargement | edition`),
  `propositions: string[]`
- `proposer()` → `window.api.decouperTache(...)`, repli gracieux (champs vides)
  si l'IA échoue
- `creerLesSousTaches()` → `window.api.creerSousTaches(tache.id, titres)` puis
  `onTermine()`

## QuestesScreen

- Carte de quête : bouton **« ✂️ Découper »** ; ouvre `<DecoupeQuete>` sous la
  carte. Un seul ouvert à la fois (`decoupeId: number | null`).
- Après `creer()` : on mémorise la quête créée et on affiche un encart
  **« 🔭 Découper en mini-tâches ? »** (sous-texte « Une grosse quête se fait
  mieux en petits morceaux ») → « Oui, découper » ouvre `DecoupeQuete`,
  « Non, c'est bon » ferme l'encart.

## TunnelScreen

Remplace le bloc inline par `<DecoupeQuete tache={maintenant} … />`. Comportement
identique (choix du nombre → proposition IA → édition → création → rechargement).

## Vocabulaire

« Le Tunnel » désigne déjà l'écran minimaliste. Pour éviter la confusion :
- bouton carte = « ✂️ Découper »
- encart post-création = « 🔭 Découper en mini-tâches ? »

## Hors périmètre (déjà en place)

- Masquage du parent tant qu'il a des enfants actifs (`listTaches`)
- Auto-complétion du parent quand la dernière mini-tâche est faite (`terminerTache`)
- Endpoint IA de proposition (`decouperTache`)
