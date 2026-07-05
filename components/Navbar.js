import Link from "next/link";

export default function Navbar({ role, nom }) {
  const roleLabel = { parent: "Parent", enfant: "Enfant", soutien: "Soutien", admin: "Administrateur" }[role] || "";
  return (
    <header className="border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-lg" style={{ color: "#2E75B6" }}>
          Application de révision
        </Link>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {nom ? `${nom} · ${roleLabel}` : roleLabel}
        </div>
      </div>
    </header>
  );
}
