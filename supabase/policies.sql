-- Règles d'accès (Row Level Security) — MVP
-- À exécuter après schema.sql dans l'éditeur SQL de Supabase.

alter table comptes enable row level security;
alter table liens_parent_enfant enable row level security;
alter table liens_soutien enable row level security;
alter table matieres enable row level security;
alter table chapitres enable row level security;
alter table documents enable row level security;
alter table devoirs enable row level security;
alter table reponses_exercices enable row level security;
alter table tests enable row level security;
alter table resultats_tests enable row level security;
alter table demandes_comptes enable row level security;

-- Un utilisateur voit toujours sa propre fiche compte
create policy "voir son propre compte" on comptes
for select using (id = auth.uid());

-- L'administrateur voit et gère tous les comptes
create policy "admin gere tous les comptes" on comptes
for all using (
  exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
);

-- Un parent voit les comptes de ses enfants
create policy "parent voit ses enfants" on comptes
for select using (
  exists (
    select 1 from liens_parent_enfant l
    where l.enfant_id = comptes.id and l.parent_id = auth.uid()
  )
);

-- Un parent/enfant voit ses propres liens de rattachement (sans policy de
-- lecture ici, meme le proprietaire ne peut pas lire sa propre ligne : bug
-- trouve lors du test du Jalon 2, qui faisait retomber le dashboard Parent
-- sur les donnees de demonstration au lieu des vraies donnees).
create policy "parent et enfant voient leurs liens" on liens_parent_enfant
for select using (
  parent_id = auth.uid()
  or enfant_id = auth.uid()
  or exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
);

-- Meme chose pour les rattachements soutien <-> enfant.
create policy "soutien et parent voient liens_soutien" on liens_soutien
for select using (
  soutien_id = auth.uid()
  or enfant_id = auth.uid()
  or exists (select 1 from liens_parent_enfant l where l.enfant_id = liens_soutien.enfant_id and l.parent_id = auth.uid())
  or exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
);

-- Documents et devoirs : visibles par l'enfant concerné, son ou ses parents,
-- et les soutiens rattachés pour la matière concernée.
create policy "acces documents enfant" on documents
for select using (
  enfant_id = auth.uid()
  or exists (select 1 from liens_parent_enfant l where l.enfant_id = documents.enfant_id and l.parent_id = auth.uid())
  or exists (select 1 from liens_soutien s where s.enfant_id = documents.enfant_id and s.matiere_id = documents.matiere_id and s.soutien_id = auth.uid())
  or cree_par = auth.uid()
);

-- L'administrateur voit tous les documents (pas seulement les siens)
create policy "admin voit tous les documents" on documents
for select using (
  exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
);

create policy "acces devoirs enfant" on devoirs
for select using (
  enfant_id = auth.uid()
  or exists (select 1 from liens_parent_enfant l where l.enfant_id = devoirs.enfant_id and l.parent_id = auth.uid())
  or exists (select 1 from liens_soutien s where s.enfant_id = devoirs.enfant_id and s.matiere_id = devoirs.matiere_id and s.soutien_id = auth.uid())
);

-- Seuls parents et soutiens peuvent créer/modifier des devoirs pour un enfant qui leur est rattaché
create policy "creation devoirs par parent ou soutien" on devoirs
for insert with check (
  exists (select 1 from liens_parent_enfant l where l.enfant_id = devoirs.enfant_id and l.parent_id = auth.uid())
  or exists (select 1 from liens_soutien s where s.enfant_id = devoirs.enfant_id and s.matiere_id = devoirs.matiere_id and s.soutien_id = auth.uid())
);

-- Matières / chapitres : lecture ouverte à tout compte actif (référentiel commun)
create policy "lecture matieres" on matieres for select using (auth.uid() is not null);
create policy "lecture chapitres" on chapitres for select using (auth.uid() is not null);

