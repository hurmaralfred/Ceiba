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
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get all profiles with email
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, email")
    .not("email", "is", null);

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;

  for (const profile of profiles) {
    if (!profile.email) continue;

    // New family members who joined this week
    const { data: newMembers } = await supabase
      .from("family_members")
      .select("first_name, last_name, created_at")
      .eq("added_by", profile.id)
      .not("profile_id", "is", null)
      .gte("created_at", weekAgo);

    // Upcoming birthdays in the next 7 days
    const { data: allMembers } = await supabase
      .from("family_members")
      .select("first_name, last_name, birth_date")
      .eq("added_by", profile.id)
      .not("birth_date", "is", null);

    const upcomingBirthdays = (allMembers || []).filter((m) => {
      if (!m.birth_date) return false;
      const bd = m.birth_date as string; // YYYY-MM-DD
      const mmdd = bd.slice(5); // MM-DD
      // Check if birthday falls in next 7 days
      for (let i = 0; i <= 7; i++) {
        const d = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        const checkMmdd = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (mmdd === checkMmdd) return true;
      }
      return false;
    });

    // New photos this week
    const { count: newPhotos } = await supabase
      .from("family_photos")
      .select("id", { count: "exact", head: true })
      .eq("uploaded_by", profile.id)
      .gte("created_at", weekAgo);

    // New events this week
    const { count: newEvents } = await supabase
      .from("family_events")
      .select("id", { count: "exact", head: true })
      .eq("created_by", profile.id)
      .gte("created_at", weekAgo);

    // Total family stats
    const { data: totalFam } = await supabase
      .from("family_members")
      .select("id, profile_id")
      .eq("added_by", profile.id);

    const totalMembers = (totalFam || []).length;
    const joinedMembers = (totalFam || []).filter((m) => m.profile_id).length;

    try {
      const result = await sendWeeklyDigestEmail(profile.email, profile.first_name, {
        newMembers: (newMembers || []) as any,
        upcomingBirthdays: upcomingBirthdays as any,
        newPhotos: newPhotos || 0,
        newEvents: newEvents || 0,
        totalMembers,
        joinedMembers,
      });
      if (result) sent++;
    } catch (e) {
      console.error("Digest email failed for", profile.id, e);
    }
  }

  return NextResponse.json({ ok: true, sent, total: profiles.length });
}
