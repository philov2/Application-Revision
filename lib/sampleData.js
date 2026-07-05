// Données d'exemple utilisées uniquement tant que le projet Supabase n'est pas
// encore connecté (voir README.md). Reflètent la composition réelle de la
// famille (voir supabase/seed.sql) pour prévisualiser l'interface avec des
// données proches du réel, en attendant la création des vrais comptes.

// Palette dégradée entre les 2 couleurs imposées par le DCF : bleu #91CAFF
// (Mathématiques) et rose #F7CEE6 (Français). Les 6 matières intermédiaires
// suivent le même dégradé (interpolation linéaire), classées des matières
// scientifiques (côté bleu) aux langues/lettres (côté rose), pour une palette
// cohérente plutôt qu'un arc-en-ciel de couleurs sans rapport.
export const matieres = [
  { id: "m1", nom: "Mathématiques", couleur: "#91CAFF" },
  { id: "m7", nom: "Physique-Chimie", couleur: "#A0CBFB" },
  { id: "m6", nom: "Technologie", couleur: "#AECBF8" },
  { id: "m8", nom: "Sciences de la Vie et de la Terre", couleur: "#BDCCF4" },
  { id: "m5", nom: "Histoire-Géographie", couleur: "#CBCCF1" },
  { id: "m3", nom: "Anglais", couleur: "#DACDED" },
  { id: "m4", nom: "Allemand", couleur: "#E8CDEA" },
  { id: "m2", nom: "Français", couleur: "#F7CEE6" },
];

// Répartition réelle des soutiens par matière (voir Addendum au DCF) :
// - Viviane : Allemand, Français, Anglais, Histoire-Géographie
// - Philippe (administrateur) : Mathématiques, Technologie, Physique-Chimie,
//   Sciences de la Vie et de la Terre, Histoire-Géographie, Anglais
export const devoirsEnfant = [
  { id: "d1", matiere: "Mathématiques", chapitre: "Fractions", type: "revision", echeance: "2026-07-06", statut: "a_faire", origine: "Philippe (soutien)" },
  { id: "d2", matiere: "Français", chapitre: "Le passé simple", type: "exercice", echeance: "2026-07-07", statut: "a_faire", origine: "Viviane (soutien)" },
  { id: "d3", matiere: "Histoire-Géographie", chapitre: "La Révolution française", type: "test", echeance: "2026-07-05", statut: "fait", origine: "Virginie (parent)" },
  { id: "d4", matiere: "Anglais", chapitre: "Present perfect", type: "revision", echeance: "2026-07-08", statut: "a_faire", origine: "JC (parent)" },
];

export const enfants = [
  { id: "e1", nom: "Rose", niveau: "4ème (collège)", devoirsAFaire: 3, devoirsFaits: 1 },
];

export const demandesAdmin = [
  { id: "r1", type: "Nouveau compte Soutien", nom: "Viviane", email: "à renseigner", date: "2026-07-04" },
];
