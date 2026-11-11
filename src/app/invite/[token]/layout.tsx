import type { Metadata } from "next";
import { shareMetadata } from "@/lib/seo";

export function generateMetadata({ params }: { params: { token: string } }): Metadata {
  return shareMetadata(`/invite/${params.token}`);
}

export default function InviteTokenLayout({ children }: { children: React.ReactNode }) {
  return children;
}
