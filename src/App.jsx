-- Garante a tabela de produtos
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text,
  price numeric,
  category text
);

-- Garante a tabela de vendas
create table if not exists sales (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  date text,
  product_name text,
  qty numeric,
  total numeric,
  payment text
);

-- Garante a tabela de gastos
create table if not exists expenses (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  date text,
  description text,
  category text,
  value numeric
);

-- Garante a tabela de ingredientes
create table if not exists ingredients (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text,
  package_price numeric,
  package_amount numeric,
  unit text
);

-- Garante a tabela de receitas/fichas técnicas
create table if not exists recipes (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  product_name text,
  ingredients_used jsonb,
  total_cost numeric,
  yield_amount numeric
);

-- Habilita segurança e permissões para todas
alter table products enable row level security;
alter table sales enable row level security;
alter table expenses enable row level security;
alter table ingredients enable row level security;
alter table recipes enable row level security;

create policy "Permitir tudo em products" on products for all to authenticated using (true) with check (true);
create policy "Permitir tudo em sales" on sales for all to authenticated using (true) with check (true);
create policy "Permitir tudo em expenses" on expenses for all to authenticated using (true) with check (true);
create policy "Permitir tudo em ingredients" on ingredients for all to authenticated using (true) with check (true);
create policy "Permitir tudo em recipes" on recipes for all to authenticated using (true) with check (true);
