import { notFound } from "next/navigation";
import { DesignSystemPreview } from "./DesignSystemPreview";

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignSystemPreview />;
}
