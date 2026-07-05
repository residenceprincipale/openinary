"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { QueueStatsCards } from "@/components/queue/queue-stats-cards";
import { QueueTable, type QueueJob } from "@/components/queue/queue-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";
import { useQueueEvents } from "@/hooks/use-queue-events";
import { useFeatures } from "@/components/features-provider";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";

function QueuePageContent() {
  const { disableTransforms } = useFeatures();
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [stats, setStats] = useState({
    total: 0, pending: 0, processing: 0, completed: 0, error: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const { jobStatuses, isConnected } = useQueueEvents(true);

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${apiBaseUrl}/queue/stats`, { credentials: "include" });
      if (r.ok) setStats(await r.json());
    } catch {}
  }, []);

  const fetchJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = selectedFilter === "all"
        ? `${apiBaseUrl}/queue/jobs?limit=100`
        : `${apiBaseUrl}/queue/jobs?status=${selectedFilter}&limit=100`;
      const r = await fetch(url, { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setJobs(d.jobs);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  }, [selectedFilter]);

  useEffect(() => {
    fetchStats();
    fetchJobs();
    const interval = setInterval(() => { fetchStats(); fetchJobs(); }, 5000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchJobs]);

  if (disableTransforms) {
    return (
      <>
        <AppSidebar />
        <SidebarInset>
          <div className="flex h-screen items-center justify-center text-muted-foreground">
            <p>Video processing queue is disabled.</p>
          </div>
        </SidebarInset>
      </>
    );
  }

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Queue</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="px-6 py-8">
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold lg:text-4xl">Queue</h1>
                <p className="text-muted-foreground leading-relaxed">
                  Monitor and manage video processing jobs
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isConnected && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
                    <span>Live</span>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => { fetchStats(); fetchJobs(); }}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>

            <QueueStatsCards stats={stats} />

            <Tabs value={selectedFilter} onValueChange={setSelectedFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="processing">Processing</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="error">Failed</TabsTrigger>
              </TabsList>
              <TabsContent value={selectedFilter} className="mt-6">
                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                  </div>
                ) : (
                  <QueueTable jobs={jobs} onActionComplete={() => { fetchStats(); fetchJobs(); }} />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SidebarInset>
    </>
  );
}

export default function QueuePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
      <QueuePageContent />
    </Suspense>
  );
}
