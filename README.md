# Kos Management System (Multi-Tenant)

Aplikasi web manajemen kos **modern, responsive, zero-cost stack** — tanpa biaya server maupun database untuk skala kecil–menengah. Dibangun dengan **Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (PostgreSQL, Auth, Storage)**.

3 level pengguna:

| Role | Deskripsi |
| --- | --- |
| `super_admin` | Pemilik platform: memantau seluruh properti & pengguna lintas landlord. |
| `landlord` | Pemilik/pengelola kos: properti, kamar, penyewa, kontrak, invoice, keuangan, agen sewa. |
| `tenant` | Penyewa: portal kamar & kontrak, tagihan + upload bukti transfer, tiket komplain/perbaikan. |

---

## 1. Teknologi & Keputusan Arsitektur

| Kebutuhan | Pilihan | Alasan |
| --- | --- | --- |
| Frontend + API | Next.js 15 (App Router) + TypeScript | SSR/Server Components, gratis deploy di Vercel. RSC menekan biaya query & menjaga logika data di server. |
| Styling | Tailwind CSS + shadcn/ui + Lucide | Cepat, konsisten, komponen ringan. |
| Database | Supabase PostgreSQL (free tier) | 500 MB DB, Auth 50k MAU, 1 GB Storage — cukup untuk skala kecil-menengah. |
| ORM / client | **supabase-js + Row Level Security (RLS)** | Dipilih **daripada Prisma** karena: (1) RLS menjadi lapisan keamanan di database itu sendiri, (2) tanpa connection pooler/edge issue di serverless gratis, (3) realtime siap pakai. Prisma tetap bisa ditambahkan kemudian untuk migrasi/migrasi lokal bila diperlukan. |
| Grafik | Recharts | Ringan, gratis, populer. |
| Auth | Supabase Auth (email/password) | Gratis sampai 50.000 MAU; profil & role disimpan di tabel `profiles` (trigger saat user baru mendaftar). |
| File | Supabase Storage | Bukti transfer, foto KTP, foto komplain, dokumen kontrak. |
| Payment | **Tidak ada payment gateway** | Sesuai permintaan: invoicing manual + verifikasi bukti transfer oleh pemilik. |

**Prinsip keamanan:** semua akses data melewati **RLS** — pemilik hanya melihat properti/kamar/penyewa/invoice miliknya (`owner_id`), penyewa hanya melihat data dirinya sendiri, `super_admin` melihat semua. Server Components memakai `@supabase/ssr` (cookie session); tidak ada service-role key yang bocor ke browser.

---

## 2. Struktur Proyek

```
kos-management/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx              # Login (email/password)
│   │   └── register/page.tsx           # Daftar (pilih peran: Pemilik Kos / Penyewa)
│   ├── (dashboard)/                    # Area aplikasi setelah login
│   │   ├── layout.tsx                  # Shell: sidebar role-based + header (mobile friendly)
│   │   ├── dashboard/page.tsx          # [DONE] Dashboard pemilik
│   │   ├── agents/page.tsx             # [DONE] Direktori Agen Sewa + Broadcast
│   │   ├── agents/actions.ts           # Server Actions CRUD agen
│   │   ├── properties/page.tsx         # [stub] Manajemen multi-properti
│   │   ├── rooms/page.tsx              # [stub] Inventaris kamar + status
│   │   ├── tenants/page.tsx            # [stub] Database penyewa
│   │   ├── contracts/page.tsx          # [stub] Kontrak sewa digital
│   │   ├── invoices/page.tsx           # [stub] Invoice & verifikasi pembayaran
│   │   ├── transactions/page.tsx       # [stub] Riwayat uang masuk/keluar
│   │   ├── tickets/page.tsx            # [stub] Komplain/perbaikan
│   │   └── settings/page.tsx           # [stub] Pengaturan profil
│   ├── portal/page.tsx                 # [stub] Portal penyewa (kamar, tagihan, tiket)
│   ├── api/cron/invoices/route.ts      # [stub] Endpoint invoice otomatis (cron)
│   ├── auth/callback/route.ts          # Pertukaran kode OAuth/email confirmation
│   ├── layout.tsx                      # Root layout (font, metadata)
│   └── globals.css                     # Tailwind + CSS variables (shadcn)
├── components/
│   ├── ui/                             # Button, Card, Badge, Input, Table, Modal, dsb.
│   ├── layout/sidebar.tsx              # Navigasi per role
│   ├── dashboard/                      # summary-cards, revenue-chart, alerts-panel
│   └── agents/                         # agent-directory, agent-form, broadcast-modal
├── lib/
│   ├── supabase/ (client, server, middleware)
│   ├── utils.ts                        # cn()
│   ├── constants.ts                    # Enum & label (status kamar, invoice, dll.)
│   ├── types.ts                        # Tipe domain = bayangan kolom tabel
│   ├── auth.ts                         # Helper sesi & role
│   ├── queries/dashboard.ts            # Query agregat dashboard (server-only)
│   └── agents/broadcast.ts             # Generator teks broadcast kamar kosong
├── supabase/
│   ├── migrations/0001_init.sql        # [DONE] Skema + trigger + RLS + storage
│   └── seed.sql                        # Data contoh (opsional)
├── middleware.ts                       # Refresh sesi Supabase
├── .env.example
├── tailwind.config.ts / postcss.config.mjs / tsconfig.json / components.json
└── package.json
```

