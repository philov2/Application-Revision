"use client";

import { useEffect, useState } from "react";
import { notificationsSupportees, permissionNotifications, demanderPermissionNotifications } from "@/lib/notifications";

// Petite pastille discrète pour activer les notifications navigateur
// (nouveaux messages, nouveaux devoirs, corrections). N'apparaît que si le
// navigateur les supporte et que l'utilisateur ne s'est pas encore
// prononcé — une fois accordée ou refusée, elle disparaît pour ne pas
// encombrer l'en-tête.
export default function ActivateNotifications() {
  const [permission, setPermission] = useState("default");

  useEffect(() => {
    setPermission(permissionNotifications());
  }, []);

  async function activer() {
    const resultat = await demanderPermissionNotifications();
    setPermission(resultat);
  }

  if (!notificationsSupportees() || permission !== "default") return null;

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
