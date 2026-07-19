"use client";

import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { CHEMIN_PAR_ROLE } from "@/lib/roles";
import DemoBanner from "@/components/DemoBanner";

// Page atteinte via le lien d'invitation ou de reinitialisation envoye par
// Supabase (email). Le client Supabase detecte automatiquement le jeton
// present dans l'URL et cree une session temporaire ; cette page permet
// ensuite de choisir un mot de passe definitif (supabase.auth.updateUser).
export default function DefinirMotDePassePage() {
const [etat, setEtat] = useState(supabaseConfigured ? "verification" : "demo");
const [password, setPassword] = useState("");
const [confirmation, setConfirmation] = useState("");
const [error, setError] = useState("");
const [loading, setLoading] = useState(false);

useEffect(() => {
if (!supabaseConfigured) return;
let annule = false;
(async () => {
const { data: { session } } = await supabase.auth.getSession();
if (annule) return;
setEtat(session ? "pret" : "lien_invalide");
})();
return () => { annule = true; };
}, []);

async function handleSubmit(e) {
e.preventDefault();
setError("");
if (password.length < 8) {
setError("Le mot de passe doit contenir au moins 8 caracteres.");
return;
}
if (password !== confirmation) {
setError("Les deux mots de passe ne correspondent pas.");
return;
}
setLoading(true);
const { data, error } = await supabase.auth.updateUser({ password });
if (error) {
setLoading(false);
setError(error.message);
return;
}
const { data: compte } = await supabase
.from("comptes")
.select("role")
.eq("id", data.user.id)
.single();
setLoading(false);
window.location.href = (compte && CHEMIN_PAR_ROLE[compte.role]) || "/login";
}

if (etat === "demo") {
return (
<main className="flex-1 flex items-center justify-center px-4">
<p className="text-slate-500 text-sm text-center max-w-sm">
Le projet Supabase n'est pas encore connecte (voir README.md).
</p>
</main>
);
}

if (etat === "verification") {
return (
<main className="flex-1 flex items-center justify-center">
<p className="text-slate-500 text-sm">Verification du lien...</p>
</main>
);
}

if (etat === "lien_invalide") {
return (
<main className="flex-1 flex items-center justify-center px-4">
<p className="text-slate-500 text-sm text-center max-w-sm">
Ce lien n'est plus valide ou a deja ete utilise. Contactez l'administrateur pour recevoir une nouvelle invitation.
</p>
</main>
);
}

return (
<>
<DemoBanner />
<main className="flex-1 flex items-center justify-center px-4">
<form onSubmit={handleSubmit} className="max-w-sm w-full space-y-4 py-16">
<h1 className="text-xl font-semibold" style={{ color: "#2E75B6" }}>Choisir un mot de passe</h1>
<div>
<label className="block text-sm mb-1">Nouveau mot de passe</label>
<input
type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
/>
</div>
<div>
<label className="block text-sm mb-1">Confirmer le mot de passe</label>
<input
type="password" required minLength={8} value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
/>
</div>
{error && <p className="text-sm text-red-600">{error}</p>}
<button
type="submit" disabled={loading}
className="w-full rounded-lg py-2 font-medium"
style={{ background: "#91CAFF" }}
>
{loading ? "Enregistrement..." : "Valider"}
</button>
</form>
</main>
</>
);
}
