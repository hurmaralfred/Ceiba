import type { Metadata } from "next";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = shareMetadata("/auth/login");

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
