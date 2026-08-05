// Notifications navigateur (Web Notification API). Fonctionne pendant que
// l'onglet est ouvert (au premier plan ou en arrière-plan) — contrairement
// aux notifications push classiques, elle ne nécessite ni service worker ni
// serveur dédié, ce qui convient à une appli sans infrastructure serveur
// propre. Limite connue : rien n'est envoyé si le navigateur/l'onglet est
// complètement fermé.

export function notificationsSupportees() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function permissionNotifications() {
  if (!notificationsSupportees()) return "unsupported";
  return Notification.permission;
}

export async function demanderPermissionNotifications() {
  if (!notificationsSupportees()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

// Affiche une notification si la permission a été accordée. N'affiche rien
// silencieusement sinon (pas d'erreur bloquante pour l'utilisateur).
export function envoyerNotification(titre, corps) {
  if (!notificationsSupportees() || Notification.permission !== "granted") return;
  try {
    const notif = new Notification(titre, { body: corps, icon: "/favicon.ico" });
    notif.onclick = () => {
      window.focus();
      notif.close();
    };
  } catch {
    // Certains contextes (ex. iframe, permissions déléguées) refusent
    // silencieusement la création — on n'interrompt pas l'app pour ça.
  }
}