---

## 3. Model Data (Ringkas)

Semua tabel memakai UUID PK, `created_at/updated_at`, dan **RLS**. Detail kolom lengkap ada di `supabase/migrations/0001_init.sql`.

```
profiles (auth.users → role, full_name, phone, email)
 └─ properties  (owner_id → profiles)           # multi-properti per pemilik
     ├─ rooms   (property_id, status: vacant|occupied|maintenance, fasilitas text[])
     ├─ transactions (type: income|expense, category, txn_date)
     ├─ agents  (owner_id → profiles)           # direktori agen sewa + komisi
     └─ contracts (room_id, tenant_id, due_day, billing_cycle, status)
         ├─ tenants (user_id → profiles opsional, id_card_url)
         ├─ invoices (status: unpaid|pending_confirmation|paid, proof_url)
         │    └─ invoice_items (rincian sewa/listrik/air/denda)
         └─ tickets (komplain/kerusakan + foto)
notifications (per-user in-app)
```

Relasi kunci: satu **kontrak aktif** per kamar (dijaga partial unique index), invoice dibuat per periode kontrak (unique `contract_id + period_start` agar cron idempotent), bukti transfer di-upload penyewa ke bucket `payment-proofs` lalu pemilik memverifikasi manual → status `Lunas`.

---

## 4. Status Implementasi (Tahap 1 — deliverable ini)

- [x] Skema database lengkap + trigger profil + RLS + storage buckets (`supabase/migrations/0001_init.sql`)
- [x] Data contoh (`supabase/seed.sql`)
- [x] Fondasi aplikasi: supabase SSR client, middleware auth, `lib/constants`, `lib/types`, komponen UI
- [x] **Dashboard Pemilik**: summary cards (total/terisi/kosong kamar, penyewa aktif, tagihan bulan berjalan), grafik pendapatan vs pengeluaran 6 bulan (Recharts), panel notifikasi (tunggakan, kontrak mau habis, komplain baru)
- [x] **Manajemen Agen Sewa**: direktori CRUD agen (kontak WhatsApp/email/HP, rate komisi, catatan), tombol **Broadcast** → generate teks status kamar kosong siap salin ke WhatsApp/Email
- [x] **Tagihan & Verifikasi (pemilik)**: generate invoice otomatis bulan berjalan, daftar tagihan, verifikasi bukti (Terima/Tolak), koreksi status → memicu pencatatan transaksi otomatis (`app/(dashboard)/invoices`)
- [x] **Portal Penyewa**: beranda (kamar/kontrak), tagihan + upload bukti transfer ke bucket privat `payment-proofs` via RPC `confirm_payment` (status → Menunggu Konfirmasi), komplain + foto (`ticket-photos`), akun & ganti kata sandi (`app/portal/*`)
- [x] **Komplain (pemilik)**: daftar tiket + alur status Baru → Dikerjakan → Selesai → Ditutup, notifikasi lintas-user (`app/(dashboard)/tickets`)
- [ ] Modul berikutnya: CRUD properti & kamar (halaman), penyewa & kontrak + upload dokumen KTP, halaman Keuangan (transaksi manual sudah tercatat otomatis saat verifikasi), generator draft surat (.txt sudah ada utk demo 1-file), dashboard Super Admin (lihat `#6 Roadmap`)

---

## 5. Cara Menjalankan (100% Gratis)

