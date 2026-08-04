"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CosmicSpinner } from "@/components/ui/cosmic";

export default function MeRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/auth/login"); return; }
      supabase
        .from("person_claims")
        .select("person_id")
        .eq("user_id", user.id)
        .eq("claim_status", "approved")
        .is("revoked_at", null)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.person_id) {
            router.replace(`/persona/${data.person_id}?self=true`);
          } else {
            // No linked person yet — fall back to profile settings
            router.replace("/profile");
          }
        });
    });
  }, [router]);

  return <CosmicSpinner />;
}
