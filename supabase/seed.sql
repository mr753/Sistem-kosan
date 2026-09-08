-- ============================================================================
-- Kos Management System — Seed Data Contoh
-- SYARAT: jalankan SETELAH Anda mendaftarkan akun Pemilik Kos (role=landlord)
-- lewat aplikasi. Data ini menempel ke pemilik pertama yang ditemukan.
-- Aman dijalankan ulang? Tidak 100% idempotent; cukup jalankan sekali.
-- ============================================================================

do $$
declare
  v_owner    uuid;
  v_prop     uuid;
  v_room_a   uuid;
  v_room_b   uuid;
  v_room_c   uuid;
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_period_start date := date_trunc('month', now())::date;
  v_period_end   date := (date_trunc('month', now()) + interval '1 month - 1 day')::date;
  v_due          date := make_date(extract(year from now())::int,
                                   extract(month from now())::int, 5);
  i int;
begin
  -- 1. Pemilik: profil landlord pertama
  select id into v_owner from public.profiles
   where role = 'landlord' order by created_at limit 1;
  if v_owner is null then
    raise exception 'Tidak ada akun landlord. Daftar dulu lewat aplikasi dengan role Pemilik Kos.';
  end if;

  -- 2. Properti + kamar
  insert into public.properties (owner_id, name, address, city, description)
  values (v_owner, 'Kos Melati Putih', 'Jl. Melati No. 12, Condongcatur', 'Yogyakarta',
          'Kos eksklusif dekat kampus. CCTV, wifi, dan akses 24 jam.')
  returning id into v_prop;

  insert into public.rooms (property_id, room_number, floor, room_type, facilities,
                            price_monthly, price_daily, price_yearly, status, notes)
  values
    (v_prop, 'K01', 'Lantai 1', 'Deluxe',
     array['AC', 'Kamar Mandi Dalam', 'Wifi', 'Kasur', 'Lemari'],
     1500000, 75000, 16000000, 'occupied', 'Penyewa lama, perpanjang bulan depan')
  returning id into v_room_a;

  insert into public.rooms (property_id, room_number, floor, room_type, facilities,
                            price_monthly, price_daily, price_yearly, status)
  values
    (v_prop, 'K02', 'Lantai 1', 'Standar',
     array['Kipas Angin', 'Kamar Mandi Luar', 'Wifi'],
     900000, 50000, 9500000, 'occupied')
  returning id into v_room_b;

  insert into public.rooms (property_id, room_number, floor, room_type, facilities,
                            price_monthly, price_daily, price_yearly, status)
  values
    (v_prop, 'K03', 'Lantai 1', 'Standar',
     array['Kipas Angin', 'Kamar Mandi Luar'],
     900000, 50000, 9500000, 'maintenance')
  returning id into v_room_c;

  for i in 4..10 loop
    insert into public.rooms (property_id, room_number, floor, room_type, facilities,
                              price_monthly, price_daily, price_yearly, status)
    values (v_prop, 'K' || lpad(i::text, 2, '0'),
            case when i <= 5 then 'Lantai 1' else 'Lantai 2' end,
            case when i in (6, 7) then 'Deluxe' else 'Standar' end,
            case when i in (6, 7) then array['AC','Kamar Mandi Dalam','Wifi','Kasur','Lemari']
                 else array['Kipas Angin','Kamar Mandi Luar'] end,
            case when i in (6, 7) then 1500000 else 900000 end,
            case when i in (6, 7) then 75000 else 50000 end,
            case when i in (6, 7) then 16000000 else 9500000 end,
            'vacant');
  end loop;

  -- 3. Penyewa + kontrak aktif
  insert into public.tenants (full_name, phone, email, emergency_contact_name,
                              emergency_contact_phone, address)
  values ('Andi Saputra', '0812-3456-7801', 'andi@example.com', 'Ibu Sari (ibu kandung)',
          '0812-1111-2222', 'Jl. Kenanga No. 3, Yogyakarta')
  returning id into v_tenant_a;

  insert into public.tenants (full_name, phone, email, emergency_contact_name,
                              emergency_contact_phone, address)
  values ('Budi Hartono', '0812-3456-7802', 'budi@example.com', 'Pak Joko (ayah)',
          '0812-3333-4444', 'Jl. Mawar No. 9, Sleman')
  returning id into v_tenant_b;

  insert into public.contracts (tenant_id, room_id, property_id, start_date, end_date,
                                due_day, billing_cycle, rent_amount, deposit_amount, status)
  values (v_tenant_a, v_room_a, v_prop, '2025-10-01', '2026-09-30',
          5, 'monthly', 1500000, 1500000, 'active');

  insert into public.contracts (tenant_id, room_id, property_id, start_date, end_date,
                                due_day, billing_cycle, rent_amount, deposit_amount, status)
  values (v_tenant_b, v_room_b, v_prop, '2026-01-15', '2026-12-31',
          5, 'monthly', 900000, 900000, 'active');

  -- 4. Invoice bulan berjalan: A lunas, B masih unpaid (contoh status berbeda)
  insert into public.invoices (contract_id, tenant_id, property_id, room_id, period_label,
                               period_start, period_end, due_date, base_rent, status)
  values
    ((select id from public.contracts where room_id = v_room_a and status = 'active'),
     v_tenant_a, v_prop, v_room_a, to_char(now(), 'FMMonth YYYY'),
     v_period_start, v_period_end, v_due, 1500000, 'paid');

  insert into public.invoices (contract_id, tenant_id, property_id, room_id, period_label,
                               period_start, period_end, due_date, base_rent, status, notes)
  values
    ((select id from public.contracts where room_id = v_room_b and status = 'active'),
     v_tenant_b, v_prop, v_room_b, to_char(now(), 'FMMonth YYYY'),
     v_period_start, v_period_end, v_due, 900000, 'unpaid', 'Sudah diingatkan via WA.');

  -- Rincian item invoice (sewa + biaya listrik contoh)
  insert into public.invoice_items (invoice_id, label, kind, amount)
  select id, 'Sewa bulanan', 'rent', base_rent from public.invoices
   where period_start = v_period_start and property_id = v_prop;

  -- 5. Transaksi keuangan 3 bulan terakhir (contoh untuk grafik)
  insert into public.transactions (property_id, type, category, amount, description, txn_date, created_by)
  values
    (v_prop, 'income', 'rent', 2400000, 'Pembayaran sewa K01 + K02', now() - interval '2 months', v_owner),
    (v_prop, 'income', 'electricity', 350000, 'Biaya listrik bersama (token bulanan penyewa)', now() - interval '2 months', v_owner),
    (v_prop, 'expense', 'maintenance', 250000, 'Perbaikan kran kamar mandi K03', now() - interval '2 months', v_owner),
    (v_prop, 'expense', 'salary', 500000, 'Gaji penjaga kos', now() - interval '2 months', v_owner),
    (v_prop, 'income', 'rent', 2400000, 'Pembayaran sewa K01 + K02', now() - interval '1 month', v_owner),
    (v_prop, 'income', 'water', 150000, 'Tagihan air bersama', now() - interval '1 month', v_owner),
    (v_prop, 'expense', 'electricity_token', 1200000, 'Token listrik utama', now() - interval '1 month', v_owner),
    (v_prop, 'expense', 'maintenance', 700000, 'Servis AC K01', now() - interval '1 month', v_owner),
    (v_prop, 'income', 'rent', 1500000, 'Pembayaran sewa K01 (Andi)', now(), v_owner),
    (v_prop, 'expense', 'electricity_token', 600000, 'Token listrik utama', now(), v_owner);

  -- 6. Direktori agen sewa (contoh)
  insert into public.agents (owner_id, property_id, name, agency_name, channel, contact,
                             commission_type, commission_value, notes, is_active)
  values
    (v_owner, v_prop, 'Pak Rudi', 'Mamikos', 'whatsapp', '0812-9999-0001',
     'percent', 5, 'Agen andalan area Condongcatur. Kirim update tiap kamar kosong.', true),
    (v_owner, null, 'Bu Dewi', 'Infokost', 'email', 'dewi@infokost.example',
     'flat', 100000, 'Komisi flat per penyewa berhasil.', true),
    (v_owner, null, 'Mas Doni', 'Agen Lokal', 'whatsapp', '0812-9999-0002',
     'percent', 3, 'Fokus kos mahasiswa. Kontak cepat.', true);

  raise notice 'Seed selesai untuk pemilik %', v_owner;
end;
$$;
