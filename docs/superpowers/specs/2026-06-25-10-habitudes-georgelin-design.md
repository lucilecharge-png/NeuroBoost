# Design : Intégration des 10 habitudes Georgelin dans NeuroBoost

**Date :** 2026-06-25  
**Branche :** feat/quetes-notion-seed  
**Source :** Vidéo Haude Georgelin — 10 habitudes pour reprendre le contrôle

---

## Contexte

4 des 10 habitudes sont déjà couvertes dans NeuroBoost :
- ✅ Habitude 1 (Vide-tête) → CapturesScreen + capture rapide Accueil
- ✅ Habitude 2 (3 tâches max) → "3 missions du jour"
- ⚠️ Habitude 6 (Bilan) → BilanPanel existe mais couvre les questions profondes, pas le suivi hebdo
- ⚠️ Habitude 10 (Parking à idées) → Sandbox des Rêves, sans dimension trimestrielle

Les 6 habitudes à implémenter sont regroupées en **2 PRs** par zone de code.

---

## PR1 — Timer intelligent

**Fichiers touchés :** `FocusScreen.tsx`, `ipc.ts`, `db/index.ts` (lecture sessions), `shared/types.ts`

### Habit 4 — Post-it de transition

**Problème TDAH ciblé :** context-switching coûteux — reprendre une tâche abandonnée prend 1h sans note.

**Comportement :**
- Clic "Abandonner" en phase `en-cours` ou `fini` → nouvelle `Phase = 'post-it'`
- Overlay : textarea "Où en étais-tu ? Quelle est la prochaine étape ?"
- Bouton "Sauvegarder et partir" → `addCapture("📝 [titre] — [note]")` puis `abandonner()`
- Bouton "Passer" → `abandonner()` directement
- **Exception :** clic "Abandonner" en phase `choix-duree` → pas de post-it (pas de session démarrée)
- Note vide + "Sauvegarder" → traitement identique à "Passer"

**Données :** réutilise `CaptureDTO` existant, aucune migration DB.

---

### Habit 7 — Pause Corpo

**Problème TDAH ciblé :** hyperfocalisation — oubli des besoins corporels sur sessions longues.

**Comportement :**
- S'active uniquement en phase `en-cours`, jamais en `bloque`
- Ne se déclenche pas sur les sessions ≤ 25 min (2 min, 5 min, 15 min)
- Après 25 min de focus continu (`elapsed = dureePrevue*60 - remaining ≥ 1500`), transition vers `Phase = 'pause-corpo'`
- `remaining` est sauvegardé dans un `pausedRemaining` ref avant la transition
- Overlay plein écran avec 3 suggestions de mouvement :
  - 🦵 Lève-toi et étire les jambes
  - 💧 Bois un verre d'eau
  - 👀 Regarde au loin 20 secondes
- Bouton "✓ Pause faite, je reprends" → reprend le timer à `pausedRemaining`
- **Données :** purement client-side, aucune DB.

---

### Habit 9 — Alerte Énergie

**Problème TDAH ciblé :** burn-out post-hyperfocus — incapacité à fonctionner le lendemain.

**Comportement :**
- Au démarrage de chaque session (phase `choix-duree` → `en-cours`), appelle `listSessionsAujourdHui()`
- Calcule le total de minutes focus *complétées* du jour (`completee === true`)
- Seuil 1 : ≥ 240 min (4h) → alerte s'affiche avant de démarrer
- Seuil 2 : ≥ 300 min (5h) → alerte ré-apparaît même si déjà ignorée
- L'alerte ne bloque pas : bouton "Je comprends, je continue quand même" toujours disponible
- **Données :** utilise `listSessionsAujourdHui()` existant, aucune migration.

---

## PR2 — UX + Coaching

**Fichiers touchés :** `AccueilScreen.tsx`, `QuestesScreen.tsx`, `shared/types.ts`, `ipc.ts`, `db/migrations.ts`, `db/index.ts`, `db/game.ts`  
**Nouveaux fichiers :** `components/TacheTitreInput.tsx`, `components/RevueHebdoModal.tsx`, `components/TemplatesModal.tsx`

---

### Habit 8 — Reformulateur de verbe d'action

**Problème TDAH ciblé :** dysfonction exécutive — une tâche sans verbe ne déclenche pas l'action.

**Nouveau composant :** `TacheTitreInput.tsx`

```tsx
interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}
```

