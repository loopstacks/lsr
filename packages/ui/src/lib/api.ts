import type { LoopDef, LoopResult } from "./types";

const BASE = ""; // same-origin — vite dev proxy handles /api, prod serves both

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = (body as { error?: string }).error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: (): Promise<{ status: string; version: string; backends: string[]; loops: number }> =>
    request("/api/health"),

  listLoops: (): Promise<{ loops: LoopDef[] }> => request("/api/loops"),

  getLoop: (id: string): Promise<LoopDef> => request(`/api/loops/${id}`),

  saveLoop: (def: LoopDef): Promise<{ ok: boolean; id: string }> =>
    request("/api/loops", { method: "POST", body: JSON.stringify(def) }),

  deleteLoop: (id: string): Promise<{ ok: boolean }> =>
    request(`/api/loops/${id}`, { method: "DELETE" }),

  run: (loopId: string, input: Record<string, unknown>): Promise<LoopResult> =>
    request("/api/runs", { method: "POST", body: JSON.stringify({ loopId, input }) }),

  listRuns: (): Promise<{ runs: LoopResult[] }> => request("/api/runs"),

  getRun: (callId: string): Promise<LoopResult> => request(`/api/runs/${callId}`),

  listBackends: (): Promise<{ backends: string[] }> => request("/api/backends"),
};
