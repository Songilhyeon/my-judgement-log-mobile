export type WeeklyReportSummary = {
  period: {
    start: string;
    end: string;
  };
  counts: {
    total: number;
    completed: number;
    pending: number;
  };
  resultCounts: {
    positive: number;
    negative: number;
    neutral: number;
    pending: number;
  };
  confidence: {
    average: number;
    byLevel: {
      confidence: 1 | 2 | 3 | 4 | 5;
      total: number;
      positiveRate: number;
    }[];
  };
  topCategory: {
    categoryId: string;
    total: number;
  } | null;
  insight: string | null;
};

export type WeeklyReportDelta = {
  counts: {
    total: number;
    completed: number;
    pending: number;
  };
  resultCounts: {
    positive: number;
    negative: number;
    neutral: number;
    pending: number;
  };
  resultRates: {
    positive: number;
    negative: number;
    neutral: number;
    pending: number;
  };
  confidence: {
    average: number;
    byLevel: {
      confidence: 1 | 2 | 3 | 4 | 5;
      total: number;
      positiveRate: number;
    }[];
  };
};

export type WeeklyReportResponse = WeeklyReportSummary & {
  previous?: WeeklyReportSummary;
  delta?: WeeklyReportDelta;
};
