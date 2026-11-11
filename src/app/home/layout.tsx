import type { Metadata } from "next";
import { shareMetadata } from "@/lib/seo";

export const metadata: Metadata = shareMetadata("/home");

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
