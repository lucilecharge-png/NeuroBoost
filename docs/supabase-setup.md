# Configuration Supabase — synchronisation NeuroBoost

Cette procédure est à réaliser **une seule fois**, par toi, dans ton tableau de
bord Supabase et Google Cloud. Claude ne peut pas créer de compte ni saisir
d'identifiants à ta place.

## 1. Créer le projet
1. Crée un compte sur https://supabase.com et un nouveau projet (région proche de toi).
2. Note l'**URL du projet** et la **clé `anon` publique** (Settings → API).

## 2. Activer la connexion Google
1. Dans Google Cloud Console, crée un **identifiant OAuth 2.0** (type « Application Web »).
   - URI de redirection autorisée : `https://VOTRE-PROJET.supabase.co/auth/v1/callback`
2. Dans Supabase → Authentication → Providers → **Google** : colle le *Client ID* et le *Client secret*, active.
3. Dans Authentication → URL Configuration : ajoute l'URL de ton app (ex. `http://localhost:5173`
   en dev et l'URL Cloudflare Pages en prod) aux **Redirect URLs**.

## 3. Créer le stockage
1. Storage → New bucket → nom `db-sync` → **Privé** (décoche « Public »).

## 4. Politiques d'accès au stockage (Storage policies)
Dans Storage → Policies, sur le bucket `db-sync`, crée une politique autorisant
chaque utilisateur à gérer uniquement les fichiers sous son dossier `{user_id}/` :

```sql
create policy "db-sync owner all"
  on storage.objects for all
  using ( bucket_id = 'db-sync' and (storage.foldername(name))[1] = auth.uid()::text )
  with check ( bucket_id = 'db-sync' and (storage.foldername(name))[1] = auth.uid()::text );
```

## 5. Table de version
SQL Editor → exécute le contenu de `scripts/supabase/schema.sql`.

## 6. Brancher l'app
Copie `.env.local.example` en `.env.local` et renseigne `VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY`. Pour la prod, ajoute ces variables dans les paramètres
du projet Cloudflare Pages.
