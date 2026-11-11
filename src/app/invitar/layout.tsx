import type { Metadata } from "next";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = shareMetadata("/invitar");

export default function InvitarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