**Détection :**
- Liste de ~25 verbes (Rédiger, Envoyer, Appeler, Créer, Lire, Écrire, Préparer, Organiser, Planifier, Finir, Relire, Contacter, Vérifier, Chercher, Faire, Appeler, Classer, Acheter, Réserver, Nettoyer, Trier, Installer, Configurer, Démarrer, Publier)
- Si premier mot (lowercase, sans espaces) absent de la liste → affiche 3 reformulations sous le champ
- Reformulations générées par matching mots-clés (ex: "email" → "Répondre aux emails", "Envoyer l'email à…", "Trier les emails")
- Fallback si aucun match : "Faire [titre]", "Terminer [titre]", "Commencer [titre]"
- Clic sur une suggestion → remplace la valeur du champ
- Lien "Ignorer" disponible

**Scope :** création uniquement (pas l'édition). Remplace le `<input>` dans `QuestesScreen` uniquement. **Exclut** la capture rapide de `AccueilScreen` — c'est un vide-tête par conception, le reformulateur y créerait de la friction contre-productive.

---

### Habit 3 — Templates de routine

**Problème TDAH ciblé :** paralysie décisionnelle — éliminer le choix des tâches répétitives.

**Intégration :** bouton `🎲 Choisis pour moi` dans `AccueilScreen`, à côté de "↻ Changer".

**Nouveau composant :** `TemplatesModal.tsx` — modale avec 4 templates :

| Template | Tâches incluses |
|----------|----------------|
| ☀️ Matin | Écrire 3 intentions du jour · Préparer ma liste de priorités · Lire 10 minutes |
| 🌙 Soir | Ranger mon espace de travail · Écrire ma victoire du jour · Préparer mes affaires pour demain |
| 💼 Travail | Répondre aux emails urgents · Vérifier mon agenda · Avancer sur ma tâche principale |
| 🏠 Maison | Faire une tâche ménagère · Acheter ce qui manque · Préparer les repas de demain |

**Comportement :**
- Sélection d'un template → `createTache()` pour chaque tâche du template → `regenererMissions()`
- `regenererMissions()` existant gère déjà le quota de 3 missions
- Templates constants hardcodés (pas d'édition utilisateur dans ce scope)

**Données :** aucune DB, constantes dans le renderer.

---

### Habit 6+ — Revue Hebdo gamifiée

**Problème TDAH ciblé :** time blindness — les semaines passent sans mesure des progrès.

**Nouvelle table DB :**
```sql
CREATE TABLE IF NOT EXISTS revue_hebdo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semaine TEXT UNIQUE NOT NULL,         -- "2026-W26" (ISO week)
  reponses TEXT NOT NULL DEFAULT '[]',  -- JSON: RevueReponse[]
  xp_attribue INTEGER NOT NULL DEFAULT 0,
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Nouveaux types :**
```ts
export interface RevueHebdoDTO {
  id: number
  semaine: string
  reponses: RevueReponse[]
  xpAttribue: number
  creeLe: string
}
export interface RevueReponse { questionId: number; reponse: string }
```

**Nouveaux IPC :**
```ts
getRevueHebdo: (semaine: string) => Promise<RevueHebdoDTO | null>
saveRevueHebdo: (semaine: string, reponses: RevueReponse[]) => Promise<{ revue: RevueHebdoDTO; xpGagne: number }>
```

**Nouveau composant :** `RevueHebdoModal.tsx`

5 questions guidées :
1. Combien de tâches tu as terminées cette semaine ? *(pré-rempli via `getStats().tachesTotalSemaine`)*
2. Quelle est ta plus grande victoire de la semaine ?
3. Qu'est-ce qui t'a le plus freiné ?
4. Quelle habitude tu veux renforcer la semaine prochaine ?
5. Note ton énergie globale (1-5 ⚡) *(sélecteur emoji comme `energieJour`)*

Sur complétion : `saveRevueHebdo()` → +100 XP → `Celebration` existant avec confettis.

**Bouton flottant dans `AccueilScreen` :**
- Affiché en bas à droite, toujours visible
- État "À faire" : `📅 Revue de la semaine` (bouton violet)
- État "Faite" : `✅ Revue faite` (badge vert, ouvre en lecture seule)
- Semaine courante calculée via helper `getISOWeek(new Date())`

---

## Séquence d'implémentation recommandée

**PR1 (Timer) :**
1. Ajouter `Phase = 'pause-corpo' | 'post-it'` dans `FocusScreen`
2. Implémenter `useEffect` pause corpo (elapsed ≥ 25 min)
3. Intercepter `abandonner()` → phase post-it
4. Implémenter alerte énergie (lecture `listSessionsAujourdHui`)

**PR2 (UX + Coaching) :**
1. Migration v5 (`revue_hebdo`)
2. IPC `getRevueHebdo` / `saveRevueHebdo`
3. Composant `TacheTitreInput` + intégration dans les deux écrans
4. Composant `TemplatesModal` + bouton dans `AccueilScreen`
5. Composant `RevueHebdoModal` + bouton flottant dans `AccueilScreen`
