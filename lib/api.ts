// lib/api.ts
import type {
  AnalysisResponse,
  AnalysisSummaryResponse,
} from "@/types/analysis";
import type { CreateDecisionPayload, Decision } from "@/types/decision";

// ✅ RN(실기기)에서는 localhost가 안 먹는 경우가 많아서 env 기반 추천
// - Expo: EXPO_PUBLIC_API_URL 사용 권장
// - 예: EXPO_PUBLIC_API_URL=http://192.168.0.10:3000
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const USER_ID = process.env.EXPO_PUBLIC_USER_ID ?? "dev-user";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      // ✅ env 기반 USER_ID 사용
      "x-user-id": USER_ID,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {}
    throw new Error(`API Error ${res.status}: ${detail || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ✅ createDecision만 남기고 saveDecision 제거 (중복)
export async function createDecision(
  payload: CreateDecisionPayload
): Promise<Decision> {
  return request<Decision>("/api/decisions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getDecisions(): Promise<Decision[]> {
  return request<Decision[]>("/api/decisions");
}

// ✅ 결과 입력 payload: 공통 결과(positive/negative/neutral)
// (pending은 보통 PATCH에서 안 보냄)
export type UpdateDecisionResultPayload = {
  result: "pending" | "positive" | "negative" | "neutral";
  confidence: number;
};

export async function updateDecisionResult(
  id: string,
  payload: UpdateDecisionResultPayload
): Promise<Decision> {
  return request<Decision>(`/api/decisions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** =========================
 *  Analysis
 *  ========================= */

export async function fetchAnalysis(): Promise<AnalysisResponse> {
  return request<AnalysisResponse>("/api/analysis");
}

export type PendingDecisionsResponse = Decision[];
export async function fetchPendingDecisions(): Promise<PendingDecisionsResponse> {
  return request<PendingDecisionsResponse>("/api/analysis/pending");
}

export async function getDecision(id: string): Promise<Decision> {
  return request<Decision>(`/api/decisions/${id}`);
}

export type UpdateDecisionPayload = {
  categoryId?: string;
  title?: string;
  notes?: string | null;
  tags?: string[];
  confidence?: number;
  meta?: Decision["meta"] | null;
};

export async function updateDecision(
  id: string,
  payload: UpdateDecisionPayload
): Promise<Decision> {
  return request<Decision>(`/api/decisions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteDecision(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/decisions/${id}`, {
    method: "DELETE",
  });
}

export async function fetchAnalysisSummary(params?: {
  days?: number;
  categoryId?: string;
  limit?: number;
}): Promise<AnalysisSummaryResponse> {
  const qs = new URLSearchParams();
  if (params?.days) qs.set("days", String(params.days));
  if (params?.categoryId) qs.set("categoryId", params.categoryId);
  if (params?.limit) qs.set("limit", String(params.limit));

  const path = `/api/analysis/summary${qs.toString() ? `?${qs}` : ""}`;

  // ✅ request() 사용 -> x-user-id 자동 포함 + 에러 처리도 동일
  return request<AnalysisSummaryResponse>(path, { method: "GET" });
}
