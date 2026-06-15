import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { DataPanel } from "@/components/DataPanel";
import { StatusBadge } from "@/components/StatusBadge";
import {
  defaultOrganizerApi,
  type CheckinGate,
  type OrganizerEventDetail
} from "@/lib/organizer-api";

type ScanStatus = "idle" | "scanning" | "success" | "error";

interface ScanResult {
  valid: boolean;
  reason?: string;
  message?: string;
  ticketId?: string;
  gateId?: string;
  checkedInAt?: string;
}

interface VerifyResponse {
  success: boolean;
  data?: ScanResult;
  error?: { code: string; message: string };
}

export function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  const [events, setEvents] = useState<OrganizerEventDetail[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  const [gates, setGates] = useState<CheckinGate[]>([]);
  const [gatesLoading, setGatesLoading] = useState(false);
  const [gateId, setGateId] = useState<string>("");

  const [cameraActive, setCameraActive] = useState(false);
  const [status, setStatus] = useState<ScanStatus>("idle");
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [lastRaw, setLastRaw] = useState<string>("");
  const [scanCount, setScanCount] = useState(0);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    setEventsLoading(true);
    defaultOrganizerApi
      .listEvents({ status: "active" })
      .then((data) => {
        setEvents(data);
        if (data.length === 1) {
          setSelectedEventId(data[0].id);
        }
      })
      .catch(() => setEvents([]))
      .finally(() => setEventsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      setGates([]);
      setGateId("");
      return;
    }

    setGatesLoading(true);
    defaultOrganizerApi
      .listEventGates(selectedEventId)
      .then((data) => {
        const active = data.filter((g) => g.status === "active");
        setGates(active);
        setGateId(active[0]?.id ?? "");
      })
      .catch(() => {
        setGates([]);
        setGateId("");
      })
      .finally(() => setGatesLoading(false));
  }, [selectedEventId]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
    setStatus("idle");
  }, []);

  const submitQr = useCallback(
    async (rawJson: string) => {
      if (processing) return;
      setProcessing(true);
      setLastRaw(rawJson);

      try {
        const qrData = JSON.parse(rawJson) as Record<string, unknown>;
        const res = await fetch("/v1/checkin/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ gateId, qrData })
        });
        const body = (await res.json()) as VerifyResponse;

        if (body.success && body.data) {
          setLastResult(body.data);
          setStatus(body.data.valid ? "success" : "error");
          setScanCount((n) => n + 1);
        } else {
          setLastResult({ valid: false, reason: body.error?.code, message: body.error?.message });
          setStatus("error");
          setScanCount((n) => n + 1);
        }
      } catch {
        setLastResult({
          valid: false,
          reason: "PARSE_ERROR",
          message: "QR data is not valid JSON"
        });
        setStatus("error");
      }

      setTimeout(() => {
        setProcessing(false);
        setStatus("scanning");
      }, 3000);
    },
    [gateId, processing]
  );

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(tick);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert"
    });

    if (code && !processing) {
      void submitQr(code.data);
    } else {
      animFrameRef.current = requestAnimationFrame(tick);
    }
  }, [processing, submitQr]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setStatus("scanning");
      animFrameRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setLastResult({
        valid: false,
        reason: "CAMERA_ERROR",
        message: err instanceof Error ? err.message : "Could not access camera"
      });
      setStatus("error");
    }
  }, [tick]);

  useEffect(() => {
    if (cameraActive && !processing) {
      animFrameRef.current = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [cameraActive, processing, tick]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const canScan = !!selectedEventId && !!gateId && gates.length > 0;

  const statusColor =
    status === "success"
      ? "border-green-400 bg-green-50"
      : status === "error"
        ? "border-red-400 bg-red-50"
        : "border-slate-300 bg-slate-900";

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      {/* Camera feed */}
      <DataPanel title="Camera" description="Point at attendee QR code to scan.">
        <div className="space-y-4">
          {/* Event selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Event</label>
            <select
              value={selectedEventId}
              onChange={(e) => {
                setSelectedEventId(e.target.value);
                if (cameraActive) stopCamera();
              }}
              disabled={eventsLoading}
              className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">
                {eventsLoading
                  ? "Loading events…"
                  : events.length === 0
                    ? "No active events"
                    : "Select event"}
              </option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} — {e.city}
                </option>
              ))}
            </select>
          </div>

          {/* Gate selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Gate</label>
            <select
              value={gateId}
              onChange={(e) => setGateId(e.target.value)}
              disabled={!selectedEventId || gatesLoading || gates.length === 0}
              className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              {gatesLoading ? (
                <option value="">Loading gates…</option>
              ) : gates.length === 0 ? (
                <option value="">
                  {selectedEventId ? "No active gates for this event" : "Select event first"}
                </option>
              ) : (
                gates.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {g.location ? ` — ${g.location}` : ""}
                  </option>
                ))
              )}
            </select>

            {!cameraActive ? (
              <button
                onClick={() => void startCamera()}
                disabled={!canScan}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Start camera
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="rounded-md bg-slate-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Stop
              </button>
            )}
          </div>

          {/* Guard: no active gates */}
          {selectedEventId && !gatesLoading && gates.length === 0 && (
            <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
              This event has no active gates. Publish the event or contact support.
            </p>
          )}

          <div
            className={`relative overflow-hidden rounded-xl border-2 transition-colors ${statusColor}`}
          >
            <video ref={videoRef} className="w-full rounded-xl" muted playsInline />
            {!cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400">
                <p className="text-sm">
                  {!canScan ? "Select an event and gate to start scanning" : "Camera off"}
                </p>
              </div>
            )}
            {processing && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
                <span className="text-lg font-bold text-white">Verifying…</span>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </DataPanel>

      {/* Result panel */}
      <div className="space-y-4">
        <DataPanel title="Last scan result">
          {lastResult ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <StatusBadge
                  status={lastResult.valid ? "valid" : "failed"}
                  label={lastResult.valid ? "Accepted" : (lastResult.reason ?? "Rejected")}
                />
              </div>
              {lastResult.message && <p className="text-sm text-slate-600">{lastResult.message}</p>}
              {lastResult.ticketId && (
                <p className="font-mono text-xs text-slate-500">token {lastResult.ticketId}</p>
              )}
              {lastResult.checkedInAt && (
                <p className="text-xs text-slate-400">{lastResult.checkedInAt}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No scan yet.</p>
          )}
        </DataPanel>

        <DataPanel title="Session stats">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-400">Event</dt>
              <dd className="font-semibold truncate">{selectedEvent?.title ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Gate</dt>
              <dd className="font-semibold truncate">
                {gates.find((g) => g.id === gateId)?.name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Total scans</dt>
              <dd className="font-semibold">{scanCount}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Gate ID</dt>
              <dd className="font-mono text-xs text-slate-500 truncate">{gateId || "—"}</dd>
            </div>
          </dl>
        </DataPanel>

        {lastRaw && (
          <DataPanel title="Raw QR data">
            <pre className="max-h-48 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-600 whitespace-pre-wrap break-all">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(lastRaw), null, 2);
                } catch {
                  return lastRaw;
                }
              })()}
            </pre>
          </DataPanel>
        )}
      </div>
    </div>
  );
}