**Prasyarat:** Node 18+, akun [supabase.com](https://supabase.com) & [vercel.com](https://vercel.com) (gratis).

1. **Buat project Supabase** (region dekat Anda) → buka *SQL Editor*.
2. Jalankan isi `supabase/migrations/0001_init.sql`, lalu (opsional) `supabase/seed.sql`. Skema ini juga otomatis membuat bucket storage & RLS storage.
3. **Auth settings**: *Authentication → Providers → Email* aktifkan; *URL Configuration* isi `NEXT_PUBLIC_SITE_URL`. Nonaktifkan "Confirm email" bila ingin langsung login (untuk demo), aktifkan untuk produksi.
4. Salin `.env.example` → `.env.local`, isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (dari *Project Settings → API*), `SUPABASE_SERVICE_ROLE_KEY`, dan `CRON_SECRET` (string acak).
5. Jadikan role Super Admin (opsional): setelah mendaftar via aplikasi, jalankan di SQL Editor:
   ```sql
   update profiles set role = 'super_admin' where email = 'email-anda@example.com';
   ```
6. Jalankan:
   ```bash
   npm install
   npm run dev        # http://localhost:3000
   ```

**Deploy ke Vercel (gratis):** push ke GitHub → import di Vercel → isi env yang sama → deploy. Netlify/Cloudflare Pages juga didukung (sesuaikan output config).

**Invoice otomatis (cron gratis):** endpoint `GET /api/cron/invoices` (dilindungi header `x-cron-secret`) membuat tagihan bulan berjalan untuk semua kontrak aktif yang belum punya invoice. Jadwalkan tiap tanggal 1 via **Vercel Cron** (Hobby: 1 jadwal/hari) atau [cron-job.org](https://cron-job.org) gratis — cukup panggil URL endpoint dengan header secret.

---

## 6. Batasan Free Tier (Supabase) — Perlu Diingat

| Resource | Free Tier | Catatan |
| --- | --- | --- |
| Database | 500 MB | Skema ini << 1 MB; aman untuk ratusan kamar + tahunan riwayat. |
| Auth MAU | 50.000 user aktif/bulan | Jauh di atas kebutuhan kos. |
| Storage | 1 GB + transfer 5 GB/bln | Foto KTP & bukti transfer kecil; atur kompresi/limit upload. |
| Edge Functions | 500k invocations/bln | Untuk cron invoice bila ingin dipindah ke Edge Function. |
| Pause otomatis | Setelah 1 minggu idle (proyek gratis) | Aktifkan kembali sekali klik; hindari untuk produksi aktif. |

Proyek yang tidak dipakai >1 minggu bisa **paused** oleh Supabase — klik "Restore" di dashboard bila terjadi.

---

## 7. Roadmap Modul

1. **Properti & Kamar** — CRUD gedung; CRUD kamar (tipe, fasilitas AC/KM Dalam, harga harian/bulanan/tahunan); papan status kamar berwarna (Terisi hijau / Kosong biru / Maintenance kuning) + filter per properti.
2. **Penyewa & Kontrak** — profil + upload KTP ke storage; kontrak digital (tanggal mulai/akhir, `due_day`, durasi); generator draft surat perjanjian (.docx/teks) & upload PDF kontrak.
3. **Invoice & Keuangan** — pembuatan tagihan per `due_day` (cron), rincian `invoice_items` (listrik/air/denda), status Belum Dibayar → Menunggu Konfirmasi → Lunas, verifikasi bukti transfer oleh pemilik; catat transaksi uang masuk/keluar & ekspor laporan.
4. **Tiket Komplain** — tenant buka tiket + foto; landlord ubah status open → in_progress → resolved; muncul di dashboard.
5. **Portal Tenant** — lihat kamar/kontrak/tagihan, upload bukti, buka tiket.
6. **Super Admin** — ringkasan platform (jumlah landlord/properti/penyewa), manajemen user, statistik lintas properti.

---

## 8. Keamanan & Catatan

- Semua policy RLS ditulis **default deny** lalu dibuka selektif per role.
- Helper `is_super_admin()`, `is_landlord_of(property_id)`, `is_owner_of_agent(...)` dipakai di policy — mudah diaudit.
- Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY` di kode klien; hanya dipakai route handler cron (opsional) & operasi super admin terbatas.
- Folder `tenant-docs` berisi data pribadi (KTP) — gunakan bucket **private** + signed URL (contoh sudah disediakan di migration; sesuaikan kebijakan Anda).
