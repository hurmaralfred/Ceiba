import { NextRequest, NextResponse } from "next/server";
import { sendMemberJoinedEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.INTERNAL_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { to, ownerName, joinerName, relationLabel } = await req.json();
  if (!to || !joinerName) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  try {
    await sendMemberJoinedEmail(to, ownerName, joinerName, relationLabel);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
