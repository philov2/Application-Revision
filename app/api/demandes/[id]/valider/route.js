import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

// Valide une demande de compte (Parent ou Soutien) : réservé à l'administrateur.
// - Crée le compte Supabase Auth (envoi d'un email d'invitation par Supabase)
// - Crée la ligne correspondante dans "comptes"
// - Pour un Soutien : rattache les matières demandées à tous les enfants du parent demandeur
// - Marque la demande comme traitée
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
  if (demande.statut === "traitee") {
    return NextResponse.json({ error: "Cette demande a déjà été traitée." }, { status: 409 });
  }

  // 1) Créer le compte Supabase Auth et envoyer l'email d'invitation
  const { data: invite, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(demande.email);
  if (inviteError) {
    return NextResponse.json({ error: `Échec de l'invitation : ${inviteError.message}` }, { status: 500 });
  }
  const nouveauCompteId = invite.user.id;

  // 2) Créer la ligne "comptes"
  const { error: compteError } = await supabaseAdmin.from("comptes").insert({
    id: nouveauCompteId,
    email: demande.email,
    nom: demande.nom,
    role: demande.type_compte, // 'parent' ou 'soutien'
    statut: "actif",
  });
  if (compteError) {
    return NextResponse.json({ error: `Échec de la création du compte : ${compteError.message}` }, { status: 500 });
  }

  // 3) Pour un Soutien : le rattacher, pour les matières demandées, à tous les
  // enfants du parent qui a fait la demande (voir DCF : un soutien a accès à
  // tous les enfants du parent pour la/les matière(s) qui lui ont été confiées).
  if (demande.type_compte === "soutien" && demande.demandeur_id) {
    const { data: enfants } = await supabaseAdmin
      .from("liens_parent_enfant")
      .select("enfant_id")
      .eq("parent_id", demande.demandeur_id);

    const lignes = [];
    for (const { enfant_id } of enfants || []) {
      for (const matiere_id of demande.matieres || []) {
        lignes.push({ soutien_id: nouveauCompteId, enfant_id, matiere_id });
      }
    }
    if (lignes.length > 0) {
      await supabaseAdmin.from("liens_soutien").insert(lignes);
    }
  }

  // 4) Marquer la demande comme traitée
  await supabaseAdmin.from("demandes_comptes").update({ statut: "traitee" }).eq("id", id);

  return NextResponse.json({ success: true, compteId: nouveauCompteId });
}
