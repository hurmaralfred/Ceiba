import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";

// Service-role client — can read protected administrative data.
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * GET /api/admin/metrics
 * Embudo de invitaciones (vistas v_invitation_*, solo service role).
 * Solo para los usuarios listados en ADMIN_USER_IDS; si la variable no está
 * definida nadie tiene acceso (antes cualquier usuario con sesión podía verlo).
 */
export async function GET(_req: NextRequest) {
  let admin;

  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("Admin metrics configuration error:", error);

    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  const supabase = createSSRClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (!adminIds.includes(user.id)) {
    // your_user_id: el propio id del solicitante, para poder añadirlo a ADMIN_USER_IDS.
    return NextResponse.json(
      { error: "Forbidden", configured: adminIds.length > 0, your_user_id: user.id },
      { status: 403 },
    );
  }

  const [weeklyRes, templateRes, invitersRes, stuckRes, totalsRes] = await Promise.all([
    admin.from("v_invitation_funnel_weekly").select("*").limit(12),
    admin.from("v_invitation_template_performance").select("*"),
    admin.from("v_invitation_top_inviters").select("*").limit(10),
    admin.from("v_invitation_stuck").select("*").limit(20),
    admin.from("v_invitation_funnel").select("shared_at, opened_at, cta_clicked_at, accepted_at"),
  ]);

  const rows = totalsRes.data ?? [];
  const totals = {
    shared: rows.filter(r => r.shared_at).length,
    opened: rows.filter(r => r.opened_at).length,
    cta_clicked: rows.filter(r => r.cta_clicked_at).length,
    accepted: rows.filter(r => r.accepted_at).length,
  };

  return NextResponse.json({
    totals,
    weekly: weeklyRes.data ?? [],
    templates: templateRes.data ?? [],
    topInviters: invitersRes.data ?? [],
    stuck: stuckRes.data ?? [],
    fetchedAt: new Date().toISOString(),
  });
}
