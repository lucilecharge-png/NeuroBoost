import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export type AuthUser = { id: string; email: string | null }

export async function getUser(): Promise<AuthUser | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const u = data.session?.user
  return u ? { id: u.id, email: u.email ?? null } : null
}

export async function signInWithGoogle(): Promise<void> {
  if (!supabase) throw new Error('Synchronisation non configurée')
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin }
  })
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

// Notifie à chaque changement de session (connexion / déconnexion / refresh).
export function onAuthChange(cb: (user: AuthUser | null) => void): () => void {
  if (!supabase) { cb(null); return () => {} }
  const { data } = supabase.auth.onAuthStateChange((_e, session: Session | null) => {
    const u = session?.user
    cb(u ? { id: u.id, email: u.email ?? null } : null)
  })
  return () => data.subscription.unsubscribe()
}
