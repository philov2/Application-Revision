import { createClient } from "@supabase/supabase-js";

// Ces deux valeurs sont fournies par Supabase (Settings > API : "Project URL"
// et "publishable key") et doivent être placées dans un fichier .env.local
// (voir .env.local.example).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// En l'absence de configuration (avant la création du projet Supabase),
// l'application reste utilisable en mode "démonstration" avec des données d'exemple
// (voir lib/sampleData.js), pour permettre de prévisualiser l'interface.
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
