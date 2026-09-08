import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();

  // Penyewa memakai Portal terpisah (di luar group dashboard)
  if (profile.role === "tenant") redirect("/portal");

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar role={profile.role} fullName={profile.full_name} email={profile.email} />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
