import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

// Retire l'abonnement push d'un appareil. Filtré par compte_id en plus de
// l'endpoint, pour qu'un compte ne puisse pas désabonner l'appareil d'un
// autre compte en devinant/rejouant un endpoint.
export async function POST(request) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase n'est pas encore configuré côté serveur (SUPABASE_SERVICE_ROLE_KEY manquante)." }, { status: 500 });
  }

  const compte = await getCompteFromToken(request);
  if (!compte) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { endpoint } = await request.json();
  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint manquant." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("compte_id", compte.id);
  if (error) {
    return NextResponse.json({ error: `Échec de la suppression de l'abonnement : ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
