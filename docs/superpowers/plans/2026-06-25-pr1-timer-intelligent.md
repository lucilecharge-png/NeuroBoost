# PR1 — Timer Intelligent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter 3 features de protection TDAH dans FocusScreen : Post-it de transition (habit 4), Pause Corpo (habit 7), Alerte Énergie (habit 9).

**Architecture:** Toutes les modifications sont dans `FocusScreen.tsx`. On étend l'enum `Phase` existant avec 2 nouvelles valeurs. Les 3 features réutilisent les APIs IPC existantes sans aucune migration DB.

**Tech Stack:** React + TypeScript, Electron IPC existant (`addCapture`, `listSessionsAujourdHui`), better-sqlite3

---

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/renderer/src/screens/FocusScreen.tsx` | Seul fichier modifié — 3 commits séparés |

---

## Task 1 : Post-it de transition (Habit 4)

**Comportement attendu :** Clic "✕ Abandonner" (phase `en-cours`) ou "← Retour sans compléter" (phase `fini`) → affiche une modale post-it → note sauvegardée comme Capture → retour à l'accueil.

**Files:**
- Modify: `src/renderer/src/screens/FocusScreen.tsx`

- [ ] **Step 1.1 : Étendre le type Phase et ajouter l'état post-it**

Dans `FocusScreen.tsx`, remplace la ligne :
```ts
type Phase = 'choix-duree' | 'en-cours' | 'bloque' | 'fini'
```
par :
```ts
type Phase = 'choix-duree' | 'en-cours' | 'bloque' | 'fini' | 'post-it' | 'pause-corpo'
```

Après `const [microStep]`, ajoute :
```ts
const [postItNote, setPostItNote] = useState('')
const [phaseAvantPostIt, setPhaseAvantPostIt] = useState<Phase>('en-cours')
```

- [ ] **Step 1.2 : Ajouter les fonctions de transition post-it**

Remplace la fonction `abandonner` existante par ces 3 fonctions :

```ts
function allerAuPostIt() {
  if (intervalRef.current) clearInterval(intervalRef.current)
  setPhaseAvantPostIt(phase)
  setPhase('post-it')
}

async function executerAbandon() {
  const dureeReelle = Math.round((Date.now() - debutMs) / 60000)
  if (sessionId && phaseAvantPostIt === 'en-cours') {
    await window.api.terminerSession(sessionId, false, Math.max(1, dureeReelle))
  }
  onAbandonner()
}

async function confirmerPostIt() {
  if (postItNote.trim()) {
    await window.api.addCapture(`📝 ${tache.titre} — ${postItNote.trim()}`)
  }
  await executerAbandon()
}

