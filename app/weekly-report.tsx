import { fetchPendingDecisions, fetchWeeklyReport } from "@/lib/api";
import { getCategory } from "@/lib/categories";
import type { Decision } from "@/types/decision";
import type { WeeklyReportResponse } from "@/types/weekly-report";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function safeNumber(v: unknown, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function percent(v: unknown) {
  const n = safeNumber(v);
  const rounded = Number.isInteger(n) ? n : round1(n);
  return `${rounded}%`;
}

function calcRate(count: number, total: number) {
  if (total <= 0) return 0;
  return (count / total) * 100;
}

function formatDeltaInt(n: number, suffix = "") {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}${suffix}`;
}

function formatDeltaRate(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${round1(n)}pp`;
}

function daysFromCreated(createdAt: string) {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diff = now - created;
  if (!Number.isFinite(diff) || diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function WeeklyReportScreen() {
  const [current, setCurrent] = useState<WeeklyReportResponse | null>(null);
  const [previous, setPrevious] = useState<WeeklyReportResponse | null>(null);
  const [oldestPending, setOldestPending] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [weekStart] = useState(() => startOfWeek(new Date()));
  const prevWeekStart = useMemo(() => addDays(weekStart, -7), [weekStart]);

  const load = useCallback(async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const [currentRes, prevRes, pendingList] = await Promise.all([
        fetchWeeklyReport({ weekStart: isoDate(weekStart) }),
        fetchWeeklyReport({ weekStart: isoDate(prevWeekStart) }),
        fetchPendingDecisions().catch(() => null),
      ]);
      setCurrent(currentRes);
      setPrevious(prevRes);
      if (pendingList && pendingList.length > 0) {
        const oldest = pendingList.reduce((acc, d) => {
          if (!acc) return d;
          return new Date(d.createdAt).getTime() <
            new Date(acc.createdAt).getTime()
            ? d
            : acc;
        }, pendingList[0] as Decision);
        setOldestPending(oldest);
      } else {
        setOldestPending(null);
      }
    } catch (e) {
      console.error("fetchWeeklyReport failed:", e);
      setErrorMsg("주간 리포트를 불러오지 못했어요. 아래로 당겨서 다시 시도해보세요.");
    } finally {
      setLoading(false);
    }
  }, [weekStart, prevWeekStart]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {};
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const currentSummary = useMemo(() => {
    const fallbackStart = isoDate(weekStart);
    const fallbackEnd = isoDate(addDays(weekStart, 6));
    const counts = {
      total: safeNumber(current?.counts?.total),
      completed: safeNumber(current?.counts?.completed),
      pending: safeNumber(current?.counts?.pending),
    };
    const resultCounts = {
      positive: safeNumber(current?.resultCounts?.positive),
      negative: safeNumber(current?.resultCounts?.negative),
      neutral: safeNumber(current?.resultCounts?.neutral),
      pending: counts.pending,
    };
    const confidenceRows = [...(current?.confidence?.byLevel ?? [])]
      .map((r) => ({
        confidence: r.confidence,
        total: safeNumber(r.total),
        positiveRate: safeNumber(r.positiveRate),
      }))
      .sort((a, b) => a.confidence - b.confidence);
    const topCategoryName = current?.topCategory
      ? getCategory(current.topCategory.categoryId)?.name ??
        current.topCategory.categoryId
      : null;

    return {
      period: {
        start: current?.period?.start ?? fallbackStart,
        end: current?.period?.end ?? fallbackEnd,
      },
      counts,
      resultCounts,
      confidenceAvg: safeNumber(current?.confidence?.average),
      confidenceRows,
      topCategoryName,
      topCategoryCount: safeNumber(current?.topCategory?.total),
      insight: current?.insight ?? null,
    };
  }, [current, weekStart]);

  const previousSummary = useMemo(() => {
    const fallbackStart = isoDate(prevWeekStart);
    const fallbackEnd = isoDate(addDays(prevWeekStart, 6));
    const counts = {
      total: safeNumber(previous?.counts?.total),
      completed: safeNumber(previous?.counts?.completed),
      pending: safeNumber(previous?.counts?.pending),
    };
    const resultCounts = {
      positive: safeNumber(previous?.resultCounts?.positive),
      negative: safeNumber(previous?.resultCounts?.negative),
      neutral: safeNumber(previous?.resultCounts?.neutral),
      pending: counts.pending,
    };
    const confidenceRows = [...(previous?.confidence?.byLevel ?? [])]
      .map((r) => ({
        confidence: r.confidence,
        total: safeNumber(r.total),
        positiveRate: safeNumber(r.positiveRate),
      }))
      .sort((a, b) => a.confidence - b.confidence);
    const topCategoryName = previous?.topCategory
      ? getCategory(previous.topCategory.categoryId)?.name ??
        previous.topCategory.categoryId
      : null;

    return {
      period: {
        start: previous?.period?.start ?? fallbackStart,
        end: previous?.period?.end ?? fallbackEnd,
      },
      counts,
      resultCounts,
      confidenceAvg: safeNumber(previous?.confidence?.average),
      confidenceRows,
      topCategoryName,
      topCategoryCount: safeNumber(previous?.topCategory?.total),
      insight: previous?.insight ?? null,
    };
  }, [previous, prevWeekStart]);

  const delta = useMemo(() => {
    if (!currentSummary || !previousSummary) return null;
    const countDelta = {
      total: currentSummary.counts.total - previousSummary.counts.total,
      completed:
        currentSummary.counts.completed - previousSummary.counts.completed,
      pending: currentSummary.counts.pending - previousSummary.counts.pending,
    };
    const resultDelta = {
      positive:
        currentSummary.resultCounts.positive -
        previousSummary.resultCounts.positive,
      negative:
        currentSummary.resultCounts.negative -
        previousSummary.resultCounts.negative,
      neutral:
        currentSummary.resultCounts.neutral -
        previousSummary.resultCounts.neutral,
      pending:
        currentSummary.resultCounts.pending -
        previousSummary.resultCounts.pending,
    };
    const resultRateDelta = {
      positive:
        calcRate(
          currentSummary.resultCounts.positive,
          currentSummary.counts.total
        ) -
        calcRate(
          previousSummary.resultCounts.positive,
          previousSummary.counts.total
        ),
      negative:
        calcRate(
          currentSummary.resultCounts.negative,
          currentSummary.counts.total
        ) -
        calcRate(
          previousSummary.resultCounts.negative,
          previousSummary.counts.total
        ),
      neutral:
        calcRate(
          currentSummary.resultCounts.neutral,
          currentSummary.counts.total
        ) -
        calcRate(
          previousSummary.resultCounts.neutral,
          previousSummary.counts.total
        ),
      pending:
        calcRate(
          currentSummary.resultCounts.pending,
          currentSummary.counts.total
        ) -
        calcRate(
          previousSummary.resultCounts.pending,
          previousSummary.counts.total
        ),
    };
    const confidenceDelta = {
      average: currentSummary.confidenceAvg - previousSummary.confidenceAvg,
    };
    const levels = [1, 2, 3, 4, 5] as const;
    const confidenceLevelDelta = levels.map((level) => {
      const cur = currentSummary.confidenceRows.find(
        (r) => r.confidence === level
      );
      const prev = previousSummary.confidenceRows.find(
        (r) => r.confidence === level
      );
      const curTotal = safeNumber(cur?.total);
      const prevTotal = safeNumber(prev?.total);
      const curRate = safeNumber(cur?.positiveRate);
      const prevRate = safeNumber(prev?.positiveRate);
      return {
        confidence: level,
        totalDelta: curTotal - prevTotal,
        positiveRateDelta: curRate - prevRate,
      };
    });

    return {
      countDelta,
      resultDelta,
      resultRateDelta,
      confidenceDelta,
      confidenceLevelDelta,
    };
  }, [currentSummary, previousSummary]);

  if (loading && !current) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.muted}>주간 리포트 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#ffffff"
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>주간 리포트</Text>
        <Text style={styles.subtitle}>이번 주 판단을 요약해서 보여줘요</Text>
      </View>

      {!!errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>이번 주 요약</Text>
        <View style={styles.rangePill}>
          <Text style={styles.rangeText}>
            {formatDate(currentSummary.period.start)} -{" "}
            {formatDate(currentSummary.period.end)}
          </Text>
        </View>
        <View style={styles.grid3}>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>기록 수</Text>
            <Text style={styles.miniValue}>{currentSummary.counts.total}</Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>완료</Text>
            <Text style={styles.miniValue}>
              {currentSummary.counts.completed}
            </Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>미완료</Text>
            <Text style={styles.miniValue}>{currentSummary.counts.pending}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>결과 분포</Text>
        <View style={styles.gridWrap}>
          <View style={[styles.miniCard, styles.miniCardWrap]}>
            <Text style={styles.miniLabel}>긍정</Text>
            <Text style={styles.miniValue}>
              {currentSummary.resultCounts.positive}
            </Text>
          </View>
          <View style={[styles.miniCard, styles.miniCardWrap]}>
            <Text style={styles.miniLabel}>부정</Text>
            <Text style={styles.miniValue}>
              {currentSummary.resultCounts.negative}
            </Text>
          </View>
          <View style={[styles.miniCard, styles.miniCardWrap]}>
            <Text style={styles.miniLabel}>중립</Text>
            <Text style={styles.miniValue}>
              {currentSummary.resultCounts.neutral}
            </Text>
          </View>
          <View style={[styles.miniCard, styles.miniCardWrap]}>
            <Text style={styles.miniLabel}>미완료</Text>
            <Text style={styles.miniValue}>
              {currentSummary.resultCounts.pending}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>확신도</Text>
        <View style={styles.rowCard}>
          <Text style={styles.rowSub}>평균 확신도</Text>
          <Text style={styles.rowTitle}>{currentSummary.confidenceAvg}</Text>
        </View>

        {currentSummary.confidenceRows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.muted}>확신도 통계가 아직 없어요.</Text>
          </View>
        ) : (
          <View style={styles.confList}>
            {currentSummary.confidenceRows.map((c) => (
              <View key={c.confidence} style={styles.confRow}>
                <Text style={styles.confLeft}>확신도 {c.confidence}</Text>
                <Text style={styles.confRight}>
                  {c.total}건 · {percent(c.positiveRate)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>가장 많이 쓴 카테고리</Text>
        {currentSummary.topCategoryName ? (
          <View style={styles.rowCard}>
            <Text style={styles.rowTitle}>{currentSummary.topCategoryName}</Text>
            <Text style={styles.rowSub}>
              {currentSummary.topCategoryCount}건
            </Text>
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.muted}>이번 주 카테고리 기록이 없어요.</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>경고</Text>
        {oldestPending ? (
          <View style={styles.rowCard}>
            <Text style={styles.rowTitle}>가장 오래된 미완료가 있어요</Text>
            <Text style={styles.rowSub}>
              {getCategory(oldestPending.categoryId)?.name ??
                oldestPending.categoryId}{" "}
              · {formatDate(oldestPending.createdAt)} · D+
              {daysFromCreated(oldestPending.createdAt)}
            </Text>
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.muted}>미완료 경고가 없어요.</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>한 줄 인사이트</Text>
        <View style={styles.rowCard}>
          <Text style={styles.insightText}>
            {currentSummary.insight ?? "아직 인사이트가 없어요."}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>전주 요약</Text>
        <View style={styles.rangePill}>
          <Text style={styles.rangeText}>
            {formatDate(previousSummary.period.start)} -{" "}
            {formatDate(previousSummary.period.end)}
          </Text>
        </View>
        <View style={styles.grid3}>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>기록 수</Text>
            <Text style={styles.miniValue}>{previousSummary.counts.total}</Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>완료</Text>
            <Text style={styles.miniValue}>
              {previousSummary.counts.completed}
            </Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>미완료</Text>
            <Text style={styles.miniValue}>
              {previousSummary.counts.pending}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>전주 결과 분포</Text>
        <View style={styles.gridWrap}>
          <View style={[styles.miniCard, styles.miniCardWrap]}>
            <Text style={styles.miniLabel}>긍정</Text>
            <Text style={styles.miniValue}>
              {previousSummary.resultCounts.positive}
            </Text>
          </View>
          <View style={[styles.miniCard, styles.miniCardWrap]}>
            <Text style={styles.miniLabel}>부정</Text>
            <Text style={styles.miniValue}>
              {previousSummary.resultCounts.negative}
            </Text>
          </View>
          <View style={[styles.miniCard, styles.miniCardWrap]}>
            <Text style={styles.miniLabel}>중립</Text>
            <Text style={styles.miniValue}>
              {previousSummary.resultCounts.neutral}
            </Text>
          </View>
          <View style={[styles.miniCard, styles.miniCardWrap]}>
            <Text style={styles.miniLabel}>미완료</Text>
            <Text style={styles.miniValue}>
              {previousSummary.resultCounts.pending}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>전주 확신도</Text>
        <View style={styles.rowCard}>
          <Text style={styles.rowSub}>평균 확신도</Text>
          <Text style={styles.rowTitle}>{previousSummary.confidenceAvg}</Text>
        </View>

        {previousSummary.confidenceRows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.muted}>확신도 통계가 아직 없어요.</Text>
          </View>
        ) : (
          <View style={styles.confList}>
            {previousSummary.confidenceRows.map((c) => (
              <View key={c.confidence} style={styles.confRow}>
                <Text style={styles.confLeft}>확신도 {c.confidence}</Text>
                <Text style={styles.confRight}>
                  {c.total}건 · {percent(c.positiveRate)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>전주 상위 카테고리</Text>
        {previousSummary.topCategoryName ? (
          <View style={styles.rowCard}>
            <Text style={styles.rowTitle}>
              {previousSummary.topCategoryName}
            </Text>
            <Text style={styles.rowSub}>
              {previousSummary.topCategoryCount}건
            </Text>
          </View>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.muted}>전주 카테고리 기록이 없어요.</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>변화</Text>
        <View style={styles.deltaList}>
          <View style={styles.deltaRow}>
            <Text style={styles.deltaLeft}>기록 수</Text>
            <Text style={styles.deltaRight}>
              {formatDeltaInt(delta?.countDelta.total ?? 0, "건")}
            </Text>
          </View>
          <View style={styles.deltaRow}>
            <Text style={styles.deltaLeft}>완료</Text>
            <Text style={styles.deltaRight}>
              {formatDeltaInt(delta?.countDelta.completed ?? 0, "건")}
            </Text>
          </View>
          <View style={styles.deltaRow}>
            <Text style={styles.deltaLeft}>미완료</Text>
            <Text style={styles.deltaRight}>
              {formatDeltaInt(delta?.countDelta.pending ?? 0, "건")}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionSubtitle}>결과 분포 변화</Text>
        <View style={styles.deltaList}>
          <View style={styles.deltaRow}>
            <Text style={styles.deltaLeft}>긍정</Text>
            <Text style={styles.deltaRight}>
              {formatDeltaInt(delta?.resultDelta.positive ?? 0, "건")} ·{" "}
              {formatDeltaRate(delta?.resultRateDelta.positive ?? 0)}
            </Text>
          </View>
          <View style={styles.deltaRow}>
            <Text style={styles.deltaLeft}>부정</Text>
            <Text style={styles.deltaRight}>
              {formatDeltaInt(delta?.resultDelta.negative ?? 0, "건")} ·{" "}
              {formatDeltaRate(delta?.resultRateDelta.negative ?? 0)}
            </Text>
          </View>
          <View style={styles.deltaRow}>
            <Text style={styles.deltaLeft}>중립</Text>
            <Text style={styles.deltaRight}>
              {formatDeltaInt(delta?.resultDelta.neutral ?? 0, "건")} ·{" "}
              {formatDeltaRate(delta?.resultRateDelta.neutral ?? 0)}
            </Text>
          </View>
          <View style={styles.deltaRow}>
            <Text style={styles.deltaLeft}>미완료</Text>
            <Text style={styles.deltaRight}>
              {formatDeltaInt(delta?.resultDelta.pending ?? 0, "건")} ·{" "}
              {formatDeltaRate(delta?.resultRateDelta.pending ?? 0)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionSubtitle}>확신도 변화</Text>
        <View style={styles.deltaList}>
          <View style={styles.deltaRow}>
            <Text style={styles.deltaLeft}>평균 확신도</Text>
            <Text style={styles.deltaRight}>
              {formatDeltaInt(round1(delta?.confidenceDelta.average ?? 0))}
            </Text>
          </View>
          {(delta?.confidenceLevelDelta ?? []).map((row) => (
            <View key={row.confidence} style={styles.deltaRow}>
              <Text style={styles.deltaLeft}>확신도 {row.confidence}</Text>
              <Text style={styles.deltaRight}>
                {formatDeltaInt(row.totalDelta, "건")} ·{" "}
                {formatDeltaRate(row.positiveRateDelta)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  content: { padding: 16, paddingBottom: 36 },
  center: { alignItems: "center", justifyContent: "center" },

  header: { marginBottom: 10 },
  title: { color: "white", fontWeight: "900", fontSize: 20 },
  subtitle: { color: "#94a3b8", fontWeight: "700", marginTop: 6 },

  rangePill: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
  },
  rangeText: { color: "#cbd5f5", fontWeight: "800" },

  section: { marginTop: 18 },
  sectionTitle: { color: "#cbd5f5", fontWeight: "900", fontSize: 15 },
  sectionSubtitle: {
    color: "#94a3b8",
    fontWeight: "800",
    fontSize: 13,
    marginTop: 12,
  },

  grid3: { flexDirection: "row", gap: 10, marginTop: 10 },
  gridWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 10 },

  miniCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
  },
  miniLabel: { color: "#94a3b8", fontWeight: "800" },
  miniValue: {
    color: "white",
    fontWeight: "900",
    fontSize: 18,
    marginTop: 8,
  },
  miniCardWrap: {
    flexBasis: "48%",
    flexGrow: 1,
  },

  rowCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#0b1220",
    backgroundColor: "#0b1220",
  },
  rowTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  rowSub: { color: "#94a3b8", fontWeight: "700", marginTop: 8 },

  confList: { gap: 8, marginTop: 10 },
  confRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0b1220",
    backgroundColor: "#0b1220",
  },
  confLeft: { color: "#cbd5f5", fontWeight: "800" },
  confRight: { color: "white", fontWeight: "900" },

  insightText: { color: "#e2e8f0", fontWeight: "700", lineHeight: 20 },

  muted: { color: "#94a3b8", fontWeight: "700" },
  emptyBox: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#0b1220",
    backgroundColor: "#0b1220",
  },

  errorBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    backgroundColor: "#111827",
  },
  errorText: { color: "#fecaca", fontWeight: "800" },

  deltaList: { marginTop: 10, gap: 8 },
  deltaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0b1220",
    backgroundColor: "#0b1220",
  },
  deltaLeft: { color: "#cbd5f5", fontWeight: "800" },
  deltaRight: { color: "white", fontWeight: "900" },
});
