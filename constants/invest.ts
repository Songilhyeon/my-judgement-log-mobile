import type { MarketCondition } from "@/types/decision";

export const MARKET_CONDITIONS: { id: MarketCondition; label: string }[] = [
  { id: "bull", label: "상승장" },
  { id: "bear", label: "하락장" },
  { id: "sideways", label: "횡보장" },
  { id: "uncertain", label: "불확실" },
];

export function getMarketConditionLabel(id?: string) {
  if (!id) return "미지정";
  return MARKET_CONDITIONS.find((c) => c.id === id)?.label ?? id;
}