async function abandonner() {
  if (phase === 'en-cours' || phase === 'fini') {
    allerAuPostIt()
  } else {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (sessionId) {
      const dureeReelle = Math.round((Date.now() - debutMs) / 60000)
      await window.api.terminerSession(sessionId, false, Math.max(1, dureeReelle))
    }
    onAbandonner()
  }
}
```

- [ ] **Step 1.3 : Ajouter le rendu de la phase post-it**

Avant le bloc `if (phase === 'choix-duree')`, ajoute :

```tsx
if (phase === 'post-it') {
  return (
    <div className="focus-overlay">
      <div style={{ fontSize: 40, marginBottom: 8 }}>📝</div>
      <div className="focus-titre" style={{ maxWidth: 480 }}>Avant de partir…</div>
      <div className="text-muted" style={{ textAlign: 'center', maxWidth: 400, marginBottom: 20 }}>
        Laisse une note à ton futur toi. Où en étais-tu ? Quelle est la prochaine étape ?
      </div>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <textarea
          className="textarea"
          style={{ minHeight: 100, fontSize: 14, marginBottom: 12 }}
          placeholder={`Ex : "J'en étais à la partie intro, la prochaine étape est de rédiger la section 2"`}
          value={postItNote}
          onChange={(e) => setPostItNote(e.target.value)}
          autoFocus
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn-launch" onClick={confirmerPostIt}>
            💾 Sauvegarder et partir
          </button>
          <button className="btn-ghost" onClick={executerAbandon}>
            Passer (quitter sans noter)
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 1.4 : Vérifier manuellement**

Lance `npm run dev`. Dans l'Accueil, clique "🚀 LANCER" sur une mission, choisis 5 min, attends 5 secondes, clique "✕ Abandonner". Vérifie :
- L'overlay post-it apparaît avec la textarea
- Si tu écris une note et cliques "Sauvegarder", tu reviens à l'accueil
- La note est visible dans "💡 Cerveau rapide" préfixée par `📝 [titre tâche] —`
- "Passer" retourne à l'accueil sans créer de capture

- [ ] **Step 1.5 : Commit**

```bash
git add src/renderer/src/screens/FocusScreen.tsx
git commit -m "feat: post-it de transition sur abandon de session focus (habit 4)"
```

---

## Task 2 : Pause Corpo (Habit 7)

**Comportement attendu :** Après 25 minutes de focus continu (sessions ≥ 25 min uniquement), le timer se met en pause et un overlay plein écran propose 3 suggestions de mouvement. "C'est fait ✓" reprend le timer là où il était.

**Files:**
- Modify: `src/renderer/src/screens/FocusScreen.tsx`

- [ ] **Step 2.1 : Ajouter la constante et les refs**

Après la constante `MICRO_STEPS`, ajoute :
```ts
const CORPO_PAUSE_THRESHOLD_S = 25 * 60
```

Après `const [microStep]`, ajoute :
```ts
const [elapsedS, setElapsedS] = useState(0)
const corpoPauseTriggered = useRef(false)
```

- [ ] **Step 2.2 : Réinitialiser elapsed au démarrage**

Dans la fonction `demarrer`, ajoute ces 2 lignes après `setDebutMs(Date.now())` :
```ts
setElapsedS(0)
corpoPauseTriggered.current = false
```

- [ ] **Step 2.3 : Incrémenter elapsed dans l'intervalle**

Dans le `useEffect` du timer (celui qui crée `setInterval`), modifie le callback pour incrémenter `elapsedS`. Remplace le bloc `setInterval` existant par :

```ts
intervalRef.current = setInterval(() => {
  setElapsedS((e) => e + 1)
  setRemaining((r) => {
    if (r <= 1) {
      clearInterval(intervalRef.current!)
      setPhase('fini')
      return 0
    }
    return r - 1
  })
}, 1000)
```

- [ ] **Step 2.4 : Ajouter le useEffect de déclenchement**

Après le `useEffect` du timer existant, ajoute :

```ts
useEffect(() => {
  if (phase !== 'en-cours') return
  if (dureePrevue < 25) return
  if (elapsedS < CORPO_PAUSE_THRESHOLD_S) return
  if (corpoPauseTriggered.current) return
  corpoPauseTriggered.current = true
  if (intervalRef.current) clearInterval(intervalRef.current)
  setPhase('pause-corpo')
}, [elapsedS, phase, dureePrevue])
```

- [ ] **Step 2.5 : Ajouter la fonction de reprise**

Après la fonction `abandonner`, ajoute :

```ts
function reprendreFocus() {
  corpoPauseTriggered.current = false
  setElapsedS(0)
  setPhase('en-cours')
}
```

- [ ] **Step 2.6 : Ajouter le rendu de la phase pause-corpo**

Après le bloc `if (phase === 'post-it')`, ajoute :

```tsx
if (phase === 'pause-corpo') {
  return (
    <div className="focus-overlay">
      <div style={{ fontSize: 64, marginBottom: 8 }}>🧘</div>
      <div className="focus-titre">Pause Corpo !</div>
      <div className="text-muted" style={{ textAlign: 'center', maxWidth: 380, marginBottom: 24 }}>
        Tu focus depuis 25 min — prends 2 minutes pour toi. Le timer t'attend.
      </div>
      <div style={{ width: '100%', maxWidth: 380, marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            '🦵 Lève-toi et étire les jambes',
            '💧 Bois un verre d\'eau',
            '👀 Regarde au loin 20 secondes'
          ].map((s, i) => (
            <div
              key={i}
              style={{ padding: '14px 18px', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)', borderRadius: 'var(--radius)', fontSize: 15 }}
            >
              {s}
            </div>
          ))}
        </div>
      </div>
      <button className="btn-launch" style={{ fontSize: 17 }} onClick={reprendreFocus}>
        ✓ Pause faite, je reprends
      </button>
    </div>
  )
}
```

- [ ] **Step 2.7 : Vérifier manuellement**

Lance `npm run dev`. Sélectionne une mission, clique "🚀 LANCER", choisis **25 min**. Pour tester sans attendre 25 min, change temporairement `CORPO_PAUSE_THRESHOLD_S` à `10` (10 secondes), lance une session, attends 10 sec. Vérifie :
- L'overlay Pause Corpo apparaît avec les 3 suggestions
- Le timer est bien en pause (ne décompte plus)
- "✓ Pause faite, je reprends" reprend le timer
- Une deuxième pause déclenche à nouveau après encore 10 sec (après avoir remis `CORPO_PAUSE_THRESHOLD_S = 25 * 60`)

Remet `CORPO_PAUSE_THRESHOLD_S = 25 * 60` avant de committer.

- [ ] **Step 2.8 : Commit**

```bash
git add src/renderer/src/screens/FocusScreen.tsx
git commit -m "feat: pause corpo — overlay mouvement après 25 min de focus (habit 7)"
```

---

## Task 3 : Alerte Énergie (Habit 9)

**Comportement attendu :** Au chargement de FocusScreen, on calcule le total de minutes focus complétées aujourd'hui. Si ≥ 240 min (4h), une alerte s'affiche dans la phase `choix-duree`. L'utilisateur peut quand même continuer.

**Files:**
- Modify: `src/renderer/src/screens/FocusScreen.tsx`

- [ ] **Step 3.1 : Ajouter l'état et le chargement**

Après `const [microStep]`, ajoute :
```ts
const [totalFocusMin, setTotalFocusMin] = useState(0)
const [alerteEnergieIgnoree, setAlerteEnergieIgnoree] = useState(false)
```

Après les `useEffect` existants, ajoute :
```ts
useEffect(() => {
  window.api.listSessionsAujourdHui().then((sessions) => {
    const total = sessions
      .filter((s) => s.completee && s.dureeReelleMin !== null)
      .reduce((sum, s) => sum + (s.dureeReelleMin ?? 0), 0)
    setTotalFocusMin(total)
  })
}, [])
```

- [ ] **Step 3.2 : Calculer la condition d'alerte**

Dans la section de rendu, avant `if (phase === 'post-it')`, ajoute ce calcul :
```ts
const montrerAlerteEnergie =
  phase === 'choix-duree' &&
  !alerteEnergieIgnoree &&
  (totalFocusMin >= 240 || totalFocusMin >= 300)
```

- [ ] **Step 3.3 : Ajouter l'overlay d'alerte dans choix-duree**

Dans le rendu de `phase === 'choix-duree'`, juste après `<button className="btn-ghost" ...← Retour>`, avant le `<div style={{ textAlign: 'center' }}>` du titre, insère :

```tsx
{montrerAlerteEnergie && (
  <div style={{ width: '100%', maxWidth: 440, padding: '16px', background: 'rgba(239,68,68,.1)', border: '2px solid rgba(239,68,68,.4)', borderRadius: 'var(--radius-lg)', marginBottom: 16 }}>
    <div style={{ fontWeight: 800, fontSize: 16, color: '#ef4444', marginBottom: 8 }}>
      🔋 Alerte Énergie
    </div>
    <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>
      Tu as déjà {totalFocusMin} minutes de focus aujourd'hui. Continuer risque de vider ta batterie pour demain. Ton cerveau TDAH a besoin de récupération.
    </div>
    <div style={{ display: 'flex', gap: 10 }}>
      <button
        className="btn-ghost"
        style={{ flex: 1, fontSize: 13 }}
        onClick={() => onAbandonner()}
      >
        ← M'arrêter ici
      </button>
      <button
        className="btn-ghost"
        style={{ flex: 1, fontSize: 12, color: 'var(--text-muted)' }}
        onClick={() => setAlerteEnergieIgnoree(true)}
      >
        Je comprends, je continue
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 3.4 : Vérifier manuellement**

Pour tester sans accumuler 4h de sessions, ouvre la console de l'appli Electron (DevTools) et modifie temporairement le seuil de vérification : dans le code, change `totalFocusMin >= 240` en `totalFocusMin >= 1` (1 minute), lance une session de 2 min, termine-la, puis ré-ouvre une session. Vérifie :
- L'alerte rouge apparaît avec le nombre de minutes
- "← M'arrêter ici" retourne à l'accueil
- "Je comprends, je continue" fait disparaître l'alerte et laisse choisir la durée
- L'alerte ne ré-apparaît plus après avoir été ignorée dans la même session

Remet les seuils à `240` et `300` avant de committer.

- [ ] **Step 3.5 : Commit**

```bash
git add src/renderer/src/screens/FocusScreen.tsx
git commit -m "feat: alerte énergie après 4h de focus — protection burn-out (habit 9)"
```
