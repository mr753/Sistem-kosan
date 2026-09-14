-- Metadata Auth dapat dikirim langsung oleh klien. Pertahankan pendaftaran
-- tenant/landlord yang tersedia di UI, tetapi jangan pernah mempercayai
-- metadata untuk membuat super_admin.
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
