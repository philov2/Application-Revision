import { supabase } from "@/lib/supabaseClient";

// Appelle une route API interne (app/api/...) en y joignant le jeton de la
// session en cours, pour que la route puisse vérifier qui fait la demande.
export async function authFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
  const res = await fetch(url, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Erreur (${res.status})`);
  return body;
}
