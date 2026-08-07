import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

const clePublique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const clePrivee = process.env.VAPID_PRIVATE_KEY;
const pushConfigure = Boolean(clePublique && clePrivee);

if (pushConfigure) {
  webpush.setVapidDetails("mailto:philov2@gmail.com", clePublique, clePrivee);
}

// Envoie une notification push de test à tous les appareils abonnés du
// compte connecté — sert à vérifier concrètement que le circuit complet
// fonctionne (y compris app/onglet fermé), sans attendre un vrai message ou
// devoir. Contrairement à /api/push/envoyer (réservé aux déclencheurs
// automatiques via un secret partagé), cette route est protégée par le
// jeton de session normal : chacun ne peut se tester que lui-même.
export async function POST(request) {
  if (!supabaseAdminConfigured || !pushConfigure) {
    return NextResponse.json({ error: "Notifications push non configurées côté serveur." }, { status: 500 });
  }

  const compte = await getCompteFromToken(request);
  if (!compte) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { data: abonnements, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("compte_id", compte.id);

  if (error) {
    return NextResponse.json({ error: `Échec de la lecture des abonnements : ${error.message}` }, { status: 500 });
  }
  if (!abonnements || abonnements.length === 0) {
    return NextResponse.json({ error: "Aucun abonnement push actif sur cet appareil pour le moment." }, { status: 400 });
  }

  const charge = JSON.stringify({
    titre: "Test de notification push",
    corps: "Si vous voyez ceci, les notifications push fonctionnent — même app fermée.",
    url: "/",
  });

  await Promise.allSettled(
    abonnements.map((abo) =>
      webpush
        .sendNotification({ endpoint: abo.endpoint, keys: { p256dh: abo.p256dh, auth: abo.auth } }, charge)
        .catch((err) => {
          // 404/410 : l'abonnement n'est plus valide (désinstallé, permission
          // retirée...) — on le retire pour ne plus essayer de lui écrire.
          if (err.statusCode === 404 || err.statusCode === 410) {
            return supabaseAdmin.from("push_subscriptions").delete().eq("id", abo.id);
          }
          throw err;
        })
    )
  );

  return NextResponse.json({ success: true });
}
