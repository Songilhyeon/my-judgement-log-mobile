// types/category.ts
export type DecisionResult = "pending" | "positive" | "negative" | "neutral";

export type ResultLabels = {
  positive: string;
  negative: string;
  neutral: string;
};

export type Category = {
  id: string; // "invest" | "health" ...
  name: string; // "투자" ...
  icon?: string; // optional (나중)
  color?: string; // optional (나중)
  resultLabels: ResultLabels;
};
