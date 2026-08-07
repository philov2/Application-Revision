"use client";

import { useEffect, useState } from "react";
import { notificationsSupportees, permissionNotifications, demanderPermissionNotifications, envoyerNotification } from "@/lib/notifications";
import { pushSupporte, abonnerPush } from "@/lib/pushClient";

// Petite pastille discrète pour activer les notifications (nouveaux
// messages, nouveaux devoirs, corrections). Deux couches, l'une par-dessus
// l'autre : les notifications navigateur classiques (Web Notification API,
// tant que l'onglet est ouvert) et, si le navigateur le permet, un vrai
// abonnement push (service worker + VAPID) qui continue de fonctionner même
// app/onglet fermé — voir lib/pushClient.js. L'abonnement push est toujours
// tenté silencieusement : s'il échoue (VAPID non configuré, navigateur qui
// ne le supporte pas...), les notifications navigateur classiques restent
// actives quand même, donc rien ne casse pour l'utilisateur.
export default function ActivateNotifications() {
  const [permission, setPermission] = useState("default");

  useEffect(() => {
    setPermission(permissionNotifications());
  }, []);

  // Réabonnement silencieux : si la permission a déjà été accordée lors
  // d'une session précédente (avant l'introduction du push), on tente de
  // créer l'abonnement push dès l'ouverture de l'app, sans que
  // l'utilisateur ait besoin de recliquer sur quoi que ce soit.
  useEffect(() => {
    if (permission === "granted" && pushSupporte()) {
      abonnerPush().catch(() => {
        // Silencieux : les notifications navigateur classiques suffisent en repli.
      });
    }
  }, [permission]);

  async function activer() {
    const resultat = await demanderPermissionNotifications();
    setPermission(resultat);
    if (resultat === "granted") {
      envoyerNotification(
        "Notifications activées",
        "Vous recevrez une alerte pour les nouveaux messages, devoirs et corrections."
      );
      if (pushSupporte()) {
        abonnerPush().catch(() => {
          // Silencieux : les notifications navigateur classiques suffisent en repli.
        });
      }
    }
  }

  if (!notificationsSupportees()) return null;

  if (permission === "denied") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium text-slate-400"
        title="Notifications bloquées pour ce site — à réactiver dans les réglages du navigateur (icône de cadenas à côté de l'adresse du site)"
      >
        🔕 Notifications bloquées
      </span>
    );
  }

  // Une fois la permission accordée, plus rien à afficher ici : les liens
  // "Tester" / "Tester push" n'avaient de sens que le temps de mettre en
  // place et vérifier le circuit push (voir Jalon "notifications push") —
  // maintenant que c'est en place, les notifications fonctionnent
  // silencieusement en arrière-plan, sans UI dédiée dans l'en-tête.
  if (permission !== "default") return null;

  return (
    <button
      onClick={activer}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border border-slate-300 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
      title="Recevoir une notification pour les nouveaux messages, devoirs et corrections"
    >
      🔔 Activer les notifications
    </button>
  );
}
