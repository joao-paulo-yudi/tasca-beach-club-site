-- Tasca Beach Club · banco de reservas (Supabase, plano gratuito)
-- Cole este arquivo inteiro em Supabase > SQL Editor > New query > Run.
-- Pode rodar de novo sem problema: ele recria funções e políticas.

create extension if not exists pgcrypto;

-- 1. Configuração do clube (uma linha só). O painel /admin edita isto.
create table if not exists public.config (
  id int primary key default 1 check (id = 1),
  preco_hora numeric(10,2) not null default 90,
  quadras int not null default 6 check (quadras between 1 and 20),
  -- horários por dia da semana: 0 = domingo ... 6 = sábado. [abre, fecha] em horas cheias; null = fechado
  horarios jsonb not null default '{"0":null,"1":[16,23],"2":[16,22],"3":[16,22],"4":[16,22],"5":[16,22],"6":[8,22]}',
  dias_antecedencia int not null default 14,
  atualizado_em timestamptz not null default now()
);
insert into public.config (id) values (1) on conflict (id) do nothing;

-- 2. Reservas
create table if not exists public.reservas (
  id uuid primary key default gen_random_uuid(),
  quadra int not null check (quadra >= 1),
  data date not null,
  hora int not null check (hora between 0 and 23),
  esporte text not null default 'volei' check (esporte in ('volei','beach-tennis','futevolei','bloqueio')),
  nome text not null default '',
  telefone text not null default '',
  status text not null default 'pendente' check (status in ('pendente','confirmada','cancelada','bloqueio')),
  grupo uuid,                -- várias horas seguidas da mesma reserva
  obs text not null default '',
  criado_em timestamptz not null default now()
);

-- Nunca duas reservas ativas no mesmo horário e quadra
create unique index if not exists reservas_sem_conflito
  on public.reservas (quadra, data, hora)
  where status in ('pendente','confirmada','bloqueio');
create index if not exists reservas_por_data on public.reservas (data);

-- 3. Segurança: o público não lê nem escreve a tabela direto.
alter table public.reservas enable row level security;
alter table public.config   enable row level security;

drop policy if exists "admin le reservas"   on public.reservas;
drop policy if exists "admin altera reservas" on public.reservas;
drop policy if exists "admin insere reservas" on public.reservas;
drop policy if exists "admin apaga reservas" on public.reservas;
drop policy if exists "todos leem config"   on public.config;
drop policy if exists "admin altera config" on public.config;

create policy "admin le reservas"     on public.reservas for select to authenticated using (true);
create policy "admin altera reservas" on public.reservas for update to authenticated using (true) with check (true);
create policy "admin insere reservas" on public.reservas for insert to authenticated with check (true);
create policy "admin apaga reservas"  on public.reservas for delete to authenticated using (true);
create policy "todos leem config"     on public.config for select to anon, authenticated using (true);
create policy "admin altera config"   on public.config for update to authenticated using (true) with check (true);

-- 4. O que o site público pode fazer, via funções controladas:

-- 4a. Ver horários ocupados de um dia (sem nomes nem telefones)
create or replace function public.horarios_ocupados(d date)
returns table (quadra int, hora int)
language sql stable security definer set search_path = public as $$
  select quadra, hora from public.reservas
  where data = d and status in ('pendente','confirmada','bloqueio');
$$;

-- 4b. Pedir uma reserva (uma ou mais horas seguidas, mesma quadra)
create or replace function public.reservar(
  p_quadra int, p_data date, p_horas int[], p_esporte text, p_nome text, p_telefone text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c public.config;
  faixa jsonb;
  h int;
  g uuid := gen_random_uuid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  agora int := extract(hour from (now() at time zone 'America/Sao_Paulo'))::int;
  tel text := regexp_replace(coalesce(p_telefone,''), '\D', '', 'g');
begin
  select * into c from public.config where id = 1;
  if p_quadra < 1 or p_quadra > c.quadras then raise exception 'Quadra inválida'; end if;
  if p_data < hoje or p_data > hoje + c.dias_antecedencia then raise exception 'Data fora do período de reservas'; end if;
  if p_esporte not in ('volei','beach-tennis','futevolei') then raise exception 'Esporte inválido'; end if;
  if length(trim(coalesce(p_nome,''))) < 2 then raise exception 'Informe seu nome'; end if;
  if length(tel) < 10 or length(tel) > 13 then raise exception 'WhatsApp inválido'; end if;
  if p_horas is null or array_length(p_horas,1) is null or array_length(p_horas,1) > 4 then raise exception 'Escolha de 1 a 4 horários'; end if;
  -- no máximo 3 pedidos pendentes por telefone (anti-spam)
  if (select count(distinct grupo) from public.reservas where telefone = tel and status = 'pendente' and data >= hoje) >= 3 then
    raise exception 'Você já tem pedidos pendentes. Fale com o clube pelo WhatsApp.';
  end if;
  faixa := c.horarios -> extract(dow from p_data)::int::text;
  if faixa is null or faixa = 'null'::jsonb then raise exception 'O clube não abre neste dia'; end if;
  foreach h in array p_horas loop
    if h < (faixa->>0)::int or h >= (faixa->>1)::int then raise exception 'Horário fora do funcionamento'; end if;
    if p_data = hoje and h <= agora then raise exception 'Esse horário já passou'; end if;
    insert into public.reservas (quadra, data, hora, esporte, nome, telefone, status, grupo)
    values (p_quadra, p_data, h, p_esporte, left(trim(p_nome), 80), tel, 'pendente', g);
  end loop;
  return g;
exception when unique_violation then
  raise exception 'Alguém acabou de reservar esse horário. Escolha outro.';
end $$;

revoke all on function public.horarios_ocupados(date) from public;
revoke all on function public.reservar(int, date, int[], text, text, text) from public;
grant execute on function public.horarios_ocupados(date) to anon, authenticated;
grant execute on function public.reservar(int, date, int[], text, text, text) to anon, authenticated;
