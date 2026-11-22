-- Rode este script inteiro no SQL Editor do Supabase (menu lateral "SQL Editor" > "New query")

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  price numeric not null,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  product_name text not null,
  qty numeric not null default 1,
  total numeric not null,
  payment text not null,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  description text not null,
  category text not null,
  value numeric not null,
  created_at timestamptz not null default now()
);

alter table products enable row level security;
alter table sales enable row level security;
alter table expenses enable row level security;

create policy "Users manage own products" on products
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own sales" on sales
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users manage own expenses" on expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Configurações gerais do CRM (ex.: dia de corte do ciclo das Vendas Empresa)
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy "Autenticados leem configuracoes" on public.app_settings for select to authenticated using (true);
create policy "Autenticados gravam configuracoes" on public.app_settings for insert to authenticated with check (true);
create policy "Autenticados atualizam configuracoes" on public.app_settings for update to authenticated using (true) with check (true);

-- Autoatendimento por QR Code (/pedido): tabela customers, colunas sales.customer_id/source,
-- products.show_in_qr/sort_order e funções public.qr_* (security definer, liberadas para anon).
-- Aplicado no projeto pela migration "qr_pedidos_clientes" (veja o histórico de migrations no Supabase).

-- Pix no extrato do QR (/pedido): a chave fica em app_settings (key = 'pix') e é
-- configurada no CRM em Clientes & QR → "Pix". A página pública lê só por esta função.
create or replace function public.qr_pix_config()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object(
       'tipo', value->>'tipo',
       'chave', value->>'chave',
       'nome', value->>'nome',
       'cidade', value->>'cidade')
     from public.app_settings
     where key = 'pix' and coalesce(value->>'chave', '') <> ''),
    'null'::jsonb);
$$;
revoke all on function public.qr_pix_config() from public;
grant execute on function public.qr_pix_config() to anon, authenticated;
