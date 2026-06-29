import type { JSX } from 'react'

/**
 * Jeu d'icônes ligne (stroke) sobres — remplace les emojis de la navigation
 * et du chrome global pour un rendu adulte et cohérent.
 *
 * Les icônes héritent de `currentColor` et d'une épaisseur de trait unique,
 * ce qui leur donne un aspect « outil » plutôt que « jouet ».
 */
export type IconName =
  | 'accueil'
  | 'quetes'
  | 'agenda'
  | 'tunnel'
  | 'captures'
  | 'coaching'
  | 'timer'
  | 'rendezvous'
  | 'rituel'
  | 'sauvegarde'
  | 'recompenses'
  | 'coins'

type Props = {
  name: IconName
  size?: number
  className?: string
}

const PATHS: Record<IconName, JSX.Element> = {
  // Accueil — maison
  accueil: <path d="M3 10.5 12 4l9 6.5M5 9.5V19a1 1 0 0 0 1 1h3v-5h6v5h3a1 1 0 0 0 1-1V9.5" />,
  // Quêtes — liste cochée
  quetes: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6l1 1 1.5-1.5M4 12l1 1 1.5-1.5M4 18l1 1 1.5-1.5" />
    </>
  ),
  // Agenda — calendrier
  agenda: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </>
  ),
  // Le Tunnel — cible / focus
  tunnel: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.2" />
    </>
  ),
  // Cerveau rapide — éclair
  captures: <path d="M13 3 5 13h5l-1 8 8-10h-5l1-8Z" />,
  // Coaching — bulle de dialogue
  coaching: <path d="M4 5.5h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9l-4 3.5V15.5H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z" />,
  // Timer — horloge
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2.5h6" />
    </>
  ),
  // Rendez-vous — épingle
  rendezvous: (
    <>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  // Rituel — lune
  rituel: <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z" />,
  // Sauvegarde — disquette
  sauvegarde: (
    <>
      <path d="M5 4h11l3 3v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" />
    </>
  ),
  // Récompenses — médaille
  recompenses: (
    <>
      <circle cx="12" cy="9" r="5" />
      <path d="M9 13.5 7.5 21l4.5-2.5L16.5 21 15 13.5" />
    </>
  ),
  // NeuroCoins — jeton
  coins: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M9.5 9.8c0-1 1.1-1.8 2.5-1.8s2.5.8 2.5 1.8-1.1 1.5-2.5 1.5-2.5.6-2.5 1.6 1.1 1.8 2.5 1.8 2.5-.8 2.5-1.8" />
    </>
  )
}

export default function Icon({ name, size = 18, className }: Props): JSX.Element {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
