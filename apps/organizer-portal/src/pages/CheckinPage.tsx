import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrganizerSnapshot } from "@/lib/use-organizer-data";

export function CheckinPage() {
  const { data } = useOrganizerSnapshot();

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
      <DataPanel title="Gate metrics" description="Valid, duplicate, and invalid scans by gate.">
        <div className="space-y-3">
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
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-purple-800">
            1 sync retry is waiting for the next attempt.
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-800">
            Processed jobs remain available through service logs.
          </div>
        </div>
      </DataPanel>
    </div>
  );
}
