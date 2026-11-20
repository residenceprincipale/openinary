"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  QueueStatsCards,
  QueueTable,
  type QueueTableJob as QueueJob,
  SettingsSection,
  useOpeninary,
  useQueueEvents,
} from "@openinary/ui";
import { RefreshCw } from "lucide-react";

type WorkerStats = {
  maxConcurrent?: number;
  activeJobs?: number;
  totalProcessed?: number;
  [key: string]: unknown;
};

const FILTERS = ["all", "pending", "processing", "completed", "error"] as const;

export function QueuePage() {
  const { apiBaseUrl, fetch } = useOpeninary();
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    error: 0,
  });
  const [worker, setWorker] = useState<WorkerStats | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [isLoading, setIsLoading] = useState(true);
  const { isConnected } = useQueueEvents(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, jobsRes, workerRes] = await Promise.all([
        fetch(`${apiBaseUrl}/queue/stats`),
        fetch(
          filter === "all"
            ? `${apiBaseUrl}/queue/jobs?limit=100`
            : `${apiBaseUrl}/queue/jobs?status=${filter}&limit=100`,
        ),
        fetch(`${apiBaseUrl}/queue/worker/stats`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (jobsRes.ok) setJobs((await jobsRes.json()).jobs);
      if (workerRes.ok) setWorker(await workerRes.json());
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, fetch, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Video queue"
        description="Transcodes run in the background. Retry or cancel a job here."
        action={
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
            <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        }
      >
        <QueueStatsCards stats={stats} />
        {worker && (
          <p className="text-xs text-muted-foreground">
            {isConnected ? "Live · " : ""}
            {worker.maxConcurrent !== undefined &&
              `max concurrent ${worker.maxConcurrent} · `}
            {worker.activeJobs !== undefined &&
              `${worker.activeJobs} running · `}
            {worker.totalProcessed !== undefined &&
              `${worker.totalProcessed} processed`}
          </p>
        )}
      </SettingsSection>

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((entry) => (
          <Button
            key={entry}
            size="sm"
            variant={filter === entry ? "secondary" : "ghost"}
            className="capitalize"
            onClick={() => setFilter(entry)}
          >
            {entry === "error" ? "failed" : entry}
          </Button>
        ))}
      </div>

      <QueueTable jobs={jobs} onActionComplete={load} />
    </div>
  );
}
