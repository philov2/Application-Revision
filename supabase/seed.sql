-- Données initiales de la famille — à exécuter après schema.sql et policies.sql.
--
-- Composition de la famille (voir Addendum au DCF) :
--   Enfant  : Rose — 4ème (collège)
--   Parents : JC et Virginie
--   Soutien : Viviane — Allemand, Français, Anglais, Histoire-Géographie
--   Administrateur : Philippe — couvre aussi Mathématiques, Technologie,
--     Physique-Chimie, Sciences de la Vie et de la Terre, Histoire-Géographie
--     et Anglais via son compte admin (pas de compte "soutien" séparé pour lui,
--     l'administrateur a déjà accès à toutes les matières et tous les enfants).

-- 1) Matières (peut être exécuté dès maintenant, ne dépend d'aucun compte).
-- Palette en dégradé entre le bleu #91CAFF (Mathématiques) et le rose #F7CEE6
-- (Français) imposés par le DCF, des matières scientifiques vers les langues.
insert into matieres (nom, couleur) values
  ('Mathématiques', '#91CAFF'),
  ('Physique-Chimie', '#A0CBFB'),
  ('Technologie', '#AECBF8'),
  ('Sciences de la Vie et de la Terre', '#BDCCF4'),
  ('Histoire-Géographie', '#CBCCF1'),
  ('Anglais', '#DACDED'),
  ('Allemand', '#E8CDEA'),
  ('Français', '#F7CEE6');

-- 2) Comptes (JC, Virginie, Rose, Viviane) : créés directement depuis
-- l'application (Jalon 1), pas en SQL manuel.
--
--   a) Le premier compte administrateur (Philippe) doit être créé une seule
--      fois à la main, car il n'y a personne pour le valider avant lui :
--      - Dans Supabase > Authentication > Users, cliquer "Add user" et créer
--        le compte de Philippe (email + mot de passe).
--      - Puis exécuter, en remplaçant <uuid-philippe> par l'identifiant affiché :
--        insert into comptes (id, email, nom, role, statut)
--        values ('<uuid-philippe>', '<email-philippe>', 'Philippe', 'admin', 'actif');
--
--   b) JC et Virginie : chacun se rend sur /demande et fait une demande de
--      compte Parent (nom + email). Philippe, connecté sur /admin, clique
--      "Valider" : le compte est créé automatiquement et un email
--      d'invitation est envoyé pour choisir le mot de passe.
--
--   c) Rose : une fois JC ou Virginie connecté(e), il/elle clique sur
--      "+ Ajouter un enfant" dans son tableau de bord Parent (nom, email,
--      niveau scolaire). Aucune validation admin nécessaire (conforme au DCF).
--
--   d) Viviane : JC ou Virginie clique sur "+ Demander un compte soutien"
--      dans son tableau de bord Parent, indique le nom, l'email de Viviane et
--      coche les 4 matières (Allemand, Français, Anglais, Histoire-Géographie).
--      Philippe valide la demande sur /admin : le compte est créé et
--      automatiquement rattaché à Rose pour ces 4 matières.
