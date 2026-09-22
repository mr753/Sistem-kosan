import { requireUser } from "@/lib/auth";
import { ProfileForm } from "@/components/settings/profile-form";

export const metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const { profile } = await requireUser();

  const initialData = {
    full_name: profile.full_name,
    phone: profile.phone,
    email: profile.email ?? "",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">
          Kelola informasi profil dan akun Anda.
        </p>
      </div>

      <ProfileForm initialData={initialData} role={profile.role} />
    </div>
  );
}
