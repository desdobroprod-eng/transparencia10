-- Piloto de fiscalização cidadã (projeto Supabase "transparencia-cultural",
-- ref lnjtrjrfnhpdfempfxjy, sa-east-1). Aplicada em 27/10/2026.
-- Cidadão só ENVIA (fica pendente); público só LÊ o aprovado, sem e-mail;
-- moderação via Edge Function `moderacao` com service role.

create table public.visitas (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  local_id text not null check (char_length(local_id) between 1 and 120),
  local_nome text not null check (char_length(local_nome) between 1 and 300),
  situacao text not null check (situacao in ('em_andamento','concluida','parada','nao_encontrada','outro')),
  comentario text not null default '' check (char_length(comentario) <= 1500),
  nome text not null check (char_length(trim(nome)) between 2 and 120),
  email text not null check (char_length(email) <= 200 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  foto_envio text check (foto_envio is null or foto_envio ~ '^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'),
  foto_publica text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  consentimento boolean not null check (consentimento),
  status text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
  moderado_em timestamptz,
  motivo_recusa text
);
create index visitas_status_idx on public.visitas (status, criado_em desc);
create index visitas_local_idx on public.visitas (local_id);

alter table public.visitas enable row level security;
revoke all on public.visitas from anon, authenticated;
grant insert on public.visitas to anon, authenticated;

create policy "cidadao envia visita pendente"
  on public.visitas for insert to anon, authenticated
  with check (status = 'pendente' and foto_publica is null
              and moderado_em is null and motivo_recusa is null);

-- Leitura pública só do aprovado, sem e-mail e só com o primeiro nome.
-- SECURITY DEFINER de propósito (o aviso do linter do Supabase é esperado).
create or replace function public.visitas_aprovadas()
returns table (id uuid, criado_em timestamptz, local_id text, local_nome text,
               situacao text, comentario text, autor text, foto_publica text)
language sql stable security definer set search_path = ''
as $$
  select v.id, v.criado_em, v.local_id, v.local_nome, v.situacao, v.comentario,
         split_part(trim(v.nome), ' ', 1), v.foto_publica
  from public.visitas v
  where v.status = 'aprovado'
  order by v.criado_em desc
  limit 1000
$$;
revoke all on function public.visitas_aprovadas() from public;
grant execute on function public.visitas_aprovadas() to anon, authenticated;

-- Hash SHA-256 da senha de moderação (lido só pela Edge Function). Sem policy
-- de propósito: inacessível pela API pública. O valor NÃO é versionado.
create table public.moderacao_config (
  id int primary key default 1 check (id = 1),
  senha_hash text not null
);
alter table public.moderacao_config enable row level security;
revoke all on public.moderacao_config from anon, authenticated;

-- Fotos: 'envios' privado (cidadão só sobe), 'publicadas' público (só aprovadas).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('envios', 'envios', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('publicadas', 'publicadas', true, 5242880, array['image/jpeg','image/png','image/webp']);

create policy "cidadao envia foto"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'envios'
              and name ~ '^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$');
