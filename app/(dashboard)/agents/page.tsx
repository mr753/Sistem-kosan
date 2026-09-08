import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildVacancyGroups } from "@/app/(dashboard)/agents/vacancies";
import { AgentDirectory } from "@/components/agents/agent-directory";
import type { Agent } from "@/lib/types";
import type { VacancyGroup } from "@/lib/agents/broadcast";

export const metadata = { title: "Agen Sewa" };

export default async function AgentsPage() {
  const { profile } = await requireUser();
  const supabase = await createClient();

  // Super admin melihat semua agen; landlord hanya agen miliknya.
  const agentScope = profile.role === "super_admin" ? {} : { owner_id: profile.id };

  const { data: agentsRaw } = await supabase
    .from("agents")
    .select("*, properties(id,name)")
    .match(agentScope)
    .order("created_at", { ascending: false });

  const agents = (agentsRaw ?? []) as unknown as Agent[];

  // Properti: semua utk super admin, miliknya utk landlord
  let propQuery = supabase
    .from("properties")
    .select("id,name,city,address,is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (profile.role !== "super_admin") propQuery = propQuery.eq("owner_id", profile.id);
  const { data: properties } = await propQuery;

  const propertyIds = (properties ?? []).map((p) => p.id);
  const vacancyGroups: VacancyGroup[] = propertyIds.length
    ? await buildVacancyGroups(supabase, propertyIds)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agen Sewa</h1>
          <p className="text-sm text-muted-foreground">
            Direktori kontak agen (Mamikos, Infokost, agen lokal) & broadcast ketersediaan kamar.
          </p>
        </div>
      </div>

      <AgentDirectory
        initialAgents={agents}
        properties={(properties ?? []).map((p) => ({ id: p.id, name: p.name }))}
        vacancyGroups={vacancyGroups}
        canManage={profile.role === "landlord"}
      />
    </div>
  );
}
