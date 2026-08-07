import { supabase } from "@/lib/supabaseClient";

// Charge tous les messages du fil de discussion de la famille de cet enfant,
// dans l'ordre chronologique, avec le nom/role de l'auteur et, si precise,
// du destinataire.
export async function chargerMessages(enfantId) {
if (!enfantId) return [];
const { data, error } = await supabase
.from("messages")
.select("id, contenu, created_at, auteur_id, destinataire_id, auteur:comptes!auteur_id (nom, role), destinataire:comptes!destinataire_id (nom, role)")
.eq("enfant_id", enfantId)
.order("created_at", { ascending: true });
if (error) throw error;
return data || [];
}

// Envoie un nouveau message dans le fil de discussion de la famille de cet
// enfant. destinataireId est optionnel : null/absent = message pour tout le
// monde (comportement par defaut, comme avant).
export async function envoyerMessage(enfantId, auteurId, contenu, destinataireId) {
const texte = (contenu || "").trim();
if (!texte || !enfantId || !auteurId) return;
const { error } = await supabase.from("messages").insert({
enfant_id: enfantId,
auteur_id: auteurId,
contenu: texte,
destinataire_id: destinataireId || null,
});
if (error) throw error;
}

// Supprime un message. La policy RLS restreint cette action a l'auteur du
// message (auteur_id = auth.uid()) : chacun ne peut effacer que ses propres
// messages.
export async function supprimerMessage(messageId) {
if (!messageId) return;
const { error } = await supabase.from("messages").delete().eq("id", messageId);
if (error) throw error;
}

// Marque le fil comme lu a l'instant present, pour ce compte.
export async function marquerCommeLu(enfantId, compteId) {
if (!enfantId || !compteId) return;
const { error } = await supabase
.from("messages_lectures")
.upsert({ compte_id: compteId, enfant_id: enfantId, derniere_lecture: new Date().toISOString() });
if (error) throw error;
}

// Compte les messages recus (pas envoyes par soi-meme) depuis la derniere
// lecture enregistree pour ce compte, pour afficher un badge de non-lus.
export async function compterNonLus(enfantId, compteId) {
if (!enfantId || !compteId) return 0;
const { data: lecture } = await supabase
.from("messages_lectures")
.select("derniere_lecture")
.eq("compte_id", compteId)
.eq("enfant_id", enfantId)
.maybeSingle();
const depuis = lecture?.derniere_lecture || "1970-01-01T00:00:00Z";
const { count, error } = await supabase
.from("messages")
.select("id", { count: "exact", head: true })
.eq("enfant_id", enfantId)
.neq("auteur_id", compteId)
.gt("created_at", depuis);
if (error) return 0;
return count || 0;
}

// Liste les membres de la famille d'un enfant (l'enfant lui-meme, son ou ses
// parents, son ou ses soutiens), pour construire la liste des destinataires
// possibles d'un message. Passe par la fonction "membres_famille" (RPC),
// qui verifie elle-meme cote base que l'appelant fait bien partie de cette
// famille avant de repondre. compteIdAExclure permet d'exclure l'auteur
// (on ne s'envoie pas un message a soi-meme).
export async function chargerMembresFamille(enfantId, compteIdAExclure) {
if (!enfantId) return [];
const { data, error } = await supabase.rpc("membres_famille", { cible_enfant_id: enfantId });
if (error) {
return [];
}
return (data || []).filter((m) => m.id !== compteIdAExclure);
}
