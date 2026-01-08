// types/decision.ts
import type { DecisionResult } from "./category";

export type DecisionMeta = {
  reflection?: string;
  symbol?: string;
  action?: "buy" | "sell";
  [key: string]: string | number | boolean | null | undefined;
};

export type Decision = {
  id: string;
  userId: string;
  categoryId: string; // Category.id
  title: string; // 한 줄 요약
  notes?: string; // 근거/상황
  tags: string[];
  confidence: number; // 1~5
  result: DecisionResult;
  meta?: DecisionMeta; // 투자/쇼핑 등 추가 필드 저장용
  createdAt: string; // ISO
  resolvedAt?: string; // ISO
};

// ✅ 범용 생성 payload: 모든 카테고리 공통
// - result는 생성 시 pending을 권장하지만, 서버에서 강제해도 됨
export type CreateDecisionPayload = {
  categoryId: string;
  title: string;
  notes?: string;
  tags: string[];
  confidence: number;
  result?: DecisionResult; // 보통 "pending"
  meta?: Decision["meta"]; // 투자/쇼핑 등 확장 필드
};
