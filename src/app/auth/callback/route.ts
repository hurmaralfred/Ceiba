import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/tree";

  if (!code) return NextResponse.redirect(`${origin}/auth/login`);

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !user) return NextResponse.redirect(`${origin}/auth/login`);

  // Create profile if this is the first Google login
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  if (!existingProfile) {
    const fullName = user.user_metadata?.full_name || "";
    const parts = fullName.trim().split(" ");
    const first_name = parts.slice(0, Math.ceil(parts.length / 2)).join(" ") || user.email?.split("@")[0] || "Usuario";
    const last_name = parts.slice(Math.ceil(parts.length / 2)).join(" ") || "";

    await supabase.from("profiles").insert({
      id: user.id,
      email: user.email,
      first_name,
      last_name,
      avatar_url: user.user_metadata?.avatar_url || null,
    });

    // New Google user → go to onboarding
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
