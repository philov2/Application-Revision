// Certaines matières sont des langues étrangères (Allemand, Anglais...) :
// le contenu généré par IA pour ces matières (synthèse, exercices, corrigé,
// test) doit être rédigé entièrement dans la langue de la matière, et non en
// français comme le reste de l'application — signalement de Phil : "dans une
// matière Allemand on ne devrait avoir que des documents qui concernent
// l'allemand, idem pour l'anglais".
//
// La détection se fait sur le nom de la matière (texte libre saisi par le
// Parent/Soutien), en tolérant accents/casse et les noms composés courants
// ("Anglais LV1", "Allemand renforcé"...).
const LANGUES_ETRANGERES = [
  { motsCles: ["allemand"], langue: "allemand (Deutsch)" },
  { motsCles: ["anglais"], langue: "anglais (English)" },
  { motsCles: ["espagnol"], langue: "espagnol (Español)" },
  { motsCles: ["italien"], langue: "italien (Italiano)" },
];

function normaliser(texte) {
  return (texte || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function detecterLangueEtrangere(nomMatiere) {
  const normalise = normaliser(nomMatiere);
  const trouvee = LANGUES_ETRANGERES.find((l) => l.motsCles.some((mot) => normalise.includes(mot)));
  return trouvee?.langue || null;
}

// Consigne à injecter dans le prompt système de Claude. Pour une matière de
// langue étrangère, exige que TOUT le contenu (titres, consignes,
// questions, explications) soit dans cette langue, sans mélange avec le
// français ; pour les autres matières, comportement inchangé (français).
export function consigneLangue(nomMatiere) {
  const langue = detecterLangueEtrangere(nomMatiere);
  if (!langue) {
    return "Rédige ta réponse en français.";
  }
  return `Cette matière est une langue étrangère (${langue}) : rédige la totalité du contenu — titres, consignes, questions, explications, corrigé — entièrement en ${langue}, sans aucun texte en français (à l'exception, si besoin, d'un mot-à-mot ponctuel pour clarifier une traduction). Comporte-toi comme un manuel scolaire rédigé dans cette langue.`;
}
