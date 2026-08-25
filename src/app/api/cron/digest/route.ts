import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { sendWeeklyDigestEmail } from "@/lib/email";

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get all users with their emails via auth.users (service role required)
  // profiles.email doesn't exist — email lives in auth.users
  const { data: { users: authUsers }, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersErr || !authUsers || authUsers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, error: usersErr?.message });
  }

  // Fetch display names from profiles table (keyed by user_id)
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("user_id, display_name");
  const displayNameByUserId = new Map((profileRows || []).map((p: any) => [p.user_id as string, p.display_name as string]));

  let sent = 0;

  for (const authUser of authUsers) {
    const userEmail = authUser.email;
    if (!userEmail) continue;
    const userId = authUser.id;
    const firstName = displayNameByUserId.get(userId) || authUser.user_metadata?.first_name || "Familia";

    // Derive the user's person_id via person_claims
    const { data: claim } = await supabase
      .from("person_claims")
      .select("person_id")
      .eq("user_id", userId)
      .eq("claim_status", "approved")
      .is("revoked_at", null)
      .maybeSingle();
    if (!claim?.person_id) continue;

    // Derive the family space
    const { data: mem } = await supabase
      .from("space_memberships")
      .select("space_id")
      .eq("person_id", (claim as any).person_id)
      .maybeSingle();
    const spaceId = (mem as any)?.space_id;
    if (!spaceId) continue;

    // New persons added to the space this week
    const { data: newMembers } = await supabase
      .from("persons")
      .select("first_name, first_surname, created_at")
      .eq("created_by", userId)
      .gte("created_at", weekAgo)
      .limit(10);

    // Upcoming birthdays via persons in same space
    const { data: spacePersons } = await supabase
      .from("space_memberships")
      .select("persons(first_name, birth_date)")
      .eq("space_id", spaceId)
      .not("persons", "is", null);

    const upcomingBirthdays = ((spacePersons || []) as any[])
      .map((r: any) => r.persons)
      .filter(Boolean)
      .filter((p: any) => {
        if (!p.birth_date) return false;
        const mmdd = (p.birth_date as string).slice(5);
        for (let i = 0; i <= 7; i++) {
          const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
          const check = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          if (mmdd === check) return true;
        }
        return false;
      });

    // New photos and memories this week in the space
    const [{ count: newPhotos }, { count: newEvents }] = await Promise.all([
      supabase.from("family_photos").select("id", { count: "exact", head: true })
        .eq("space_id", spaceId).gte("created_at", weekAgo),
      supabase.from("family_memories").select("id", { count: "exact", head: true })
        .eq("family_space_id", spaceId).gte("created_at", weekAgo),
    ]);

    // Total space member count
    const { count: totalMembers } = await supabase
      .from("space_memberships")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId);

    const joinedMembers = totalMembers ?? 0;

    // Skip users with nothing to report — an empty digest drives unsubscribes
    const hasActivity =
      (newMembers || []).length > 0 ||
      upcomingBirthdays.length > 0 ||
      (newPhotos ?? 0) > 0 ||
      (newEvents ?? 0) > 0;
    if (!hasActivity) continue;

    try {
      const result = await sendWeeklyDigestEmail(userEmail, firstName, {
        newMembers: (newMembers || []) as any,
        upcomingBirthdays: upcomingBirthdays as any,
        newPhotos: newPhotos || 0,
        newEvents: newEvents || 0,
        totalMembers: totalMembers ?? 0,
        joinedMembers,
      });
      if (result) sent++;
    } catch (e) {
      console.error("Digest email failed for", userId, e);
    }
  }

  return NextResponse.json({ ok: true, sent, total: authUsers.length });
}
