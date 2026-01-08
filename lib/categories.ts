// lib/categories.ts
import type { Category, ResultLabels } from "@/types/category";

export const CATEGORIES: Category[] = [
  {
    id: "invest",
    name: "투자",
    resultLabels: { positive: "승", negative: "패", neutral: "본전" },
  },
  {
    id: "health",
    name: "건강",
    resultLabels: { positive: "성공", negative: "실패", neutral: "부분 성공" },
  },
  {
    id: "study",
    name: "학습",
    resultLabels: { positive: "잘 됨", negative: "안 됨", neutral: "보통" },
  },
  {
    id: "shopping",
    name: "쇼핑",
    resultLabels: { positive: "만족", negative: "후회", neutral: "애매" },
  },
  {
    id: "career",
    name: "커리어",
    resultLabels: { positive: "좋았음", negative: "별로", neutral: "모르겠음" },
  },
  {
    id: "daily",
    name: "일상",
    resultLabels: {
      positive: "좋은 선택",
      negative: "나쁜 선택",
      neutral: "그냥 그랬음",
    },
  },
  {
    id: "relationship",
    name: "인간관계",
    resultLabels: { positive: "좋았음", negative: "불편했음", neutral: "애매" },
  },
];

const DEFAULT_LABELS: ResultLabels = {
  positive: "긍정",
  negative: "부정",
  neutral: "중립",
};

export function getCategory(categoryId: string | undefined) {
  return CATEGORIES.find((c) => c.id === categoryId);
}

export function getResultLabels(categoryId: string | undefined): ResultLabels {
  return getCategory(categoryId)?.resultLabels ?? DEFAULT_LABELS;
}
