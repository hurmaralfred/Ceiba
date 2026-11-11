import type { Metadata } from "next";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = shareMetadata("/invite");

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
