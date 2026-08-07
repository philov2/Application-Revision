import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabaseAdmin";

const clePublique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const clePrivee = process.env.VAPID_PRIVATE_KEY;
const pushConfigure = Boolean(clePublique && clePrivee);

if (pushConfigure) {
  webpush.setVapidDetails("mailto:philov2@gmail.com", clePublique, clePrivee);
}

// Route "interne" appelée non pas par un utilisateur connecté, mais par les
// déclencheurs SQL (pg_net) côté Supabase quand un nouveau message arrive,
// qu'un devoir est créé, ou qu'un exercice est corrigé (voir
// supabase/push_notifications.sql). Comme il n'y a pas de session
// utilisateur dans ce cas, l'authentification se fait par un secret partagé
// (variable d'environnement PUSH_WEBHOOK_SECRET, envoyée dans l'en-tête
// x-push-secret par la fonction SQL) plutôt que par jeton Supabase.
export async function POST(request) {
  if (!supabaseAdminConfigured || !pushConfigure) {
    return NextResponse.json({ error: "Notifications push non configurées côté serveur." }, { status: 500 });
  }

  const secretAttendu = process.env.PUSH_WEBHOOK_SECRET;
  const secretRecu = request.headers.get("x-push-secret") || "";
  if (!secretAttendu || secretRecu !== secretAttendu) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { compteIds, titre, corps, url } = await request.json();
  if (!Array.isArray(compteIds) || compteIds.length === 0 || !titre) {
    return NextResponse.json({ error: "Paramètres manquants (compteIds, titre)." }, { status: 400 });
  }

  const { data: abonnements, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("compte_id", compteIds);

  if (error) {
    return NextResponse.json({ error: `Échec de la lecture des abonnements : ${error.message}` }, { status: 500 });
  }

  const charge = JSON.stringify({ titre, corps: corps || "", url: url || "/" });

  const resultats = await Promise.allSettled(
    (abonnements || []).map((abo) =>
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

  return NextResponse.json({ success: true, destinataires: (abonnements || []).length, resultats: resultats.length });
}
