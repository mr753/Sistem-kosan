import Link from "next/link";
import { Home } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Home className="size-4" />
        </div>
        <span className="text-lg font-bold">Kos Management</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
