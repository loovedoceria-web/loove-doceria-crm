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
