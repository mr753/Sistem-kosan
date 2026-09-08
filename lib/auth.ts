import { redirect } from "next/navigation";
import type { Profile } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email?: string;
}

export interface AuthSession {
  user: SessionUser;
  profile: Profile;
}

/**
 * Ambil user + profil dari sesi. Redirect ke /login bila belum login.
 * Bisa diarahkan wajib ke role tertentu lewat `requiredRole`.
 */
export async function requireUser(requiredRole?: Profile["role"]): Promise<AuthSession> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (profileError || !profile) redirect("/login");

  if (requiredRole && profile.role !== requiredRole) {
    redirect(profile.role === "tenant" ? "/portal" : "/dashboard");
  }

  return {
    user: { id: data.user.id, email: data.user.email },
    profile: profile as Profile
  };
}
