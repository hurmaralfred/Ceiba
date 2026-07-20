import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=missing_oauth_code`
    );
  }

  const cookieStore = await cookies();

  type CookieToSet = {
    name: string;
    value: string;
    options?: Parameters<typeof cookieStore.set>[2];
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !user) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      `${origin}/auth/login?error=oauth_callback`
    );
  }

  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Usuario";

  /*
   * El trigger handle_new_user crea normalmente este perfil.
   * Este upsert cubre usuarios existentes o casos en que el trigger
   * no haya creado el registro.
   */
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: fullName,
      },
      {
        onConflict: "user_id",
        ignoreDuplicates: false,
      }
    );

  if (profileError) {
    console.error("Profile upsert error:", profileError);
    return NextResponse.redirect(
      `${origin}/auth/login?error=profile_creation`
    );
  }

  if (next?.startsWith("/") && !next.startsWith("//")) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/onboarding`);
}
