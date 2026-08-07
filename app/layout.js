import Script from "next/script";
import "./globals.css";

export const metadata = {
  title: "Application de révision",
  description: "Application familiale de révision pour enfants, parents et soutiens",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#4169E1",
};

// Script execute avant l'affichage (beforeInteractive) pour appliquer le mode
// sombre/clair choisi (localStorage "theme") avant le premier rendu visible,
// et eviter un flash de la mauvaise couleur. A defaut de choix enregistre,
// on se base sur la preference systeme.
const themeInitScript = `
  try {
    var t = localStorage.getItem("theme");
    var sombre = t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", sombre);
  } catch (e) {}
`;

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-50">
        <Script id="theme-init" strategy="beforeInteractive">{themeInitScript}</Script>
        {children}
      </body>
    </html>
  );
}