-- Jalon 2 : un soutien assigné à une matière (ou l'admin) peut créer des chapitres
create policy "creation chapitres par soutien ou admin" on chapitres
for insert with check (
  exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
  or exists (select 1 from liens_soutien s where s.matiere_id = chapitres.matiere_id and s.soutien_id = auth.uid())
);

-- Jalon 2 : un soutien assigné (matière + enfant) ou l'admin peut créer des documents
create policy "creation documents par soutien ou admin" on documents
for insert with check (
  cree_par = auth.uid()
  and (
    exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
    or (enfant_id is not null and exists (select 1 from liens_soutien s where s.matiere_id = documents.matiere_id and s.enfant_id = documents.enfant_id and s.soutien_id = auth.uid()))
  )
);

-- Jalon 2 : bucket de stockage 'documents' (privé) pour les fichiers importés.
-- Upload restreint au dossier personnel (nom de fichier prefixe par l'uid du
-- créateur) ; lecture ouverte à tout compte authentifié (famille unique, la
-- ligne documents correspondante reste elle-même filtree par RLS ci-dessus).
-- insert into storage.buckets (id, name, public) values ('documents', 'documents', false);
-- create policy "upload documents dans son propre dossier" on storage.objects
-- for insert with check (bucket_id = 'documents' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);
-- create policy "lecture documents par compte authentifie" on storage.objects
-- for select using (bucket_id = 'documents' and auth.uid() is not null);

-- Demandes de création de compte (Jalon 1)
-- Tout le monde (y compris un visiteur non connecté, via la clé publishable)
-- peut déposer une demande de compte Parent depuis la page publique /demande.
create policy "demande parent publique" on demandes_comptes
for insert with check (type_compte = 'parent' and demandeur_id is null);

-- Un parent connecté peut demander un compte Soutien pour lui-même/un tiers.
create policy "demande soutien par parent" on demandes_comptes
for insert with check (
  type_compte = 'soutien'
  and demandeur_id = auth.uid()
  and exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'parent')
);

-- Seul l'administrateur peut consulter/traiter les demandes
-- (la création du compte lui-même se fait via une route API dédiée, avec la
-- clé secrète Supabase, qui n'est jamais exposée au navigateur).
create policy "admin gere les demandes" on demandes_comptes
for select using (
  exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
);
create policy "admin met a jour les demandes" on demandes_comptes
for update using (
  exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
);

-- NOTE: ce fichier pose les fondations. Chaque nouvelle fonctionnalité (V2) devra
-- ajouter ses propres policies avant mise en production.

-- Jalon 3 : l'enfant peut mettre a jour le statut de ses propres devoirs
create policy "enfant met a jour le statut de ses devoirs" on devoirs
for update using (enfant_id = auth.uid())
with check (enfant_id = auth.uid());

-- Jalon 3 : l'administrateur peut aussi creer des devoirs
create policy "admin cree des devoirs" on devoirs
for insert with check (
  exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
);

-- NOTE DE SYNCHRONISATION (voir cahier des charges, section 8.1 et 11.2) :
-- plusieurs autres règles sont actives en production mais n'ont pas encore
-- été recopiées ici avec leur texte exact (modification/suppression de
-- devoirs par parent/soutien/admin, réponses aux exercices, tests et
-- résultats de tests). Elles fonctionnent et ont été testées en conditions
-- réelles, mais ce fichier ne doit pas, en l'état, être considéré comme une
-- source complète pour reconstruire la base de données à l'identique tant
-- qu'elles n'y auront pas été ajoutées avec leur texte exact.

-- Jalon "devoir + document" (ajouté suite au signalement : un devoir créé
-- restait vide, sans document, et rien ne permettait à un parent d'en
-- attacher un) : un parent peut, comme un soutien, créer un document pour
-- son propre enfant — utilisé quand il joint ou importe un document au
-- moment de créer un devoir.
create policy "creation documents par parent" on documents
for insert with check (
  cree_par = auth.uid()
  and enfant_id is not null
  and exists (select 1 from liens_parent_enfant l where l.enfant_id = documents.enfant_id and l.parent_id = auth.uid())
);

-- Jalon "titre + creation matiere/chapitre + generation IA" (suite au
-- signalement : impossible de nommer un devoir, de créer une nouvelle matière
-- ou un nouveau chapitre depuis un compte Parent ou Soutien). La colonne
-- devoirs.titre est ajoutée dans schema.sql. Décision retenue : Parent,
-- Soutien et Admin peuvent tous créer une matière ou un chapitre (référentiel
-- commun, pas de restriction par rattachement pour la création — seule la
-- lecture reste ouverte à tout compte actif comme avant).
create policy "creation matieres par parent soutien ou admin" on matieres
for insert with check (
  exists (select 1 from comptes c where c.id = auth.uid() and c.role in ('parent', 'soutien', 'admin'))
);

create policy "creation chapitres par parent ou admin" on chapitres
for insert with check (
  exists (select 1 from comptes c where c.id = auth.uid() and c.role in ('parent', 'soutien', 'admin'))
);

-- Jalon "fichiers multiples + statut en attente de correction" : la reponse
-- d'exercice envoyee par l'enfant echouait avec "new row violates row-level
-- security policy" une fois passee au nouveau format (fichiers_urls au lieu
-- de photo_url). Regle explicite et redondante (permissive, donc sans risque
-- de conflit avec une policy existante) : l'enfant proprietaire du devoir,
-- ou l'administrateur, peut inserer une reponse d'exercice.
create policy "enfant ou admin envoie une reponse d'exercice" on reponses_exercices
for insert with check (
  exists (
    select 1 from devoirs d
    where d.id = reponses_exercices.devoir_id
    and (
      d.enfant_id = auth.uid()
      or exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
    )
  )
);

