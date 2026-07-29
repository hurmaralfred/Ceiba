import { notFound } from "next/navigation";
import { HomeDashboardPreview } from "./HomeDashboardPreview";

export default function HomePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <HomeDashboardPreview />;
}
