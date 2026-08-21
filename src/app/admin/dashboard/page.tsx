import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminDashboardClient from "./ClientDashboard";

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value;

  if (!token) {
    redirect("/login");
  }

  return <AdminDashboardClient />;
}