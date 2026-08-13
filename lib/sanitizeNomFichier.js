// Nettoie un nom de fichier pour l'utiliser comme clé de stockage Supabase :
// enlève les accents, espaces et caractères spéciaux qui provoquent une
// erreur "Invalid key" à l'upload (signalement de Phil sur un import de réponse
// d'exercice dont le nom contenait des espaces et des accents).
export function sanitizeNomFichier(nom) {
    if (!nom) return "fichier";
    const sansAccents = nom.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return sansAccents.replace(/[^a-zA-Z0-9._-]/g, "_");
}
