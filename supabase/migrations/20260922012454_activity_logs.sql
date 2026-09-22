-- ============================================================================
-- Kos Management System — Migration: activity_logs (Audit Log Sistem)
-- Dibuat manual (lokal, tanpa Supabase CLI). BELUM di-apply ke remote Supabase.
-- Idempotent (bisa dijalankan ulang).
-- ============================================================================

-- ---------- activity_logs (Audit Log Sistem; append-only) ----------
create table if not exists public.activity_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles (id) on delete set null,
  action        text not null,
  entity_type   text not null,
  entity_id     uuid,
  property_id   uuid references public.properties (id) on delete set null,
  description   text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- Indexes untuk query & filter
create index if not exists idx_activity_logs_created_at on public.activity_logs (created_at desc);
create index if not exists idx_activity_logs_actor      on public.activity_logs (actor_user_id);
create index if not exists idx_activity_logs_entity     on public.activity_logs (entity_type, entity_id);
create index if not exists idx_activity_logs_property   on public.activity_logs (property_id);

-- RLS (append-only: hanya SELECT dan INSERT; tanpa policy UPDATE/DELETE)
alter table public.activity_logs enable row level security;

-- Select:
-- - Super Admin: dapat membaca seluruh log.
-- - Landlord: hanya log pada properti miliknya, atau log miliknya sendiri
--   ketika property_id NULL.
-- - Tenant: tidak ada cabang policy yang cocok => tidak dapat membaca.
create policy activity_logs_select on public.activity_logs
  for select using (
    public.is_super_admin()
    or (
      public.is_landlord()
      and (
        (property_id is not null and public.owns_property(property_id))
        or (property_id is null and actor_user_id = auth.uid())
      )
    )
  );

-- Insert:
-- Hanya user terautentikasi yang mencatat log atas nama dirinya sendiri
-- (actor_user_id wajib = auth.uid()), konsisten dgn pola server action yang
-- mengambil actor dari sesi. Tidak ada jalur bypass tambahan.
create policy activity_logs_insert on public.activity_logs
  for insert with check (
    auth.uid() is not null
    and actor_user_id = auth.uid()
  );

-- Catatan: TIDAK ADA policy UPDATE atau DELETE.
-- Tabel activity_logs bersifat append-only (immutable audit trail).
