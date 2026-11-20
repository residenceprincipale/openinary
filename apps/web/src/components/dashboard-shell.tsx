"use client";

import { ShellInset } from "@openinary/dashboard";
import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";

import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { useSession } from "@/lib/auth-client";

/**
 * The sidebar and the sheet every dashboard route draws on, mounted once for
 * all of them: moving between pages, or the session and the data landing,
 * never swaps the shell for a look-alike. Each region inside draws its own
 * skeleton while its data loads.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  // The middleware turns away requests without a session cookie; this
  // catches one that is there but no longer valid.
  useEffect(() => {
    if (!isPending && !session?.user) router.push("/login");
  }, [session, isPending, router]);

  return (
    <>
      <AppSidebar />
      <ShellInset>{children}</ShellInset>
    </>
  );
}
