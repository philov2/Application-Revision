import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

// Gestion d'un compte existant par l'administrateur.
// PATCH : modifie le nom, le rôle et/ou le téléphone d'un compte.
// DELETE : supprime définitivement le compte (Supabase Auth + ligne "comptes",
// cette dernière étant supprimée en cascade via la référence à auth.users).
export async function PATCH(request, { params }) {
if (!supabaseAdminConfigured) {
return NextResponse.json({ error: "Supabase n'est pas encore configuré côté serveur (SUPABASE_SERVICE_ROLE_KEY manquante)." }, { status: 500 });
}

const compte = await getCompteFromToken(request);
if (!compte || compte.role !== "admin") {
return NextResponse.json({ error: "Réservé à l'administrateur." }, { status: 403 });
}

const { id } = await params;
const body = await request.json().catch(() => ({}));
const { nom, role, telephone } = body;

const misesAJour = {};
if (typeof nom === "string" && nom.trim()) misesAJour.nom = nom.trim();
if (typeof role === "string" && ["admin", "parent", "enfant", "soutien"].includes(role)) misesAJour.role = role;
if (typeof telephone === "string") misesAJour.telephone = telephone.trim() || null;

if (Object.keys(misesAJour).length === 0) {
return NextResponse.json({ error: "Aucune modification valide fournie." }, { status: 400 });
}

const { data: compteModifie, error: updateError } = await supabaseAdmin
.from("comptes")
.update(misesAJour)
.eq("id", id)
.select()
.single();

if (updateError) {
return NextResponse.json({ error: `Échec de la modification : ${updateError.message}` }, { status: 500 });
}

return NextResponse.json({ success: true, compte: compteModifie });
}

export async function DELETE(request, { params }) {
if (!supabaseAdminConfigured) {
return NextResponse.json({ error: "Supabase n'est pas encore configuré côté serveur (SUPABASE_SERVICE_ROLE_KEY manquante)." }, { status: 500 });
}

const compte = await getCompteFromToken(request);
if (!compte || compte.role !== "admin") {
return NextResponse.json({ error: "Réservé à l'administrateur." }, { status: 403 });
}

const { id } = await params;

if (id === compte.id) {
return NextResponse.json({ error: "Impossible de supprimer son propre compte." }, { status: 400 });
}

const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
if (deleteError) {
return NextResponse.json({ error: `Échec de la suppression : ${deleteError.message}` }, { status: 500 });
}

return NextResponse.json({ success: true });
}
