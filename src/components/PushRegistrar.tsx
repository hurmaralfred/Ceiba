"use client";
import { usePushNotifications } from "@/hooks/usePushNotifications";

// Thin wrapper so the layout (Server Component) can include push registration
// without becoming a client component itself.
export default function PushRegistrar() {
  usePushNotifications();
  return null;
}
