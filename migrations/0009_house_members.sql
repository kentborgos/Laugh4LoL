-- House backstage can edit member name, 18+ flag, and ID on file.
alter table profiles add column if not exists age_verified boolean not null default false;
alter table profiles add column if not exists id_type text not null default '';
alter table profiles add column if not exists id_number text not null default '';
alter table profiles add column if not exists id_jurisdiction text not null default '';
