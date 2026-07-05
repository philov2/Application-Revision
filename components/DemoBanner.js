import { supabaseConfigured } from "@/lib/supabaseClient";

export default function DemoBanner() {
  if (supabaseConfigured) return null;
  return (
    <div className="bg-amber-50 text-amber-900 text-sm px-4 py-2 border-b border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-900">
      Mode démonstration — données d&apos;exemple. Connectez un projet Supabase (voir README.md) pour utiliser de vraies données.
    </div>
  );
}
