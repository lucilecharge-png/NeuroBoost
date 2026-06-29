// Client Supabase partagé. Renvoie null si les variables ne sont pas définies
// (l'app reste alors 100 % locale, sans synchro).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Valeurs publiques par défaut du projet NeuroBoost. La clé `anon` est une clé
// « publishable » destinée au client : elle est de toute façon embarquée dans le
// bundle navigateur, et la sécurité repose sur les politiques RLS (chaque
// utilisateur n'accède qu'à ses données), pas sur le secret de cette clé.
// Les variables d'environnement, si définies, restent prioritaires.
const DEFAULT_URL = 'https://pidphtnyfbvunporcmrd.supabase.co'
const DEFAULT_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZHBodG55ZmJ2dW5wb3JjbXJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDYyODMsImV4cCI6MjA5ODMyMjI4M30.Sk-EpxMOkQ-J4OYLEbbOGmFrUFsrKpwHbJ6bDvRCdMM'

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_ANON

export const supabase: SupabaseClient | null =
  url && anon ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } }) : null

export function syncConfigured(): boolean {
  return supabase !== null
}
