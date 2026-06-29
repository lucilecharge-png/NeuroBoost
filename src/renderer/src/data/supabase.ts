// Client Supabase partagé. Renvoie null si les variables ne sont pas définies
// (l'app reste alors 100 % locale, sans synchro).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } }) : null

export function syncConfigured(): boolean {
  return supabase !== null
}
