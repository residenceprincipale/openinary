import { SidebarProvider } from "@openinary/dashboard/ui/sidebar";
import { cookies } from "next/headers";

import { DashboardShell } from "@/components/dashboard-shell";
import { WebDashboardProvider } from "@/components/dashboard-providers";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <WebDashboardProvider>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <DashboardShell>{children}</DashboardShell>
      </SidebarProvider>
    </WebDashboardProvider>
  );
}
