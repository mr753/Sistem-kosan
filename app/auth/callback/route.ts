import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Callback OAuth / konfirmasi email (pola @supabase/ssr). */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        const target = profile?.role === "tenant" ? "/portal" : next;
        return NextResponse.redirect(new URL(target, origin));
      }
    }
  }

  return NextResponse.redirect(new URL("/login?error=callback", origin));
}
