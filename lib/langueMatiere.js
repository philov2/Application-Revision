// Certaines matières sont des langues étrangères (Allemand, Anglais...) :
// le contenu généré par IA pour ces matières (synthèse, exercices, corrigé,
// test) doit porter sur CETTE langue et ne jamais se mélanger avec une autre
// langue étrangère — signalement de Phil : "dans une matière Allemand on ne
// devrait avoir que des documents qui concernent l'allemand, idem pour
// l'anglais". Suite à un second retour de Phil, les consignes/instructions
// restent en français (pour que l'enfant comprenne ce qu'il doit faire) ;
// seul le contenu linguistique proprement dit (vocabulaire, phrases, textes)
// est dans la langue de la matière.
//
// La détection se fait sur le nom de la matière (texte libre saisi par le
// Parent/Soutien), en tolérant accents/casse et les noms composés courants
// ("Anglais LV1", "Allemand renforcé"...).
//
// Jalon "synthese LaTeX illisible" (signalement de Phil : une synthese
// generee par IA affichait du LaTeX brut, ex. dollar-dfrac-a-sur-b-dollar,
// au lieu d'une fraction lisible) : le moteur de rendu Markdown de
// l'application (components/markdownDoc.js) est volontairement minimal et
// ne sait pas afficher de LaTeX. La consigne de notation ci-dessous
// (CONSIGNE_NOTATION) est donc ajoutee systematiquement au prompt systeme
// de toutes les generations IA (synthese, exercices, test) via cette meme
// fonction, pour que Claude n'utilise jamais de notation LaTeX.
const LANGUES_ETRANGERES = [
  { motsCles: ["allemand"], langue: "allemand (Deutsch)" },
  { motsCles: ["anglais"], langue: "anglais (English)" },
  { motsCles: ["espagnol"], langue: "espagnol (Español)" },
  { motsCles: ["italien"], langue: "italien (Italiano)" },
  ];

const CONSIGNE_NOTATION = "N'utilise jamais de notation LaTeX (pas de signes dollar autour des formules, pas de commandes commencant par un backslash comme frac ou sqrt) : ce document est affiche sans moteur de rendu mathematique. Pour une fraction, ecris-la sous la forme a/b (exemple : 3/4). Pour une puissance, ecris x2 ou x^2. Pour une racine carree, ecris-la en toutes lettres (racine carree de x). Pour une multiplication, utilise x ou le mot fois.";

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
// langue étrangère, exige que le contenu linguistique (vocabulaire, phrases,
// textes, questions de traduction, réponses attendues) soit dans cette
// langue et JAMAIS dans une autre langue étrangère, mais garde les
// consignes/instructions données à l'enfant en français pour qu'il comprenne
// ce qu'il doit faire ; pour les autres matières, comportement inchangé
// (tout en français).
export function consigneLangue(nomMatiere) {
    const langue = detecterLangueEtrangere(nomMatiere);
    if (!langue) {
          return `Rédige ta réponse en français. ${CONSIGNE_NOTATION}`;
    }
    return `Cette matière porte sur l'apprentissage de la langue étrangère suivante : ${langue}. Rédige les consignes, instructions et explications en français (l'enfant doit comprendre facilement ce qu'il doit faire). En revanche, tout le contenu linguistique proprement dit — mots de vocabulaire, phrases, textes à lire/traduire/compléter, dialogues, réponses attendues dans la langue — doit être en ${langue}, jamais en français ni dans une autre langue étrangère. Ne mélange jamais deux langues étrangères différentes : si la matière est ${langue}, tout le vocabulaire et les phrases doivent être exclusivement en ${langue} (pas un mot d'anglais dans un exercice d'allemand, pas un mot d'allemand dans un exercice d'anglais, etc.). ${CONSIGNE_NOTATION}`;
}
