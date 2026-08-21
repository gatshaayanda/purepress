export type BoardSignalConnectivityState = "online" | "offline" | "checking" | "reconnecting";
export const BOARDSIGNAL_CONNECTIVITY_ENDPOINT = "/api/boardsignal/connectivity";
export const BOARDSIGNAL_RECONNECTED_EVENT = "boardsignal:reconnected";

export async function probeBoardSignalConnectivity(signal?: AbortSignal) {
  const response = await fetch(`${BOARDSIGNAL_CONNECTIVITY_ENDPOINT}?t=${Date.now()}`, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    signal,
    headers: { "Cache-Control": "no-store" },
  });
  return response.status === 204;
}
