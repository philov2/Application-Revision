-- Application de révision — schéma de base de données (MVP)
-- À exécuter dans l'éditeur SQL de Supabase (Project > SQL Editor).

create type role_compte as enum ('admin', 'parent', 'enfant', 'soutien');
create type type_document as enum ('cours', 'synthese', 'exercice', 'test', 'flashcard', 'corrige');
create type statut_devoir as enum ('a_faire', 'fait');
create type type_devoir as enum ('revision', 'exercice', 'test');

-- Comptes applicatifs, liés 1-1 à auth.users (Supabase Auth)
create table comptes (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nom text not null,
  role role_compte not null,
  statut text not null default 'en_attente', -- en_attente | actif | desactive
  created_at timestamptz not null default now()
);

-- Rattachement des enfants à leur(s) parent(s)
create table liens_parent_enfant (
  parent_id uuid references comptes(id) on delete cascade,
  enfant_id uuid references comptes(id) on delete cascade,
  niveau_scolaire text,
  primary key (parent_id, enfant_id)
);

create table matieres (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  couleur text not null default '#91CAFF'
);

create table chapitres (
  id uuid primary key default gen_random_uuid(),
  matiere_id uuid references matieres(id) on delete cascade,
  nom text not null
);

-- Rattachement des soutiens à un enfant, pour une matière donnée
create table liens_soutien (
  soutien_id uuid references comptes(id) on delete cascade,
  enfant_id uuid references comptes(id) on delete cascade,
  matiere_id uuid references matieres(id) on delete cascade,
  primary key (soutien_id, enfant_id, matiere_id)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  type type_document not null,
  matiere_id uuid references matieres(id),
  chapitre_id uuid references chapitres(id),
  enfant_id uuid references comptes(id), -- null tant que non attribué
  cree_par uuid references comptes(id) not null,
  fichier_url text not null,
  taille_octets bigint,
  format text,
  genere_par_ia boolean not null default false,
  created_at timestamptz not null default now()
);

create table devoirs (
  id uuid primary key default gen_random_uuid(),
  enfant_id uuid references comptes(id) not null,
  matiere_id uuid references matieres(id),
  chapitre_id uuid references chapitres(id),
  document_id uuid references documents(id),
  type type_devoir not null,
  date_echeance date,
  cree_par uuid references comptes(id) not null,
  statut statut_devoir not null default 'a_faire',
  date_realisation timestamptz,
  created_at timestamptz not null default now()
);

create table reponses_exercices (
  id uuid primary key default gen_random_uuid(),
  devoir_id uuid references devoirs(id) on delete cascade,
  photo_url text not null,
  date_soumission timestamptz not null default now(),
  note numeric(4,2),
  note_par uuid references comptes(id),
  commentaire text
);

create table tests (
  id uuid primary key default gen_random_uuid(),
  chapitre_id uuid references chapitres(id),
  titre text not null,
  questions jsonb not null -- [{ question, choix: [...], bonne_reponse }]
);

create table resultats_tests (
  id uuid primary key default gen_random_uuid(),
  test_id uuid references tests(id),
  enfant_id uuid references comptes(id) not null,
  reponses jsonb not null,
  note numeric(4,2),
  date_realisation timestamptz not null default now(),
  complet boolean not null default true
);

-- Historique conservé sans limite de durée (voir Addendum au DCF, section 1)

-- Demandes de création de compte (Jalon 1)
-- - type_compte = 'parent' : demande publique, avant toute connexion (page /demande)
-- - type_compte = 'soutien' : demande faite par un parent déjà connecté, pour lui-même
--   ou pour un tiers, en précisant les matières concernées
create table demandes_comptes (
  id uuid primary key default gen_random_uuid(),
  type_compte text not null check (type_compte in ('parent', 'soutien')),
  nom text not null,
  email text not null,
  matieres uuid[] not null default '{}', -- utilisé uniquement pour type_compte = 'soutien'
  demandeur_id uuid references comptes(id), -- le parent à l'origine de la demande (soutien uniquement)
  statut text not null default 'en_attente', -- en_attente | traitee
  date_demande timestamptz not null default now()
);
