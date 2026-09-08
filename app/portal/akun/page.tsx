import { requireUser } from "@/lib/auth";
import { updateAccountAction } from "@/app/portal/akun/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordForm } from "@/components/portal/password-form";

export const metadata = { title: "Akun Saya" };

export default async function PortalAccountPage() {
  const { profile } = await requireUser("tenant");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Akun Saya</h1>
        <p className="text-sm text-muted-foreground">
          Data profil login Anda. Data penyewa (kontak darurat, alamat) dikelola pengelola kos.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateAccountAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input id="name" name="name" defaultValue={profile.full_name ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">No. HP</Label>
                <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} />
              </div>
              <div className="space-y-2">
                <Label>Email (login)</Label>
                <Input value={profile.email ?? ""} disabled />
              </div>
              <Button type="submit">Simpan Profil</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kata Sandi</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
