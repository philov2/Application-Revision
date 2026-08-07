"use client";

import { useEffect, useState } from "react";
import { notificationsSupportees, permissionNotifications, demanderPermissionNotifications, envoyerNotification } from "@/lib/notifications";
import { pushSupporte, abonnerPush, testerPush } from "@/lib/pushClient";

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
  const [enCoursTestPush, setEnCoursTestPush] = useState(false);
  const [erreurPush, setErreurPush] = useState("");

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
        try {
          await abonnerPush();
        } catch (err) {
          setErreurPush(err.message);
        }
      }
    }
  }

  async function testerPushNotification() {
    setErreurPush("");
    setEnCoursTestPush(true);
    try {
      await testerPush();
    } catch (err) {
      setErreurPush(err.message);
    } finally {
      setEnCoursTestPush(false);
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

  // Une fois accordée, deux petits liens "Tester" restent disponibles :
  // l'un pour la notification navigateur classique (immédiate, utile
  // pendant qu'on a l'onglet ouvert sous les yeux), l'autre pour la
  // notification push (fait un aller-retour serveur, utile pour vérifier
  // que ça arrive bien même app fermée — à tester en fermant l'app juste
  // après avoir cliqué).
  if (permission === "granted") {
    return (
      <span className="inline-flex items-center gap-2 flex-wrap">
        <button
          onClick={() =>
            envoyerNotification("Test de notification", "Si vous voyez ceci, les notifications fonctionnent.")
          }
          className="text-xs font-medium underline text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          title="Envoyer une notification de test (onglet ouvert)"
        >
          🔔 Tester
        </button>
        {pushSupporte() && (
          <button
            onClick={testerPushNotification}
            disabled={enCoursTestPush}
            className="text-xs font-medium underline text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-50"
            title="Envoyer une notification push de test (fonctionne même app fermée)"
          >
            {enCoursTestPush ? "..." : "📡 Tester push"}
          </button>
        )}
        {erreurPush && <span className="text-xs text-red-500">{erreurPush}</span>}
      </span>
    );
  }

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
