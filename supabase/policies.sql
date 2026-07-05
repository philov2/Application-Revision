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

-- Documents et devoirs : visibles par l'enfant concerné, son ou ses parents,
-- et les soutiens rattachés pour la matière concernée.
create policy "acces documents enfant" on documents
  for select using (
    enfant_id = auth.uid()
    or exists (select 1 from liens_parent_enfant l where l.enfant_id = documents.enfant_id and l.parent_id = auth.uid())
    or exists (select 1 from liens_soutien s where s.enfant_id = documents.enfant_id and s.matiere_id = documents.matiere_id and s.soutien_id = auth.uid())
    or cree_par = auth.uid()
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
