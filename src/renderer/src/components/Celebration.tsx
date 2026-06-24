import { useEffect, useState } from 'react'
import type { CompletionResult } from '../../../shared/types'

const EMOJIS = ['🎉', '✨', '⭐', '🌟', '💫', '🎊', '🏆', '💜', '🦋', '🚀']

interface Piece { id: number; emoji: string; left: number; delay: number; duration: number }

interface Props {
  result: CompletionResult | null
  onClose: () => void
}

export default function Celebration({ result, onClose }: Props): JSX.Element | null {
  const [pieces, setPieces] = useState<Piece[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!result) return
    setVisible(true)
    setPieces(
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        emoji: EMOJIS[i % EMOJIS.length],
        left: 5 + Math.random() * 90,
        delay: Math.random() * 800,
        duration: 1800 + Math.random() * 1000
      }))
    )
    const t = setTimeout(() => { setVisible(false); onClose() }, 3500)
    return () => clearTimeout(t)
  }, [result])

  if (!result || !visible) return null

  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{ left: `${p.left}%`, animationDelay: `${p.delay}ms`, animationDuration: `${p.duration}ms` }}
        >
          {p.emoji}
        </span>
      ))}

      <div
        className="xp-popup"
        style={{ top: '40%', left: '50%', transform: 'translateX(-50%)' }}
      >
        +{result.xpGagne} XP &nbsp; +{result.coinsGagnes} 🪙
      </div>

      {result.levelUp && (
        <div className="levelup-banner">
          ⬆ Niveau {result.nouveauNiveau} débloqué ! Tu montes en puissance 🔥
        </div>
      )}
    </>
  )
}
