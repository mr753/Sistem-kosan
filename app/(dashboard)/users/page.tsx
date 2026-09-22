import { requireUser } from "@/lib/auth";
import { getUsers } from "@/lib/actions/users";
import { UsersClient } from "@/components/users/users-client";
import { redirect } from "next/navigation";

export const metadata = { title: "Manajemen User" };

export default async function UsersPage() {
  const { profile } = await requireUser();

  // Proteksi rute: Hanya untuk Super Admin
  if (profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  const users = await getUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manajemen User</h1>
        <p className="text-sm text-muted-foreground">
          Kelola hak akses pengguna platform.
        </p>
      </div>

      <UsersClient initialUsers={users} />
    </div>
  );
}
