import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  planned: string[];
}

/** Penanda modul yang akan dibangun di tahap berikutnya (roadmap ada di README). */
export function ModulePlaceholder({ title, description, icon: Icon, planned }: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card className="mx-auto max-w-xl">
        <CardHeader className="items-center text-center">
          <div className="mb-1 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-6" />
          </div>
          <CardTitle>Modul ini sedang disiapkan</CardTitle>
          <CardDescription>
            Tahap pertama (deliverable ini) berfokus pada skema database, Dashboard, dan Agen Sewa.
            Modul berikutnya dijadwalkan sesuai roadmap di README.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {planned.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
