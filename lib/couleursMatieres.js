// Palette de 8 couleurs franches et bien distinctes, pour que chaque
// matière soit reconnaissable au premier coup d'œil (bordure des cartes de
// devoirs, liste "Chapitres et documents"). Les matières habituelles de la
// famille (voir lib/sampleData.js) gardent leur couleur fixe et mémorisable
// pour rester cohérentes avec l'historique ; toute matière au nom non
// reconnu reçoit automatiquement la couleur de la palette la moins déjà
// utilisée, pour rester bien distincte des matières existantes plutôt que
// de toutes hériter de la même couleur par défaut.
export const PALETTE_COULEURS = [
  "#3B82F6", // bleu
  "#8B5CF6", // violet
  "#F97316", // orange
  "#22C55E", // vert
  "#EAB308", // jaune
  "#EF4444", // rouge
  "#06B6D4", // cyan
  "#EC4899", // rose
];

const COULEURS_PAR_NOM = {
  "Mathématiques": "#3B82F6",
  "Physique-Chimie": "#8B5CF6",
  "Technologie": "#F97316",
  "Sciences de la Vie et de la Terre": "#22C55E",
  "Histoire-Géographie": "#EAB308",
  "Anglais": "#EF4444",
  "Allemand": "#06B6D4",
  "Français": "#EC4899",
};

// Choisit la couleur d'une nouvelle matière au moment de sa création : la
// couleur habituelle si le nom correspond à une des 8 matières connues,
// sinon la couleur de la palette la moins représentée parmi les matières
// déjà créées (round-robin), pour qu'elle reste bien distincte même si la
// famille utilise plus de 8 matières.
export function choisirCouleurMatiere(nom, matieresExistantes = []) {
  if (COULEURS_PAR_NOM[nom]) return COULEURS_PAR_NOM[nom];
  const compte = new Map(PALETTE_COULEURS.map((c) => [c, 0]));
  matieresExistantes.forEach((m) => {
    if (m.couleur && compte.has(m.couleur)) compte.set(m.couleur, compte.get(m.couleur) + 1);
  });
  let meilleure = PALETTE_COULEURS[0];
  let meilleurCompte = Infinity;
  for (const c of PALETTE_COULEURS) {
    const n = compte.get(c);
    if (n < meilleurCompte) {
      meilleurCompte = n;
      meilleure = c;
    }
  }
  return meilleure;
}
