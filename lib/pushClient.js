import { authFetch } from "@/lib/authFetch";

// Notifications push (service worker + VAPID) : contrairement aux
// notifications navigateur classiques (lib/notifications.js), elles
// continuent d'arriver même quand l'application/l'onglet est fermé. Ce
// fichier gère l'abonnement de cet appareil (enregistrement du service
// worker + inscription auprès du navigateur + envoi de l'abonnement au
// serveur pour qu'il puisse plus tard lui pousser des notifications).

export function pushSupporte() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

// Le navigateur attend la clé VAPID publique sous forme de tableau
// d'octets, alors qu'on la manipule partout ailleurs en base64 (format
// donné par web-push côté serveur).
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const donneesBrutes = atob(base64);
  const tableau = new Uint8Array(donneesBrutes.length);
  for (let i = 0; i < donneesBrutes.length; i++) {
    tableau[i] = donneesBrutes.charCodeAt(i);
  }
  return tableau;
}

// Enregistre le service worker (s'il ne l'est pas déjà), crée l'abonnement
// push auprès du navigateur, et l'envoie au serveur pour qu'il soit
// rattaché à ce compte. Idempotent : si un abonnement existe déjà pour cet
// appareil, il est simplement renvoyé au serveur (utile pour le "réabonnement
// silencieux" au chargement, voir ActivateNotifications.js).
export async function abonnerPush() {
  if (!pushSupporte()) {
    throw new Error("Les notifications push ne sont pas supportées par ce navigateur.");
  }
  const clePublique = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!clePublique) {
    throw new Error("Notifications push non configurées côté serveur.");
  }

  const enregistrement = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let abonnement = await enregistrement.pushManager.getSubscription();
  if (!abonnement) {
    abonnement = await enregistrement.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(clePublique),
    });
  }

  await authFetch("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ subscription: abonnement.toJSON() }),
  });

  return abonnement;
}

// Retire l'abonnement, à la fois côté navigateur et côté serveur. Non
// utilisé pour l'instant dans l'interface (pas de bouton "désactiver"
// dédié aux push), mais prêt si besoin plus tard.
export async function desabonnerPush() {
  if (!pushSupporte()) return;
  const enregistrement = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!enregistrement) return;
  const abonnement = await enregistrement.pushManager.getSubscription();
  if (!abonnement) return;
  await authFetch("/api/push/unsubscribe", {
    method: "POST",
    body: JSON.stringify({ endpoint: abonnement.endpoint }),
  });
  await abonnement.unsubscribe();
}

// Demande au serveur d'envoyer une notification push de test à cet appareil
// (et à tout autre appareil abonné avec ce compte). Sert de vérification
// concrète que le circuit complet fonctionne, y compris app fermée.
export async function testerPush() {
  await authFetch("/api/push/tester", { method: "POST" });
}