-- Meme jalon : le televersement du fichier lui-meme (avant l'insertion dans
-- reponses_exercices) passe par le bucket Storage "documents", dont la
-- policy existante limite l'upload au dossier de l'utilisateur connecte
-- (auth.uid() = premier segment du chemin). Ca bloque un admin qui teste ou
-- agit au nom d'un enfant. Regle additionnelle et sans risque (permissive) :
-- l'admin peut televerser dans le bucket "documents", quel que soit le
-- dossier cible.
create policy "admin televerse dans le bucket documents" on storage.objects
for insert with check (
  bucket_id = 'documents'
  and exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
);

-- Jalon "suppression de chapitres obsolètes" : la suppression d'un chapitre
-- passe par une route API dédiée (app/api/chapitres/[id]/route.js) utilisant
-- la clé de service Supabase, qui contourne les RLS ; l'autorisation
-- (parent, soutien ou admin) est vérifiée côté route et non via une policy
-- RLS ici — même principe que la suppression d'un document (voir Jalon
-- "suppression d'un document référencé par un devoir"). Aucune nouvelle
-- policy n'est donc nécessaire pour cette fonctionnalité ; seules les
-- contraintes de clé étrangère chapitre_id (documents, devoirs, tests) sont
-- passées en "on delete set null" dans schema.sql.

-- Jalon 6 (V2) : messagerie interne par famille. Un seul fil de discussion
-- par enfant (voir schema.sql : table messages), accessible a l'enfant
-- concerne, son ou ses parents, tout soutien qui lui est rattache (quelle
-- que soit la matiere - la messagerie n'est pas decoupee par matiere,
-- contrairement aux documents) et l'administrateur.
alter table messages enable row level security;
alter table messages_lectures enable row level security;

create policy "acces messages famille" on messages
for select using (
  enfant_id = auth.uid()
  or exists (select 1 from liens_parent_enfant l where l.enfant_id = messages.enfant_id and l.parent_id = auth.uid())
  or exists (select 1 from liens_soutien s where s.enfant_id = messages.enfant_id and s.soutien_id = auth.uid())
  or exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
);

create policy "envoi messages famille" on messages
for insert with check (
  auteur_id = auth.uid()
  and (
    enfant_id = auth.uid()
    or exists (select 1 from liens_parent_enfant l where l.enfant_id = messages.enfant_id and l.parent_id = auth.uid())
    or exists (select 1 from liens_soutien s where s.enfant_id = messages.enfant_id and s.soutien_id = auth.uid())
    or exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
  )
);

-- Suivi de lecture (badge de messages non lus) : chacun ne gere que sa propre ligne.
create policy "gestion de sa propre lecture de messages" on messages_lectures
for all using (compte_id = auth.uid())
with check (compte_id = auth.uid());

