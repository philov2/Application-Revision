"use client";

import { useEffect, useState } from "react";
import { notificationsSupportees, permissionNotifications, demanderPermissionNotifications, envoyerNotification } from "@/lib/notifications";

// Petite pastille discrète pour activer les notifications navigateur
// (nouveaux messages, nouveaux devoirs, corrections). N'apparaît que si le
// navigateur les supporte et que l'utilisateur ne s'est pas encore
// prononcé — une fois accordée, elle disparaît et une notification de
// confirmation est envoyée immédiatement, à la fois pour rassurer
// l'utilisateur que ça fonctionne et pour servir de test concret : si cette
// notification de confirmation n'apparaît pas, le blocage vient des
// réglages du navigateur ou du système, pas de l'application.
export default function ActivateNotifications() {
  const [permission, setPermission] = useState("default");

  useEffect(() => {
    setPermission(permissionNotifications());
  }, []);

  async function activer() {
    const resultat = await demanderPermissionNotifications();
    setPermission(resultat);
    if (resultat === "granted") {
      envoyerNotification(
        "Notifications activées",
        "Vous recevrez une alerte pour les nouveaux messages, devoirs et corrections."
      );
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

  // Une fois accordée, un petit lien "Tester" reste disponible : utile pour
  // vérifier à tout moment que les notifications arrivent bien (ex. après
  // avoir changé un réglage système), sans devoir attendre un vrai nouveau
  // message ou devoir.
  if (permission === "granted") {
    return (
      <button
        onClick={() =>
          envoyerNotification("Test de notification", "Si vous voyez ceci, les notifications fonctionnent.")
        }
        className="text-xs font-medium underline text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        title="Envoyer une notification de test"
      >
        🔔 Tester
      </button>
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
