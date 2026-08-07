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
      className="text-sm font-medium rounded-lg px-3 py-1.5 border border-slate-300 dark:border-slate-600"
      title={sombre ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {sombre ? "☀️ Clair" : "🌙 Sombre"}
    </button>
  );
}
