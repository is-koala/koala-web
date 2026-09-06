import type { RealtimeConnectionState } from "@/realtime/client";

export function ConnectionStatus({ state }: { state: RealtimeConnectionState }) {
  const text = state.phase === "live"
    ? "Canlı"
    : state.phase === "reconnecting" || state.phase === "connecting"
      ? "Yeniden bağlanıyor"
      : "REST ile güncel";
  return <span className={`connection-status connection-${state.phase}`}>{text}</span>;
}
