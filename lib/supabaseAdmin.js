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
// Journalisation ajoutée (voir Jalon "suppression de chapitres obsolètes") :
// toutes les routes utilisant cette fonction renvoyaient "Non autorisé" de
// façon systématique, y compris pour un compte admin valide. Ces logs
// (visibles dans Vercel > Deployments > Logs) permettent de distinguer un
// jeton invalide/expiré (échec de supabaseAdmin.auth.getUser) d'une clé de
// service invalide (même symptôme côté client) ou d'une ligne "comptes"
// introuvable.
export async function getCompteFromToken(request) {
  if (!supabaseAdminConfigured) {
    console.error("getCompteFromToken: supabaseAdmin non configuré (NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante).");
    return null;
  }
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    console.error("getCompteFromToken: aucun jeton fourni (en-tête Authorization absent).");
    return null;
  }

  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userData?.user) {
    console.error("getCompteFromToken: échec de la vérification du jeton :", error?.message || "utilisateur introuvable");
    return null;
  }

  const { data: compte, error: compteError } = await supabaseAdmin
    .from("comptes")
    .select("id, role, statut, nom, email")
    .eq("id", userData.user.id)
    .single();

  if (compteError) {
    console.error("getCompteFromToken: échec de la lecture du compte :", compteError.message);
  }

  return compte || null;
}
