import { redirect } from "next/navigation";

export default function LegacyPurePressOwnerLoginRedirect() {
  redirect("/admin/login");
}
