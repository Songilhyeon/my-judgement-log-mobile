// app/analysis.tsx
import { fetchAnalysisSummary } from "@/lib/api";
import { CATEGORIES, getResultLabels } from "@/lib/categories";
import type { AnalysisSummaryResponse } from "@/types/analysis";
import type { DecisionResult } from "@/types/category";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

type ActionKey = "buy" | "sell";
type DaysKey = 7 | 30 | 90 | 365;
type RecentLimit = 10 | 30;

const DEFAULT_DAYS: DaysKey = 90;
const DEFAULT_RECENT_LIMIT: RecentLimit = 10;

const DAYS_OPTIONS: { key: DaysKey; label: string }[] = [
  { key: 7, label: "7일" },
  { key: 30, label: "30일" },
  { key: 90, label: "90일" },
  { key: 365, label: "1년" },
];

function getCategoryName(categoryId: string) {
  return CATEGORIES.find((c) => c.id === categoryId)?.name ?? categoryId;
}

function safeNumber(v: unknown, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function percent(v: unknown) {
  const n = safeNumber(v);
  const rounded = Number.isInteger(n) ? n : Math.round(n * 10) / 10;
  return `${rounded}%`;
}

function resultLabel(categoryId: string, result: DecisionResult) {
  if (result === "pending") return "미완료";
  const labels = getResultLabels(categoryId);
  return labels[result];
}

function resultColor(result: DecisionResult) {
  switch (result) {
    case "positive":
      return "#22c55e"; // green
    case "negative":
      return "#ef4444"; // red
    case "neutral":
      return "#eab308"; // yellow
    default:
      return "#94a3b8";
  }
}

export default function AnalysisScreen() {
  const [data, setData] = useState<AnalysisSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [days, setDays] = useState<DaysKey>(DEFAULT_DAYS);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [recentLimit, setRecentLimit] =
    useState<RecentLimit>(DEFAULT_RECENT_LIMIT);

  const goToRecord = useCallback(() => {
    router.push("/record");
  }, []);

  const load = useCallback(async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await fetchAnalysisSummary({
        days,
        categoryId: selectedCategoryId ?? undefined,
        limit: recentLimit,
      });
      setData(res);
    } catch (e) {
      console.error("fetchAnalysisSummary failed:", e);
      setErrorMsg("분석을 불러오지 못했어요. 아래로 당겨서 다시 시도해보세요.");
    } finally {
      setLoading(false);
    }
  }, [days, selectedCategoryId, recentLimit]);

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

  const clearFilters = useCallback(() => {
    setSelectedCategoryId(null);
    setSelectedTag(null);
    setDays(DEFAULT_DAYS);
    setRecentLimit(DEFAULT_RECENT_LIMIT);
  }, []);

  const selectedCategoryName = useMemo(() => {
    return selectedCategoryId ? getCategoryName(selectedCategoryId) : "전체";
  }, [selectedCategoryId]);

  const filterLabel = useMemo(() => {
    const parts: string[] = [];

    parts.push(
      `기간 ${DAYS_OPTIONS.find((x) => x.key === days)?.label ?? `${days}일`}`
    );

    if (selectedCategoryId) {
      parts.push(`카테고리 ${getCategoryName(selectedCategoryId)}`);
    }

    if (selectedTag) {
      parts.push(`태그 #${selectedTag}`);
    }

    parts.push(`최근 ${recentLimit}개`);

    return parts.join(" · ");
  }, [days, selectedCategoryId, selectedTag, recentLimit]);

  const summary = useMemo(() => {
    const s = data?.summary;
    return {
      total: safeNumber(s?.total),
      completed: safeNumber(s?.completed),
      pending: safeNumber(s?.pending),
      winRate: safeNumber(s?.positiveRate),
      avgConfidence: safeNumber(s?.avgConfidenceCompleted),
    };
  }, [data]);

  const resultCounts = useMemo(() => {
    const rc = data?.summary?.resultCounts;
    return {
      positive: safeNumber(rc?.positive),
      negative: safeNumber(rc?.negative),
      neutral: safeNumber(rc?.neutral),
    };
  }, [data]);

  const actionRows = useMemo(() => {
    const by = data?.byAction;
    if (!by) return [];

    const keys: ActionKey[] = ["buy", "sell"];
    return keys.map((k) => {
      const row = by[k];
      return {
        key: k,
        title: k === "buy" ? "BUY" : "SELL",
        total: safeNumber(row?.total),
        positiveRate: safeNumber(row?.positiveRate),
        avgConfidenceCompleted: safeNumber(row?.avgConfidenceCompleted),
      };
    });
  }, [data]);

  const showInvestAction = selectedCategoryId === "invest";

  const confidenceRows = useMemo(() => {
    const arr = data?.confidenceStats ?? [];
    return [...arr]
      .map((x) => ({
        confidence: safeNumber((x as any)?.confidence),
        total: safeNumber((x as any)?.total),
        positiveRate: safeNumber((x as any)?.positiveRate),
      }))
      .sort((a, b) => a.confidence - b.confidence);
  }, [data]);

  const topTags = useMemo(() => {
    return (data?.topTags ?? []).slice(0, 12);
  }, [data]);

  const recentCompleted = useMemo(() => {
    const base = data?.recentCompleted ?? [];
    if (!selectedTag) return base;
    return base.filter(
      (r) => Array.isArray(r.tags) && r.tags.some((t) => t === selectedTag)
    );
  }, [data, selectedTag]);

  if (loading && !data) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.muted}>분석 불러오는 중...</Text>
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
        <Text style={styles.subtitle}>내 판단 기록을 요약해서 보여줘요</Text>
      </View>

      {!!errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* 기간 필터 */}
      <View style={styles.daysRow}>
        {DAYS_OPTIONS.map((opt) => {
          const active = days === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[styles.daysChip, active && styles.daysChipActive]}
              onPress={() => setDays(opt.key)}
              hitSlop={10}
            >
              <Text
                style={[
                  styles.daysChipText,
                  active && styles.daysChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 카테고리 선택 */}
      <View style={styles.categoryRow}>
        <Pressable
          style={[
            styles.categoryChip,
            !selectedCategoryId && styles.categoryChipActive,
          ]}
          onPress={() => setSelectedCategoryId(null)}
          hitSlop={10}
        >
          <Text
            style={[
              styles.categoryChipText,
              !selectedCategoryId && styles.categoryChipTextActive,
            ]}
          >
            전체
          </Text>
        </Pressable>

        {CATEGORIES.map((c) => {
          const active = selectedCategoryId === c.id;
          return (
            <Pressable
              key={c.id}
              style={[styles.categoryChip, active && styles.categoryChipActive]}
              onPress={() => setSelectedCategoryId(c.id)}
              hitSlop={10}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  active && styles.categoryChipTextActive,
                ]}
              >
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 필터 상태 바 (단 1개만 유지) */}
      <View style={styles.filterBar}>
        <Text style={styles.filterBarText} numberOfLines={2}>
          {filterLabel}
        </Text>

        <Pressable
          style={styles.filterClearBtn}
          onPress={clearFilters}
          hitSlop={10}
        >
          <Text style={styles.filterClearText}>초기화</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{selectedCategoryName} 요약</Text>
      </View>

      {/* Summary */}
      <View style={styles.grid2}>
        <View style={styles.cell}>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>총 판단</Text>
            <Text style={styles.miniValue}>{summary.total}</Text>
          </View>
        </View>

        <View style={styles.cell}>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>승률</Text>
            <Text style={styles.miniValue}>{percent(summary.winRate)}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.grid2, { marginTop: 10 }]}>
        <View style={styles.cell}>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>완료됨</Text>
            <Text style={styles.miniValue}>{summary.completed}</Text>
          </View>
        </View>

        <View style={styles.cell}>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>대기중</Text>
            <Text style={styles.miniValue}>{summary.pending}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.grid2, { marginTop: 10 }]}>
        <View style={styles.cell}>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>평균 확신도(완료)</Text>
            <Text style={styles.miniValue}>{summary.avgConfidence}</Text>
          </View>
        </View>

        <View style={styles.cell}>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>최근 기간</Text>
            <Text style={styles.miniValue}>
              {DAYS_OPTIONS.find((x) => x.key === days)?.label ?? `${days}일`}
            </Text>
          </View>
        </View>
      </View>

      {/* CTA */}
      <Pressable style={styles.ctaBtn} onPress={goToRecord} hitSlop={10}>
        <Text style={styles.ctaBtnText}>+ 새 판단 기록하기</Text>
      </Pressable>

      {/* Result distribution */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>결과 분포</Text>
        <View style={styles.grid3}>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>긍정</Text>
            <Text style={styles.miniValue}>{resultCounts.positive}</Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>부정</Text>
            <Text style={styles.miniValue}>{resultCounts.negative}</Text>
          </View>
          <View style={styles.miniCard}>
            <Text style={styles.miniLabel}>중립</Text>
            <Text style={styles.miniValue}>{resultCounts.neutral}</Text>
          </View>
        </View>
      </View>

      {/* Action (invest에서만 의미 있음) */}
      {showInvestAction && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>투자 행동별</Text>

          {actionRows.map((a) => (
            <View key={a.key} style={styles.rowCard}>
              <View style={styles.rowCardTop}>
                <Text style={styles.rowTitle}>{a.title}</Text>
                <View style={styles.pill}>
                  <Text style={styles.pillText}>{percent(a.positiveRate)}</Text>
                </View>
              </View>

              <Text style={styles.rowSub}>
                {a.total}건 · 평균 확신도 {a.avgConfidenceCompleted}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Confidence */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>확신도별 승률</Text>
        {confidenceRows.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.muted}>확신도 통계가 아직 없어요.</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            {confidenceRows.map((c) => (
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

      {/* Top tags */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>자주 쓰는 태그</Text>

        {topTags.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.muted}>태그가 아직 없어요.</Text>
          </View>
        ) : (
          <View style={styles.tagWrap}>
            <Pressable
              style={[
                styles.tagChip,
                selectedTag === null && styles.tagChipActive,
              ]}
              onPress={() => setSelectedTag(null)}
              hitSlop={10}
            >
              <Text
                style={[
                  styles.tagText,
                  selectedTag === null && styles.tagTextActive,
                ]}
              >
                전체
              </Text>
            </Pressable>

            {topTags.map((t) => {
              const active = selectedTag === t.tag;
              return (
                <Pressable
                  key={t.tag}
                  style={[styles.tagChip, active && styles.tagChipActive]}
                  onPress={() => setSelectedTag(t.tag)}
                  hitSlop={10}
                >
                  <Text
                    style={[styles.tagText, active && styles.tagTextActive]}
                  >
                    {t.tag} · {t.count}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      {/* Recent completed */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>최근 완료된 판단</Text>

          <View style={styles.limitRow}>
            <Pressable
              style={[
                styles.limitChip,
                recentLimit === 10 && styles.limitChipActive,
              ]}
              onPress={() => setRecentLimit(10)}
              hitSlop={10}
            >
              <Text
                style={[
                  styles.limitChipText,
                  recentLimit === 10 && styles.limitChipTextActive,
                ]}
              >
                10개
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.limitChip,
                recentLimit === 30 && styles.limitChipActive,
              ]}
              onPress={() => setRecentLimit(30)}
              hitSlop={10}
            >
              <Text
                style={[
                  styles.limitChipText,
                  recentLimit === 30 && styles.limitChipTextActive,
                ]}
              >
                30개
              </Text>
            </Pressable>
          </View>
        </View>

        {recentCompleted.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.muted}>최근 완료된 판단이 없어요.</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {recentCompleted.map((r) => (
              <Pressable
                key={r.id}
                style={styles.rowCard}
                onPress={() =>
                  router.push({ pathname: "/detail", params: { id: r.id } })
                }
              >
                <View style={styles.rowCardTop}>
                  <View style={styles.catChip}>
                    <Text style={styles.catChipText}>
                      {getCategoryName(r.categoryId)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.pill,
                      { borderColor: resultColor(r.result) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        { color: resultColor(r.result) },
                      ]}
                    >
                      {resultLabel(r.categoryId, r.result)}
                    </Text>
                  </View>
                </View>

                {/* 제목 + 회고표시 */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 10,
                  }}
                >
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {r.title}
                  </Text>

                  {r.hasReflection && (
                    <View style={styles.noteChip}>
                      <Text style={styles.noteChipText}>📝</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.rowSub}>
                  확신도 {safeNumber(r.confidence)} ·{" "}
                  {r.resolvedAt ? r.resolvedAt.slice(0, 10) : "-"}
                </Text>

                {Array.isArray(r.tags) && r.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {r.tags.slice(0, 4).map((t, i) => (
                      <View key={`${r.id}-${t}-${i}`} style={styles.tagMini}>
                        <Text style={styles.tagMiniText}>#{t}</Text>
                      </View>
                    ))}
                    {r.tags.length > 4 && (
                      <Text style={styles.moreTag}>+{r.tags.length - 4}</Text>
                    )}
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617" },
  content: { padding: 16, paddingBottom: 36 },
  center: { alignItems: "center", justifyContent: "center" },

  header: { marginBottom: 10 },
  subtitle: { color: "#94a3b8", fontWeight: "700", marginTop: 6 },

  grid2: { flexDirection: "row", gap: 12 },
  grid3: { flexDirection: "row", gap: 10 },
  cell: { flex: 1 },

  section: { marginTop: 18 },
  sectionTitle: {
    color: "#cbd5f5",
    fontWeight: "900",
    fontSize: 15,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionHeaderAction: { color: "#94a3b8", fontWeight: "900" },

  rowCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#0b1220",
    backgroundColor: "#0b1220",
  },
  rowCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowTitle: { color: "white", fontWeight: "900", fontSize: 16 },
  rowSub: { color: "#94a3b8", fontWeight: "700", marginTop: 8 },

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

  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#111827",
  },
  pillText: { color: "#cbd5f5", fontWeight: "900" },

  catChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#020617",
  },
  catChipText: { color: "#cbd5f5", fontWeight: "900" },

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

  muted: { color: "#94a3b8", fontWeight: "700" },
  emptyBox: {
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

  // days
  daysRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  daysChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
  },
  daysChipActive: { backgroundColor: "#111827", borderColor: "#cbd5f5" },
  daysChipText: { color: "#94a3b8", fontWeight: "900" },
  daysChipTextActive: { color: "#cbd5f5" },

  // filter bar
  filterBar: {
    marginTop: 10,
    marginBottom: 6,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  filterBarText: { color: "#cbd5f5", fontWeight: "900", flex: 1 },
  filterClearBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5f5",
    backgroundColor: "#111827",
  },
  filterClearText: { color: "#cbd5f5", fontWeight: "900" },

  // category chips
  categoryRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
    flexWrap: "wrap",
  },
  categoryChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
  },
  categoryChipActive: { backgroundColor: "#111827", borderColor: "#cbd5f5" },
  categoryChipText: { color: "#94a3b8", fontWeight: "900" },
  categoryChipTextActive: { color: "#cbd5f5" },

  // tags
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
  },
  tagChipActive: { borderColor: "#cbd5f5", backgroundColor: "#111827" },
  tagText: { color: "#cbd5f5", fontWeight: "900" },
  tagTextActive: { color: "#cbd5f5" },

  // recent limit
  limitRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  limitChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
  },
  limitChipActive: { borderColor: "#cbd5f5", backgroundColor: "#111827" },
  limitChipText: { color: "#94a3b8", fontWeight: "900" },
  limitChipTextActive: { color: "#cbd5f5" },

  // mini tags in recent cards
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tagMini: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#020617",
  },
  tagMiniText: { color: "#cbd5f5", fontWeight: "900", fontSize: 12 },
  moreTag: { color: "#94a3b8", fontWeight: "900", marginLeft: 4 },

  ctaBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#cbd5f5",
    backgroundColor: "#111827",
    alignItems: "center",
  },
  ctaBtnText: {
    color: "#cbd5f5",
    fontWeight: "900",
    fontSize: 15,
  },

  noteChip: {
    marginTop: 2, // 👈 핵심
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#111827",
  },
  noteChipText: {
    color: "#cbd5f5",
    fontWeight: "900",
    fontSize: 12,
  },
});
