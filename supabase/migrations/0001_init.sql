-- ============================================================================
-- Kos Management System — Migration 0001: Skema, Trigger, RLS, Storage
-- Jalankan di Supabase SQL Editor. Idempotent (bisa dijalankan ulang).
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. HELPERS (security definer => bebas dari rekursi RLS & aman dipakai policy)
-- ---------------------------------------------------------------------------

create or replace function public.get_my_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.get_my_role() = 'super_admin', false);
$$;

create or replace function public.is_landlord()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.get_my_role() = 'landlord', false);
$$;

create or replace function public.owns_property(p_property_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.is_super_admin(), false)
      or exists (
           select 1 from public.properties p
           where p.id = p_property_id and p.owner_id = auth.uid()
         );
$$;

create or replace function public.owns_any_property()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.is_super_admin(), false)
      or exists (select 1 from public.properties p where p.owner_id = auth.uid());
$$;

-- Tenant aktif milik user yang sedang login (jika ada)
create or replace function public.current_tenant_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select t.id from public.tenants t
  where t.user_id = auth.uid()
  order by t.created_at desc
  limit 1;
$$;

-- ===========================================================================
-- 2. TABEL
-- ===========================================================================

-- ---------- profiles ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'tenant'
              check (role in ('super_admin', 'landlord', 'tenant')),
  full_name   text,
  phone       text,
  email       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Otomatis buat profil saat user mendaftar (role dibaca dari raw_user_meta_data)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email, phone)
  values (
    new.id,
    case
      when coalesce(new.raw_user_meta_data ->> 'role', 'tenant') = 'landlord' then 'landlord'
      when coalesce(new.raw_user_meta_data ->> 'role', 'tenant') = 'super_admin' then 'super_admin'
      else 'tenant'
    end,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- properties (gedung kos; multi-properti per pemilik) ----------
create table if not exists public.properties (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  name        text not null,
  address     text,
  city        text,
  description text,
  image_url   text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- rooms ----------
create table if not exists public.rooms (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties (id) on delete cascade,
  room_number   text not null,
  floor         text,
  room_type     text not null default 'Standar',        -- tipe kamar (bebas, mis. Deluxe/Ekonomi)
  facilities    text[] not null default '{}',           -- ['AC','Kamar Mandi Dalam',...]
  price_monthly numeric(12,2) not null default 0,
  price_daily   numeric(12,2) not null default 0,
  price_yearly  numeric(12,2) not null default 0,
  status        text not null default 'vacant'
                check (status in ('vacant', 'occupied', 'maintenance')),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (property_id, room_number)
);

-- ---------- tenants ----------
create table if not exists public.tenants (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid unique references public.profiles (id) on delete set null,
  full_name               text not null,
  phone                   text,
  email                   text,
  id_card_url             text,                          -- foto KTP di Supabase Storage
  emergency_contact_name  text,
  emergency_contact_phone text,
  address                 text,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------- contracts ----------
create table if not exists public.contracts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants (id) on delete cascade,
  room_id         uuid not null references public.rooms (id) on delete restrict,
  property_id     uuid not null references public.properties (id) on delete cascade,
  start_date      date not null,
  end_date        date,
  due_day         integer not null default 1 check (due_day between 1 and 28),
  billing_cycle   text not null default 'monthly'
                  check (billing_cycle in ('daily', 'monthly', 'yearly')),
  rent_amount     numeric(12,2) not null default 0,       -- snapshot harga sewa saat kontrak dibuat
  deposit_amount  numeric(12,2) not null default 0,
  status          text not null default 'active'
                  check (status in ('active', 'expired', 'terminated')),
  contract_doc_url text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- satu kontrak aktif per kamar
create unique index if not exists one_active_contract_per_room
  on public.contracts (room_id) where status = 'active';

-- ---------- invoices ----------
create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  contract_id    uuid not null references public.contracts (id) on delete cascade,
  tenant_id      uuid not null references public.tenants (id) on delete cascade,
  property_id    uuid not null references public.properties (id) on delete cascade,
  room_id        uuid not null references public.rooms (id) on delete cascade,
  period_label   text not null,                            -- "September 2026"
  period_start   date not null,
  period_end     date not null,
  due_date       date not null,
  base_rent      numeric(12,2) not null default 0,
  status         text not null default 'unpaid'
                 check (status in ('unpaid', 'pending_confirmation', 'paid')),
  proof_url      text,                                     -- path bukti transfer di storage
  paid_at        timestamptz,
  notes          text,
  created_at     timestamptz not null default now()
);

-- idempotensi cron: satu invoice per kontrak per periode
create unique index if not exists one_invoice_per_contract_period
  on public.invoices (contract_id, period_start);

-- ---------- invoice_items (rincian: sewa + listrik/air/denda) ----------
create table if not exists public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete cascade,
  label       text not null,
  kind        text not null default 'rent'
              check (kind in ('rent', 'electricity', 'water', 'penalty', 'other')),
  amount      numeric(12,2) not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- transactions (uang masuk / keluar) ----------
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties (id) on delete cascade,
  type         text not null check (type in ('income', 'expense')),
  category     text not null default 'rent'
               check (category in ('rent', 'electricity', 'water', 'deposit',
                                   'maintenance', 'salary', 'electricity_token', 'other')),
  amount       numeric(12,2) not null default 0 check (amount >= 0),
  description  text,
  txn_date     date not null default current_date,
  invoice_id   uuid references public.invoices (id) on delete set null,
  receipt_url  text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------- tickets (komplain / perbaikan dari penyewa) ----------
create table if not exists public.tickets (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants (id) on delete cascade,
  property_id  uuid not null references public.properties (id) on delete cascade,
  room_id      uuid references public.rooms (id) on delete set null,
  subject      text not null,
  description  text,
  status       text not null default 'open'
               check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority     text not null default 'medium'
               check (priority in ('low', 'medium', 'high')),
  photos       text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

-- ---------- agents (direktori agen sewa pihak ketiga) ----------
create table if not exists public.agents (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references public.profiles (id) on delete cascade,
  property_id      uuid references public.properties (id) on delete set null, -- null = semua properti
  name             text not null,                 -- nama kontak agen
  agency_name      text,                          -- Mamikos / Infokost / agen lokal ...
  channel          text not null default 'whatsapp'
                   check (channel in ('whatsapp', 'email', 'phone', 'other')),
  contact          text not null,                 -- nomor WA / email / telepon
  commission_type  text not null default 'percent'
                   check (commission_type in ('percent', 'flat')),
  commission_value numeric(12,2) not null default 0,
  notes            text,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------- notifications (notifikasi in-app) ----------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null default 'system'
             check (type in ('system', 'payment_overdue', 'contract_expiring',
                             'new_ticket', 'ticket_update', 'invoice_created',
                             'payment_confirmed')),
  title      text not null,
  body       text,
  is_read    boolean not null default false,
  link       text,
  created_at timestamptz not null default now()
);

-- ---------- updated_at trigger umum ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','properties','rooms','tenants','contracts',
                          'tickets','agents']
  loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I', t);
    execute format('create trigger trg_set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------- index pendukung ----------
create index if not exists idx_properties_owner      on public.properties (owner_id);
create index if not exists idx_rooms_property        on public.rooms (property_id, status);
create index if not exists idx_tenants_user          on public.tenants (user_id);
create index if not exists idx_contracts_tenant      on public.contracts (tenant_id);
create index if not exists idx_contracts_property    on public.contracts (property_id, status);
create index if not exists idx_invoices_property     on public.invoices (property_id, status, due_date);
create index if not exists idx_items_invoice         on public.invoice_items (invoice_id);
create index if not exists idx_tx_property_date      on public.transactions (property_id, txn_date);
create index if not exists idx_tickets_property      on public.tickets (property_id, status);
create index if not exists idx_agents_owner          on public.agents (owner_id);
create index if not exists idx_notif_user            on public.notifications (user_id, is_read);

-- ===========================================================================
-- 3. ROW LEVEL SECURITY
-- ===========================================================================

alter table public.profiles      enable row level security;
alter table public.properties    enable row level security;
alter table public.rooms         enable row level security;
alter table public.tenants       enable row level security;
alter table public.contracts     enable row level security;
alter table public.invoices      enable row level security;
alter table public.invoice_items enable row level security;
alter table public.transactions  enable row level security;
alter table public.tickets       enable row level security;
alter table public.agents        enable row level security;
alter table public.notifications enable row level security;

-- ---------- profiles ----------
create policy profiles_select_own_or_admin on public.profiles
  for select using (id = auth.uid() or public.is_super_admin());
create policy profiles_update_own_no_role on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = public.get_my_role()); -- cegah eskalasi role sendiri
create policy profiles_update_admin on public.profiles
  for update using (public.is_super_admin()) with check (public.is_super_admin());
-- insert: hanya via trigger handle_new_user / service role (tanpa policy).

-- ---------- properties ----------
create policy properties_select on public.properties
  for select using (owner_id = auth.uid() or public.is_super_admin());
create policy properties_insert on public.properties
  for insert with check ((owner_id = auth.uid() and public.is_landlord()) or public.is_super_admin());
create policy properties_update on public.properties
  for update using (owner_id = auth.uid() or public.is_super_admin())
  with check (owner_id = auth.uid() or public.is_super_admin());
create policy properties_delete on public.properties
  for delete using (owner_id = auth.uid() or public.is_super_admin());

-- ---------- rooms ----------
create policy rooms_select_owner on public.rooms
  for select using (public.owns_property(property_id));
create policy rooms_select_tenant on public.rooms
  for select using (public.current_tenant_id() is not null
    and exists (select 1 from public.contracts c
                where c.room_id = rooms.id and c.status = 'active'
                  and c.tenant_id = public.current_tenant_id()));
create policy rooms_insert on public.rooms
  for insert with check (public.owns_property(property_id));
create policy rooms_update on public.rooms
  for update using (public.owns_property(property_id))
  with check (public.owns_property(property_id));
create policy rooms_delete on public.rooms
  for delete using (public.owns_property(property_id));

-- ---------- tenants ----------
-- Pemilik kos boleh kelola penyewa bila memiliki >= 1 properti (pragmatis tahap 1;
-- pengikatan penyewa-ke-properti terjadi lewat kontrak).
create policy tenants_select_owner on public.tenants
  for select using (public.owns_any_property());
create policy tenants_select_self on public.tenants
  for select using (user_id = auth.uid());
create policy tenants_insert_owner on public.tenants
  for insert with check (public.owns_any_property());
create policy tenants_update_owner on public.tenants
  for update using (public.owns_any_property())
  with check (public.owns_any_property());
create policy tenants_delete_owner on public.tenants
  for delete using (public.owns_any_property());

-- ---------- contracts ----------
create policy contracts_select_owner on public.contracts
  for select using (public.owns_property(property_id));
create policy contracts_select_tenant on public.contracts
  for select using (tenant_id = public.current_tenant_id());
create policy contracts_insert on public.contracts
  for insert with check (public.owns_property(property_id));
create policy contracts_update on public.contracts
  for update using (public.owns_property(property_id))
  with check (public.owns_property(property_id));
create policy contracts_delete on public.contracts
  for delete using (public.owns_property(property_id));

-- ---------- invoices ----------
create policy invoices_select_owner on public.invoices
  for select using (public.owns_property(property_id));
create policy invoices_select_tenant on public.invoices
  for select using (tenant_id = public.current_tenant_id());
create policy invoices_insert on public.invoices
  for insert with check (public.owns_property(property_id));
create policy invoices_update_owner on public.invoices
  for update using (public.owns_property(property_id))
  with check (public.owns_property(property_id));
create policy invoices_delete on public.invoices
  for delete using (public.owns_property(property_id));
-- Penyewa TIDAK update invoice langsung (cegah ubah status sendiri).
-- Upload bukti transfer lewat RPC confirm_payment di bawah.

-- RPC aman: penyewa mengunggah bukti -> status unpaid -> pending_confirmation
create or replace function public.confirm_payment(p_invoice_id uuid, p_proof_path text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid := public.current_tenant_id();
begin
  update public.invoices
     set proof_url = p_proof_path,
         status    = 'pending_confirmation'
   where id = p_invoice_id
     and tenant_id = v_tenant
     and status = 'unpaid';
  return found;
end;
$$;

-- ---------- invoice_items ----------
create policy items_select_owner on public.invoice_items
  for select using (
    exists (select 1 from public.invoices i where i.id = invoice_id
            and public.owns_property(i.property_id))
  );
create policy items_select_tenant on public.invoice_items
  for select using (
    exists (select 1 from public.invoices i
            where i.id = invoice_id and i.tenant_id = public.current_tenant_id())
  );
create policy items_insert on public.invoice_items
  for insert with check (
    exists (select 1 from public.invoices i
            where i.id = invoice_id and public.owns_property(i.property_id))
  );
create policy items_update on public.invoice_items
  for update using (
    exists (select 1 from public.invoices i
            where i.id = invoice_id and public.owns_property(i.property_id))
  ) with check (
    exists (select 1 from public.invoices i
            where i.id = invoice_id and public.owns_property(i.property_id))
  );
create policy items_delete on public.invoice_items
  for delete using (
    exists (select 1 from public.invoices i
            where i.id = invoice_id and public.owns_property(i.property_id))
  );

-- ---------- transactions ----------
create policy tx_select on public.transactions
  for select using (public.owns_property(property_id));
create policy tx_insert on public.transactions
  for insert with check (public.owns_property(property_id));
create policy tx_update on public.transactions
  for update using (public.owns_property(property_id))
  with check (public.owns_property(property_id));
create policy tx_delete on public.transactions
  for delete using (public.owns_property(property_id));

-- ---------- tickets ----------
create policy tickets_select_owner on public.tickets
  for select using (public.owns_property(property_id));
create policy tickets_select_tenant on public.tickets
  for select using (tenant_id = public.current_tenant_id());
create policy tickets_insert_tenant on public.tickets
  for insert with check (tenant_id = public.current_tenant_id());
create policy tickets_insert_owner on public.tickets
  for insert with check (public.owns_property(property_id));
create policy tickets_update_owner on public.tickets
  for update using (public.owns_property(property_id))
  with check (public.owns_property(property_id));
create policy tickets_delete_owner on public.tickets
  for delete using (public.owns_property(property_id));

-- ---------- agents ----------
create policy agents_select_owner on public.agents
  for select using (owner_id = auth.uid() or public.is_super_admin());
create policy agents_insert on public.agents
  for insert with check ((owner_id = auth.uid() and public.is_landlord())
                         or public.is_super_admin());
create policy agents_update on public.agents
  for update using (owner_id = auth.uid() or public.is_super_admin())
  with check (owner_id = auth.uid() or public.is_super_admin());
create policy agents_delete on public.agents
  for delete using (owner_id = auth.uid() or public.is_super_admin());

-- ---------- notifications ----------
create policy notif_select on public.notifications
  for select using (user_id = auth.uid());
create policy notif_update_own on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- 4. STORAGE BUCKETS + POLICIES
--    property-images : public (foto properti)
--    tenant-docs     : private (KTP, dokumen kontrak)  -> folder  <user_id>/...
--    payment-proofs  : private (bukti transfer)        -> folder  <user_id>/...
--    ticket-photos   : private (foto komplain)         -> folder  <user_id>/...
-- ===========================================================================

insert into storage.buckets (id, name, public)
values
  ('property-images', 'property-images', true),
  ('tenant-docs',     'tenant-docs',     false),
  ('payment-proofs',  'payment-proofs',  false),
  ('ticket-photos',   'ticket-photos',   false)
on conflict (id) do nothing;

-- Pemilik kos bisa baca dokumen/bukti penyewa mana pun yang tinggal di propertinya
create or replace function public.can_read_tenant_file(p_path text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin()
      or exists (
           select 1
           from public.tenants t
           join public.contracts c on c.tenant_id = t.id
           join public.properties pr on pr.id = c.property_id
           where pr.owner_id = auth.uid()
             and t.user_id::text = coalesce((storage.foldername(p_path))[1], '')
         );
$$;

-- property-images: siapa pun boleh lihat; landlord upload
create policy storage_prop_images_read on storage.objects
  for select using (bucket_id = 'property-images');
create policy storage_prop_images_insert on storage.objects
  for insert with check (
    bucket_id = 'property-images'
    and coalesce((storage.foldername(name))[1], '') = 'properties'
    and public.is_landlord()
  );

-- tenant-docs
create policy storage_docs_read on storage.objects
  for select using (
    bucket_id = 'tenant-docs'
    and (coalesce((storage.foldername(name))[1], '') = auth.uid()::text
         or public.can_read_tenant_file(name))
  );
create policy storage_docs_insert on storage.objects
  for insert with check (
    bucket_id = 'tenant-docs'
    and coalesce((storage.foldername(name))[1], '') = auth.uid()::text
    and public.current_tenant_id() is not null
  );

-- payment-proofs
create policy storage_proofs_read on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (coalesce((storage.foldername(name))[1], '') = auth.uid()::text
         or public.can_read_tenant_file(name))
  );
create policy storage_proofs_insert on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and coalesce((storage.foldername(name))[1], '') = auth.uid()::text
    and public.current_tenant_id() is not null
  );

-- ticket-photos
create policy storage_ticket_photos_read on storage.objects
  for select using (
    bucket_id = 'ticket-photos'
    and (coalesce((storage.foldername(name))[1], '') = auth.uid()::text
         or public.can_read_tenant_file(name))
  );
create policy storage_ticket_photos_insert on storage.objects
  for insert with check (
    bucket_id = 'ticket-photos'
    and coalesce((storage.foldername(name))[1], '') = auth.uid()::text
    and public.current_tenant_id() is not null
  );
