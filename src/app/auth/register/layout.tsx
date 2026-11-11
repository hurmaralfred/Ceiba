import type { Metadata } from "next";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = shareMetadata("/auth/register");

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