-- Jalon 6 (ajustement "destinataire du message") : la colonne
-- messages.destinataire_id (voir schema.sql) permet d'indiquer a qui un
-- message est adresse (null = tout le monde, comme avant). Pour construire
-- la liste des destinataires possibles dans le formulaire d'envoi, et pour
-- que le nom de l'auteur d'un message s'affiche correctement pour un vrai
-- compte Parent/Enfant/Soutien (et non plus seulement pour l'administrateur,
-- qui voit deja tous les comptes), il faut que les membres d'une meme
-- famille (l'enfant, son ou ses parents, son ou ses soutiens) puissent voir
-- les comptes des autres membres de cette meme famille.
create policy "comptes de la meme famille se voient entre eux" on comptes
for select using (
  exists (select 1 from liens_parent_enfant l where l.enfant_id = auth.uid() and l.parent_id = comptes.id)
  or exists (select 1 from liens_soutien s where s.enfant_id = auth.uid() and s.soutien_id = comptes.id)
  or exists (select 1 from liens_soutien s where s.soutien_id = auth.uid() and s.enfant_id = comptes.id)
  or exists (select 1 from liens_parent_enfant l where l.parent_id = auth.uid() and l.enfant_id = comptes.id)
  or exists (
    select 1 from liens_parent_enfant lp
    join liens_soutien ls on ls.enfant_id = lp.enfant_id
    where lp.parent_id = auth.uid() and ls.soutien_id = comptes.id
  )
  or exists (
    select 1 from liens_soutien ls
    join liens_parent_enfant lp on lp.enfant_id = ls.enfant_id
    where ls.soutien_id = auth.uid() and lp.parent_id = comptes.id
  )
  or exists (
    select 1 from liens_parent_enfant lp1
    join liens_parent_enfant lp2 on lp2.enfant_id = lp1.enfant_id
    where lp1.parent_id = auth.uid() and lp2.parent_id = comptes.id
  )
);

-- Meme ajustement : un soutien doit pouvoir lire les liens parent-enfant de
-- "son" enfant (pour voir qui sont les parents), et un co-parent ou un autre
-- soutien doit pouvoir lire tous les liens soutien de l'enfant (les policies
-- existantes ci-dessus couvraient deja la plupart des cas ; on complete
-- uniquement les cas manquants : co-parent, et soutien voyant un autre
-- soutien du meme enfant).
create policy "famille voit tous les liens parent-enfant de leur enfant" on liens_parent_enfant
for select using (
  exists (select 1 from liens_soutien s where s.enfant_id = liens_parent_enfant.enfant_id and s.soutien_id = auth.uid())
  or exists (select 1 from liens_parent_enfant l2 where l2.enfant_id = liens_parent_enfant.enfant_id and l2.parent_id = auth.uid())
);

create policy "famille voit tous les liens soutien de leur enfant" on liens_soutien
for select using (
  exists (select 1 from liens_parent_enfant l where l.enfant_id = liens_soutien.enfant_id and l.parent_id = auth.uid())
  or exists (select 1 from liens_soutien s2 where s2.enfant_id = liens_soutien.enfant_id and s2.soutien_id = auth.uid())
);

-- Jalon "rattachement d'un document orphelin a un chapitre" (suite au
-- signalement : dans l'onglet Chapitres et documents, choisir un chapitre
-- pour un document importe avant que ce soit obligatoire ne faisait rien -
-- le document restait sans chapitre meme apres rafraichissement). Cause :
-- aucune policy RLS n'autorisait la modification (UPDATE) d'un document,
-- donc l'appel Supabase echouait silencieusement (pas d'erreur, 0 ligne
-- modifiee). Autorise desormais le parent ou le soutien rattache a
-- l'enfant/la matiere concernee, ou l'administrateur.
create policy "rattachement document a un chapitre par parent soutien ou admin" on documents
for update using (
  exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
  or exists (select 1 from liens_parent_enfant l where l.enfant_id = documents.enfant_id and l.parent_id = auth.uid())
  or exists (select 1 from liens_soutien s where s.enfant_id = documents.enfant_id and s.matiere_id = documents.matiere_id and s.soutien_id = auth.uid())
)
with check (
  exists (select 1 from comptes c where c.id = auth.uid() and c.role = 'admin')
  or exists (select 1 from liens_parent_enfant l where l.enfant_id = documents.enfant_id and l.parent_id = auth.uid())
  or exists (select 1 from liens_soutien s where s.enfant_id = documents.enfant_id and s.matiere_id = documents.matiere_id and s.soutien_id = auth.uid())
);
