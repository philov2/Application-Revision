import "./globals.css";

export const metadata = {
  title: "Application de révision",
  description: "Application familiale de révision pour enfants, parents et soutiens",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#91CAFF",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-50">
        {children}
      </body>
    </html>
  );
}
