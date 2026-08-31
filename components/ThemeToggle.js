"use client";

import { useEffect, useState } from "react";

// Bouton pour basculer manuellement entre mode clair et mode sombre.
// Le choix est mémorisé dans localStorage et prime sur la préférence
// système (voir le script d'initialisation dans app/layout.js).
export default function ThemeToggle() {
  const [sombre, setSombre] = useState(false);

  useEffect(() => {
    setSombre(document.documentElement.classList.contains("dark"));
  }, []);

  function basculer() {
    const nouveauSombre = !sombre;
    document.documentElement.classList.toggle("dark", nouveauSombre);
    try {
      localStorage.setItem("theme", nouveauSombre ? "dark" : "light");
    } catch (e) {}
    setSombre(nouveauSombre);
  }

  return (
    <button
      onClick={basculer}
      className="w-9 h-9 rounded-full flex items-center justify-center border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
      title={sombre ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {sombre ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.2A8.5 8.5 0 1 1 9.8 4a6.6 6.6 0 0 0 10.2 10.2z" />
        </svg>
      )}
    </button>
  );
}
