import Link from "next/link";
import { Home, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";
import { PortalNav } from "@/components/portal/nav";

export const metadata = { title: "Portal Penyewa" };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("tenant");

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3">
          <Link href="/portal" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Home className="size-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">Portal Penyewa</p>
              <p className="text-xs text-muted-foreground">{profile.full_name ?? profile.email}</p>
            </div>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut className="size-4" /> Keluar
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        <PortalNav />
        <div className="mt-5">{children}</div>
      </main>
    </div>
  );
}

