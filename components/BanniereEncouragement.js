"use client";

import { genererMessageEncouragement } from "@/lib/messagesEncouragement";

/* Jalon "messages d'encouragement" (signalement de Phil : rendre l'application
   plus attractive pour une adolescente) : petite bannière positive au-dessus
   des devoirs, côté Enfant et Parent (ce dernier en lecture seule, pour voir
   l'engagement sans avoir à demander). */
export default function BanniereEncouragement({ devoirs }) {
  const message = genererMessageEncouragement(devoirs || []);
  return (
    <div className="rounded-xl px-4 py-3 text-sm font-medium bg-gradient-to-r from-indigo-50 to-pink-50 dark:from-indigo-950/40 dark:to-pink-950/40 text-indigo-700 dark:text-indigo-300">
      {message}
    </div>
  );
}
