-- NEXTLI · Inventario compartido (precios, imágenes, agotados)
-- Ejecutar una sola vez en Supabase → SQL Editor. Solo crea objetos nuevos (prefijo nextli_inventory).

create table if not exists public.nextli_inventory (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.nextli_inventory enable row level security;
drop policy if exists "inventory public read" on public.nextli_inventory;
create policy "inventory public read" on public.nextli_inventory for select to anon, authenticated using (true);
-- Sin políticas de insert/update/delete: solo se escribe con nextli_inventory_save().

create table if not exists public.nextli_inventory_secret (id text primary key, pw_hash text not null);
alter table public.nextli_inventory_secret enable row level security;

create table if not exists public.nextli_inventory_attempts (id bigserial primary key, at timestamptz not null default now());
alter table public.nextli_inventory_attempts enable row level security;

insert into public.nextli_inventory (id, data) values ('main', '{}'::jsonb) on conflict (id) do nothing;
insert into public.nextli_inventory_secret (id, pw_hash) values ('main', '3f24d105850f2836830cd6cb5670643956b2005f903e9ff8616913791c459b32')
on conflict (id) do update set pw_hash = excluded.pw_hash;

create or replace function public.nextli_inventory_auth(p_pw text)
returns boolean language plpgsql security definer set search_path = public as $$
declare ok boolean; fails int;
begin
  select count(*) into fails from public.nextli_inventory_attempts where at > now() - interval '10 minutes';
  if fails >= 8 then raise exception 'too_many_attempts'; end if;
  select (pw_hash = encode(sha256(convert_to(coalesce(p_pw,''), 'utf8')), 'hex')) into ok
    from public.nextli_inventory_secret where id = 'main';
  if coalesce(ok, false) then
    delete from public.nextli_inventory_attempts;
    return true;
  end if;
  insert into public.nextli_inventory_attempts default values;
  delete from public.nextli_inventory_attempts where at < now() - interval '1 day';
  return false;
end $$;

create or replace function public.nextli_inventory_check(p_pw text)
returns boolean language sql security definer set search_path = public as $$
  select public.nextli_inventory_auth(p_pw);
$$;

create or replace function public.nextli_inventory_save(p_pw text, p_data jsonb)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare ts timestamptz := now();
begin
  if not public.nextli_inventory_auth(p_pw) then raise exception 'unauthorized'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'invalid_data'; end if;
  if pg_column_size(p_data) > 4000000 then raise exception 'too_large'; end if;
  insert into public.nextli_inventory (id, data, updated_at) values ('main', p_data, ts)
  on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at;
  return ts;
end $$;

revoke all on function public.nextli_inventory_auth(text) from public, anon, authenticated;
revoke all on function public.nextli_inventory_check(text) from public;
revoke all on function public.nextli_inventory_save(text, jsonb) from public;
grant execute on function public.nextli_inventory_check(text) to anon, authenticated;
grant execute on function public.nextli_inventory_save(text, jsonb) to anon, authenticated;
