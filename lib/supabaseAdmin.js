import { createClient } from "@supabase/supabase-js";

// ATTENTION : ce fichier utilise la "secret key" (clé secrète) Supabase, qui
// contourne toutes les règles de sécurité (RLS). Il ne doit JAMAIS être
// importé depuis un composant client ("use client") ni depuis du code qui
// s'exécute dans le navigateur — uniquement depuis les routes API (app/api/.../route.js),
// qui s'exécutent côté serveur.
//
// La variable SUPABASE_SERVICE_ROLE_KEY (sans préfixe NEXT_PUBLIC_) n'est
// jamais envoyée au navigateur par Next.js : c'est ce qui la protège.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdminConfigured = Boolean(supabaseUrl && serviceRoleKey);

export const supabaseAdmin = supabaseAdminConfigured
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// Vérifie le jeton d'accès envoyé par le client (header Authorization: Bearer ...)
// et renvoie le compte correspondant (avec son rôle), ou null si invalide.
//
// Correction (voir Jalon "suppression de chapitres obsolètes" / diagnostic
// "Non autorisé" généralisé) : supabaseAdmin.auth.getUser(token) renvoyait
// systématiquement l'erreur "Auth session missing!" alors qu'un jeton valide
// était bien fourni — un problème connu du SDK @supabase/supabase-js avec un
// client créé via la clé de service (persistSession/autoRefreshToken à
// false) : la méthode getUser() retombe dans son chemin "session locale"
// même quand un jeton est passé explicitement. On appelle donc directement
// l'endpoint REST Auth (/auth/v1/user), ce qui a le même effet (vérifier le
// jeton et récupérer l'utilisateur) sans passer par ce chemin bogué.
export async function getCompteFromToken(request) {
  if (!supabaseAdminConfigured) return null;
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  let user = null;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: serviceRoleKey,
      },
    });
    if (res.ok) {
      user = await res.json();
    }
  } catch {
    return null;
  }
  if (!user?.id) return null;

  const { data: compte } = await supabaseAdmin
    .from("comptes")
    .select("id, role, statut, nom, email")
    .eq("id", user.id)
    .single();

  return compte || null;
}
