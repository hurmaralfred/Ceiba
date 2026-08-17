"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { initAnalytics, identifyUser } from "@/lib/viral/viralAnalytics";

export default function AmplitudeInit() {
  useEffect(() => {
    initAnalytics();

    // Identifica al usuario si hay sesión activa
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        identifyUser(data.user.id, {
          email: data.user.email,
          created_at: data.user.created_at,
        });
      }
    });
  }, []);

  return null;
}
