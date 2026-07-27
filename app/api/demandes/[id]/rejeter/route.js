import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

// Rejette une demande de compte (Parent ou Soutien) : réservé à l'administrateur.
// - Ne crée aucun compte
// - Marque la demande comme rejetée
export async function POST(request, { params }) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase n'est pas encore configuré côté serveur (SUPABASE_SERVICE_ROLE_KEY manquante)." }, { status: 500 });
  }

  const compte = await getCompteFromToken(request);
  if (!compte || compte.role !== "admin") {
    return NextResponse.json({ error: "Réservé à l'administrateur." }, { status: 403 });
  }

  const { id } = await params;

  const { data: demande, error: demandeError } = await supabaseAdmin
    .from("demandes_comptes")
    .select("*")
    .eq("id", id)
    .single();

  if (demandeError || !demande) {
    return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
  }
  if (demande.statut !== "en_attente") {
    return NextResponse.json({ error: "Cette demande a déjà été traitée." }, { status: 409 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("demandes_comptes")
    .update({ statut: "rejetee" })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: `Échec du rejet : ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
