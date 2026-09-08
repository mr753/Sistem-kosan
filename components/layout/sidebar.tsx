"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2, DoorOpen, FileSignature, Handshake, LayoutDashboard,
  LogOut, Menu, ReceiptText, Settings, Users, Wallet, Wrench, X, Home
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const OWNER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/properties", label: "Properti", icon: Building2 },
  { href: "/rooms", label: "Kamar", icon: DoorOpen },
  { href: "/tenants", label: "Penyewa", icon: Users },
  { href: "/contracts", label: "Kontrak", icon: FileSignature },
  { href: "/invoices", label: "Tagihan", icon: ReceiptText },
  { href: "/transactions", label: "Keuangan", icon: Wallet },
  { href: "/tickets", label: "Komplain", icon: Wrench },
  { href: "/agents", label: "Agen Sewa", icon: Handshake }
];

const COMMON_NAV: NavItem[] = [{ href: "/settings", label: "Pengaturan", icon: Settings }];

export function SidebarContent({
  role,
  fullName,
  email
}: {
  role: string;
  fullName: string | null;
  email: string | null;
}) {
  const pathname = usePathname();
  const items = role === "tenant" ? [] : [...OWNER_NAV, ...COMMON_NAV];

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Home className="size-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold">Kos Management</p>
          <p className="text-xs text-muted-foreground">
            {role === "landlord" ? "Pemilik Kos" : role === "super_admin" ? "Super Admin" : "Penyewa"}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t p-3">
        <div className="mb-2 flex items-center gap-2 px-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
            {getInitials(fullName)}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">{fullName || "Pengguna"}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" className="w-full justify-start text-muted-foreground">
            <LogOut className="size-4" /> Keluar
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Sidebar responsif: drawer di mobile, statis di desktop. */
export function Sidebar(props: { role: string; fullName: string | null; email: string | null }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background px-4 py-3 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Buka menu">
          <Menu className="size-5" />
        </Button>
        <p className="text-sm font-bold">Kos Management</p>
      </header>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-background shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent"
              aria-label="Tutup menu"
            >
              <X className="size-4" />
            </button>
            <SidebarContent {...props} />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-background lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent {...props} />
        </div>
      </aside>
    </>
  );
}
