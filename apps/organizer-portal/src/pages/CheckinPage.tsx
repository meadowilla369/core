import { useEffect, useState } from "react";
import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";
import type { OperationalStatus } from "@/domain/status";
import { useOrganizerSnapshot } from "@/lib/use-organizer-data";

interface MarkAsUsedJob {
  jobId: string;
  tokenId: string;
  status: "pending" | "retrying" | "processed" | "failed";
  attempt: number;
  requestedAt: string;
  completedAt?: string;
  lastError?: string;
}

function useMarkAsUsedJobs() {
  const [jobs, setJobs] = useState<MarkAsUsedJob[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/v1/checkin/mark-as-used/jobs");
        const body = (await res.json()) as { success: boolean; data: MarkAsUsedJob[] };
        if (body.success) setJobs(body.data);
      } catch {
        // best-effort
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  return jobs;
}

const JOB_STATUS_TONE: Record<MarkAsUsedJob["status"], OperationalStatus> = {
  pending: "pending",
  retrying: "sync_retry",
  processed: "valid",
  failed: "failed"
};

const JOB_STATUS_LABEL: Record<MarkAsUsedJob["status"], string> = {
  pending: "pending",
  retrying: "retrying",
  processed: "processed",
  failed: "failed"
};

export function CheckinPage() {
  const { data } = useOrganizerSnapshot();
  const jobs = useMarkAsUsedJobs();

  const pendingJobs = jobs.filter((j) => j.status === "pending" || j.status === "retrying");
  const recentJobs = jobs.slice(0, 10);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
      <DataPanel title="Gate metrics" description="Valid, duplicate, and invalid scans by gate.">
        <div className="space-y-3">
          {data?.gates.length === 0 && (
            <p className="text-sm text-[--op-muted]">No check-ins recorded yet.</p>
          )}
          {data?.gates.map((gate) => (
            <div key={gate.gateId} className="rounded-lg border border-[--op-border] p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{gate.gateId}</p>
                <StatusBadge
                  status={gate.invalidCount > 0 ? "pending" : "valid"}
                  label={gate.invalidCount > 0 ? "Attention" : "Healthy"}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-[--op-muted]">Valid</p>
                  <p className="font-semibold text-green-700">{gate.checkedInCount}</p>
                </div>
                <div>
                  <p className="text-xs text-[--op-muted]">Duplicate</p>
                  <p className="font-semibold text-amber-700">{gate.duplicateCount}</p>
                </div>
                <div>
                  <p className="text-xs text-[--op-muted]">Invalid</p>
                  <p className="font-semibold text-red-700">{gate.invalidCount}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DataPanel>

      <DataPanel title="Mark-as-used jobs" description="Async chain sync visibility.">
        <div className="space-y-3 text-sm">
          {pendingJobs.length > 0 && (
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-purple-800">
              {pendingJobs.length} sync job{pendingJobs.length > 1 ? "s" : ""} waiting for next
              attempt.
            </div>
          )}
          {recentJobs.length === 0 && <p className="text-[--op-muted]">No jobs yet.</p>}
          {recentJobs.map((job) => (
            <div
              key={job.jobId}
              className="flex items-center justify-between rounded-lg border border-[--op-border] p-3"
            >
              <div>
                <p className="font-mono text-xs text-[--op-muted]">token {job.tokenId}</p>
                {job.lastError && <p className="text-xs text-red-600">{job.lastError}</p>}
              </div>
              <StatusBadge
                status={JOB_STATUS_TONE[job.status]}
                label={JOB_STATUS_LABEL[job.status]}
              />
            </div>
          ))}
        </div>
      </DataPanel>
    </div>
  );
}
