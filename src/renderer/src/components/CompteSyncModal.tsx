import { useEffect, useState } from 'react'
import { syncConfigured } from '../data/supabase'
import { getUser, signInWithGoogle, signOut, type AuthUser } from '../data/sync/auth'
import { getStatus, onStatus, syncNow, listArchives, restoreArchive } from '../data/sync/controller'
import type { SnapshotInfo, SyncStatus } from '../data/sync/types'

const STATUT_LABEL: Record<SyncStatus, string> = {
  idle: 'Inactif', syncing: 'Synchronisation…', synced: 'Synchronisé',
  offline: 'Hors ligne', error: 'Erreur', 'signed-out': 'Non connecté'
}

export default function CompteSyncModal({ onFermer }: { onFermer: () => void }): JSX.Element {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [statut, setStatut] = useState<SyncStatus>(getStatus())
  const [archives, setArchives] = useState<SnapshotInfo[]>([])
  const configured = syncConfigured()

  useEffect(() => {
    getUser().then(setUser)
    return onStatus(setStatut)
  }, [])

  useEffect(() => {
    if (user) listArchives().then(setArchives).catch(console.error)
  }, [user, statut])

  return (
    <div className="modal-overlay" onClick={onFermer}>
      <div className="card modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Compte & Synchro</div>
          <button className="btn-icon" onClick={onFermer}>✕</button>
        </div>

        {!configured ? (
          <div className="text-muted">
            La synchronisation n'est pas configurée. Voir <code>docs/supabase-setup.md</code>.
          </div>
        ) : !user ? (
          <>
            <div className="text-muted" style={{ marginBottom: 14 }}>
              Connecte-toi pour retrouver tes données sur tous tes appareils.
            </div>
            <button className="btn-launch" onClick={() => void signInWithGoogle()}>
              Se connecter avec Google
            </button>
          </>
        ) : (
          <>
            <div className="row-between" style={{ marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{user.email}</div>
                <div className="text-muted">État : {STATUT_LABEL[statut]}</div>
              </div>
              <button className="btn-ghost" onClick={() => void signOut()}>Se déconnecter</button>
            </div>
            <button className="btn-primary" style={{ marginBottom: 16 }} onClick={() => void syncNow()}>
              Synchroniser maintenant
            </button>

            <div className="section-header">Archives</div>
            {archives.length === 0 ? (
              <div className="text-muted">Aucune archive.</div>
            ) : (
              <div className="col" style={{ gap: 6 }}>
                {archives.map((a) => (
                  <div key={a.name} className="row-between">
                    <span className="text-muted">{a.createdAt}</span>
                    <button
                      className="btn-ghost"
                      onClick={() => { if (confirm('Restaurer cette archive ? La base actuelle sera remplacée (et sauvegardée).')) void restoreArchive(a.name) }}
                    >
                      Restaurer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
