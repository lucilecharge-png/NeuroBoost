import { useRef, useState } from 'react'
import { exportDb, importDb } from '../data/db'

interface Props {
  onFermer: () => void
}

export default function BackupModal({ onFermer }: Props): JSX.Element {
  const fileRef = useRef<HTMLInputElement>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  function exporter(): void {
    try {
      const octets = exportDb()
      const blob = new Blob([Uint8Array.from(octets)], { type: 'application/x-sqlite3' })
      const url = URL.createObjectURL(blob)
      const date = new Date().toISOString().slice(0, 10) // AAAA-MM-JJ
      const a = document.createElement('a')
      a.href = url
      a.download = `neuroboost-sauvegarde-${date}.sqlite`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErreur('Export impossible : ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function fichierChoisi(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier plus tard
    if (!file) return
    const ok = window.confirm(
      'Importer cette sauvegarde remplacera TOUTES tes données actuelles. Continuer ?'
    )
    if (!ok) return
    setEnCours(true)
    setErreur(null)
    try {
      const buf = await file.arrayBuffer()
      await importDb(new Uint8Array(buf))
      window.location.reload() // tous les écrans repartent sur les nouvelles données
    } catch (err) {
      setErreur(
        "Fichier invalide ou illisible. Tes données actuelles n'ont pas été modifiées."
      )
      setEnCours(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onFermer}
    >
      <div
        style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '28px 24px', width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>💾 Sauvegarde des données</div>
          <button className="btn-ghost" style={{ fontSize: 20, padding: '2px 8px' }} onClick={onFermer}>✕</button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0, marginBottom: 20 }}>
          Tes données vivent dans ce navigateur. Exporte-les régulièrement dans un
          fichier pour ne rien perdre, et réimporte-le sur un autre appareil ou
          après un nettoyage du navigateur.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn-primary" style={{ padding: '12px 16px' }} disabled={enCours} onClick={exporter}>
            ⬇️ Exporter mes données
          </button>
          <button className="btn-ghost" style={{ padding: '12px 16px' }} disabled={enCours} onClick={() => fileRef.current?.click()}>
            ⬆️ Importer une sauvegarde
          </button>
          <input ref={fileRef} type="file" accept=".sqlite" style={{ display: 'none' }} onChange={fichierChoisi} />
        </div>

        {erreur && (
          <div style={{ marginTop: 16, color: 'var(--danger, #e5484d)', fontSize: 13 }}>{erreur}</div>
        )}
      </div>
    </div>
  )
}
