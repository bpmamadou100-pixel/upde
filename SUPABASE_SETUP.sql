-- ============================================================
-- UPDe - configuration Supabase pour GitHub Pages
-- À exécuter UNE FOIS dans Supabase > SQL Editor
-- ============================================================

-- 1) Profils utilisateurs
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  name text not null default '',
  role text not null default 'student' check (role in ('student', 'prof')),
  level text not null default 'L1' check (level in ('L1', 'L2', '')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Fonction serveur sûre utilisée par les règles RLS.
create or replace function public.is_prof()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'prof'
  );
$$;

revoke all on function public.is_prof() from public;
grant execute on function public.is_prof() to authenticated;

drop policy if exists "profiles_select_own_or_prof" on public.profiles;
create policy "profiles_select_own_or_prof"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_prof()
);

-- Les profils sont créés automatiquement à l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, level)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'name', ''),
    'student',
    case
      when new.raw_user_meta_data->>'level' in ('L1','L2')
        then new.raw_user_meta_data->>'level'
      else 'L1'
    end
  )
  on conflict (id) do update
    set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Crée les profils manquants pour d'éventuels utilisateurs déjà présents.
insert into public.profiles (id, email, name, role, level)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data->>'name', split_part(coalesce(u.email,''), '@', 1)),
  'student',
  case
    when u.raw_user_meta_data->>'level' in ('L1','L2')
      then u.raw_user_meta_data->>'level'
    else 'L1'
  end
from auth.users u
on conflict (id) do nothing;

-- 2) Documents pédagogiques
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  level text not null check (level in ('L1', 'L2')),
  subject text not null,
  category text not null,
  storage_path text not null unique,
  original_name text not null default '',
  size bigint not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.documents enable row level security;

drop policy if exists "documents_read_authenticated" on public.documents;
create policy "documents_read_authenticated"
on public.documents
for select
to authenticated
using (true);

drop policy if exists "documents_insert_prof" on public.documents;
create policy "documents_insert_prof"
on public.documents
for insert
to authenticated
with check (public.is_prof());

drop policy if exists "documents_update_prof" on public.documents;
create policy "documents_update_prof"
on public.documents
for update
to authenticated
using (public.is_prof())
with check (public.is_prof());

drop policy if exists "documents_delete_prof" on public.documents;
create policy "documents_delete_prof"
on public.documents
for delete
to authenticated
using (public.is_prof());

-- Droits Data API
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.documents to authenticated;

-- 3) Bucket privé pour les PDF
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = array['application/pdf']::text[];

drop policy if exists "storage_documents_read_authenticated" on storage.objects;
create policy "storage_documents_read_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'documents');

drop policy if exists "storage_documents_insert_prof" on storage.objects;
create policy "storage_documents_insert_prof"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'documents'
  and public.is_prof()
);

drop policy if exists "storage_documents_delete_prof" on storage.objects;
create policy "storage_documents_delete_prof"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'documents'
  and public.is_prof()
);

-- ============================================================
-- COMMENT NOMMER LE PROFESSEUR
-- ============================================================
-- 1. Crée d'abord le compte du professeur dans Authentication > Users
--    OU inscris-toi normalement depuis le site.
-- 2. Puis remplace TON_EMAIL_PROF ci-dessous par son vrai email
--    et exécute seulement cette commande :
--
-- update public.profiles
-- set role = 'prof', level = ''
-- where lower(email) = lower('TON_EMAIL_PROF');
-- ============================================================
