-- Bu SQL'i Supabase projenizde "SQL Editor" sekmesinden, olduğu gibi kopyala-yapıştır çalıştırın.

create table if not exists kv_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Herkesin (şirket içi, tek uygulama) okuyup yazabilmesi için basit bir erişim politikası.
-- İleride kullanıcı girişi (login) eklendiğinde bu politika daraltılabilir.
alter table kv_store enable row level security;

create policy "herkes okuyabilir" on kv_store
  for select using (true);

create policy "herkes yazabilir" on kv_store
  for insert with check (true);

create policy "herkes guncelleyebilir" on kv_store
  for update using (true);
