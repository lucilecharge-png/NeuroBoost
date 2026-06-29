// Thème clair / sombre — réglage d'appareil (localStorage), comme les rituels.
// On applique le thème via l'attribut data-theme sur <html> ; tout le CSS
// repose sur des variables, donc le changement est instantané et global.

export type Theme = 'dark' | 'light'

const KEY = 'neuroboost-theme'

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function appliquerTheme(t: Theme): void {
  document.documentElement.setAttribute('data-theme', t)
}

export function setTheme(t: Theme): void {
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* mode privé : on applique quand même pour la session */
  }
  appliquerTheme(t)
}

// Appelé au démarrage, avant le rendu, pour éviter tout flash.
export function initTheme(): void {
  appliquerTheme(getTheme())
}
