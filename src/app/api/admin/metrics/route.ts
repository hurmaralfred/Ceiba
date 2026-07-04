import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";

// Service-role client — can read auth.users (needed by viral views)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/admin/metrics
 * Fetches all K-viral dashboard data.
 * Only accessible to authenticated users; in prod, add an admin check.
 */
export async function GET(_req: NextRequest) {
  // Auth check
  const supabase = createSSRClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    kViralRes,
    funnelRes,
    templateRes,
    cycleRes,
    familiesRes,
    topInvitersRes,
    lostInvitesRes,
  ] = await Promise.all([
    admin.from("v_k_viral_weekly").select("*").limit(8),
    admin.from("v_activation_funnel").select("*").limit(8),
    admin.from("v_template_performance").select("*"),
    admin.from("v_cycle_time").select("*").limit(4),
    admin.from("v_complete_families").select("*").maybeSingle(),
    admin.from("v_top_inviters").select("*").limit(20),
    admin
      .from("invitations")
      .select("code, template_id, first_opened_at, first_opened_from, reminders_sent, created_at")
      .eq("status", "opened")
      .lt("first_opened_at", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order("first_opened_at", { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    kViral:      kViralRes.data   ?? [],
    funnel:      funnelRes.data   ?? [],
    templates:   templateRes.data ?? [],
    cycleTime:   cycleRes.data    ?? [],
    families:    familiesRes.data ?? null,
    topInviters: topInvitersRes.data ?? [],
    lostInvites: lostInvitesRes.data  ?? [],
    fetchedAt:   new Date().toISOString(),
  });
}
