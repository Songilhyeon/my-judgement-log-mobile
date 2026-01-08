// app/index.tsx
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { fetchPendingDecisions, getDecisions } from "@/lib/api";
import { CATEGORIES, getCategory, getResultLabels } from "@/lib/categories";
import type { Decision } from "@/types/decision";

type CategoryFilter = "all" | string;

function formatDate(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function resultBadgeText(d: Decision) {
  if (d.result === "pending") return "미완료";
  const labels = getResultLabels(d.categoryId);
  if (d.result === "positive") return labels.positive;
  if (d.result === "negative") return labels.negative;
  return labels.neutral;
}

function daysFromCreated(createdAt: string) {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diff = now - created;
  if (!Number.isFinite(diff) || diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function includesText(v: unknown, q: string) {
  if (!q) return true;
  if (typeof v !== "string") return false;
  return v.toLowerCase().includes(q);
}

export default function HomeScreen() {
  const [all, setAll] = useState<Decision[]>([]);
  const [pending, setPending] = useState<Decision[]>([]);
  const [filter, setFilter] = useState<CategoryFilter>("all");

  const [query, setQuery] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    const [allList, pendingList] = await Promise.all([
      getDecisions(),
      fetchPendingDecisions(),
    ]);
    setAll(allList ?? []);
    setPending(pendingList ?? []);
  }, []);

  // 화면 진입/복귀 시마다 최신 데이터
  useFocusEffect(
    useCallback(() => {
      let alive = true;

      (async () => {
        try {
          if (alive) setInitialLoading(true);
          await load();
        } catch (e) {
          console.error("load failed:", e);
          if (alive)
            setLoadError("데이터를 불러오지 못했어요. 새로고침 해주세요.");
        } finally {
          if (alive) setInitialLoading(false);
        }
      })();

      return () => {
        alive = false;
      };
    }, [load])
  );

  const pendingCount = pending.length;
  const completedCount = Math.max(0, all.length - pending.length);

  // 가장 오래된 pending
  const oldestPending = useMemo(() => {
    if (pending.length === 0) return null;
    let oldest = pending[0];
    for (const d of pending) {
      if (
        new Date(d.createdAt).getTime() < new Date(oldest.createdAt).getTime()
      )
        oldest = d;
    }
    return oldest;
  }, [pending]);

  const maxPendingDays = useMemo(() => {
    if (!oldestPending) return 0;
    return daysFromCreated(oldestPending.createdAt);
  }, [oldestPending]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    // 1) 카테고리 필터
    let base =
      filter === "all" ? all : all.filter((d) => d.categoryId === filter);

    // 2) 미완료만 보기
    if (onlyPending) {
      base = base.filter((d) => d.result === "pending");
    }

    // 3) 검색(제목 + 노트 + 태그)
    if (q) {
      base = base.filter((d) => {
        const hitTitle = includesText(d.title, q);
        const hitNotes = includesText(d.notes, q);
        const hitTags =
          Array.isArray(d.tags) &&
          d.tags.some((t) => (t ?? "").toLowerCase().includes(q));
        return hitTitle || hitNotes || hitTags;
      });
    }

    // 4) pending 먼저
    const p = base.filter((d) => d.result === "pending");
    const done = base.filter((d) => d.result !== "pending");
    return [...p, ...done];
  }, [all, filter, onlyPending, query]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } catch (e) {
      console.error("refresh failed:", e);
      setLoadError("새로고침에 실패했어요. 네트워크를 확인해주세요.");
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const openRecord = () => {
    router.push("/record");
  };

  const openAnalysis = () => {
    router.push("/analysis");
  };

  // pending → outcome / 완료 → detail
  const openItem = (d: Decision) => {
    if (d.result === "pending") {
      router.push({
        pathname: "/outcome",
        params: { id: d.id, categoryId: d.categoryId },
      });
    } else {
      router.push({
        pathname: "/detail",
        params: { id: d.id },
      });
    }
  };

  // 배너 클릭: 가장 오래된 pending으로 바로 이동
  const openOldestPending = useCallback(() => {
    if (!oldestPending) return;
    router.push({
      pathname: "/outcome",
      params: { id: oldestPending.id, categoryId: oldestPending.categoryId },
    });
  }, [oldestPending]);

  const clearQuery = () => setQuery("");

  const renderItem = ({ item }: { item: Decision }) => {
    const category = getCategory(item.categoryId);
    const badge = resultBadgeText(item);

    const days =
      item.result === "pending" ? daysFromCreated(item.createdAt) : null;

    return (
      <Pressable style={styles.card} onPress={() => openItem(item)}>
        <View style={styles.cardTop}>
          <Text style={styles.category}>
            {category?.name ?? item.categoryId}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {days !== null && days > 0 && (
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>D+{days}</Text>
              </View>
            )}

            <View
              style={[
                styles.badge,
                item.result === "pending"
                  ? styles.badgePending
                  : styles.badgeDone,
              ]}
            >
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>

        {!!item.notes && (
          <Text style={styles.cardNotes} numberOfLines={2}>
            {item.notes}
          </Text>
        )}

        <View style={styles.cardBottom}>
          <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          <Text style={styles.confidence}>확신도 {item.confidence}</Text>
        </View>

        {Array.isArray(item.tags) && item.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {item.tags.slice(0, 4).map((t, i) => (
              <View key={`${t}-${i}`} style={styles.tag}>
                <Text style={styles.tagText}>#{t}</Text>
              </View>
            ))}
            {item.tags.length > 4 && (
              <Text style={styles.moreTag}>+{item.tags.length - 4}</Text>
            )}
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* 상단 헤더 */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.sub}>
            미완료 <Text style={styles.subStrong}>{pendingCount}</Text> · 완료{" "}
            <Text style={styles.subStrong}>{completedCount}</Text>
          </Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable style={styles.secondaryBtn} onPress={openAnalysis}>
            <Text style={styles.secondaryBtnText}>분석</Text>
          </Pressable>

          <Pressable style={styles.primaryBtn} onPress={openRecord}>
            <Text style={styles.primaryBtnText}>기록하기</Text>
          </Pressable>
        </View>
      </View>

      {/* 검색 + 토글 */}
      <View style={styles.searchWrap}>
        <View style={styles.searchInputWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="제목/노트/태그 검색"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
          />
          {!!query && (
            <Pressable
              style={styles.clearBtn}
              onPress={clearQuery}
              hitSlop={10}
            >
              <Text style={styles.clearBtnText}>✕</Text>
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.toggleChip, onlyPending && styles.toggleChipActive]}
          onPress={() => setOnlyPending((v) => !v)}
          hitSlop={10}
        >
          <Text
            style={[
              styles.toggleChipText,
              onlyPending && styles.toggleChipTextActive,
            ]}
          >
            미완료만
          </Text>
        </Pressable>
      </View>

      {/* 로드 에러 배너 */}
      {!!loadError && (
        <Pressable style={styles.errorBanner} onPress={onRefresh}>
          <Text style={styles.errorBannerText}>{loadError}</Text>
          <Text style={styles.errorBannerCta}>탭해서 새로고침</Text>
        </Pressable>
      )}

      {/* 상단 pending 배너 */}
      {oldestPending && (
        <Pressable style={styles.pendingBanner} onPress={openOldestPending}>
          <View style={styles.pendingBannerTop}>
            <Text style={styles.pendingBannerTitle}>
              ⏰ 아직 결과를 기다리는 판단이 있어요
            </Text>
            <View style={styles.pendingBannerPill}>
              <Text style={styles.pendingBannerPillText}>
                D+{maxPendingDays}
              </Text>
            </View>
          </View>

          <Text style={styles.pendingBannerSub}>
            {pendingCount}건 · 가장 오래된 미완료:{" "}
            {getCategory(oldestPending.categoryId)?.name ??
              oldestPending.categoryId}
            {" · "}
            {formatDate(oldestPending.createdAt)}
          </Text>

          <Text style={styles.pendingBannerCta}>결과 입력하러 가기 →</Text>
        </Pressable>
      )}

      {/* 카테고리 필터 */}
      <View style={styles.chipsWrap}>
        <Pressable
          style={[styles.chip, filter === "all" && styles.chipActive]}
          onPress={() => setFilter("all")}
        >
          <Text
            style={[styles.chipText, filter === "all" && styles.chipTextActive]}
          >
            전체
          </Text>
        </Pressable>

        {CATEGORIES.map((c) => {
          const active = filter === c.id;
          return (
            <Pressable
              key={c.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(c.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 최초 로딩 */}
      {initialLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
          <Text style={styles.loadingText}>불러오는 중…</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(d) => d.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={{ paddingTop: 40, alignItems: "center" }}>
              <Text style={{ color: "#94a3b8" }}>
                {query || onlyPending || filter !== "all"
                  ? "조건에 맞는 기록이 없어요."
                  : "아직 기록이 없어요. “기록하기”로 시작해보세요."}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

/* ✅ 아래 styles는 네 기존 styles에 secondaryBtn/secondaryBtnText만 추가하면 돼 */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617", paddingHorizontal: 16 },

  topBar: {
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  sub: { color: "#cbd5f5", marginTop: 4, fontWeight: "700" },
  subStrong: { color: "white" },

  primaryBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  primaryBtnText: { color: "white", fontWeight: "900" },

  secondaryBtn: {
    backgroundColor: "#0b1220",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryBtnText: { color: "#cbd5f5", fontWeight: "900" },

  // 이하 styles는 네 기존 그대로 사용
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  searchInputWrap: { flex: 1, position: "relative" },
  searchInput: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    paddingRight: 34,
    color: "white",
    backgroundColor: "#0b1220",
    fontWeight: "800",
  },
  clearBtn: {
    position: "absolute",
    right: 10,
    top: 9,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#334155",
  },
  clearBtnText: { color: "#cbd5f5", fontWeight: "900" },

  toggleChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
  },
  toggleChipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  toggleChipText: { color: "#cbd5f5", fontWeight: "900" },
  toggleChipTextActive: { color: "white" },

  errorBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#7f1d1d",
    backgroundColor: "#0b1220",
    padding: 12,
    marginBottom: 10,
  },
  errorBannerText: { color: "#fecaca", fontWeight: "900" },
  errorBannerCta: { color: "#fca5a5", fontWeight: "900", marginTop: 6 },

  pendingBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    backgroundColor: "#0b1220",
    padding: 14,
    marginBottom: 10,
  },
  pendingBannerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  pendingBannerTitle: { color: "white", fontWeight: "900" },
  pendingBannerSub: { color: "#cbd5f5", marginTop: 8, fontWeight: "700" },
  pendingBannerCta: { color: "#60a5fa", marginTop: 10, fontWeight: "900" },
  pendingBannerPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#334155",
  },
  pendingBannerPillText: { color: "white", fontWeight: "900", fontSize: 12 },

  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#0b1220",
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
  },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { color: "#cbd5f5", fontWeight: "800" },
  chipTextActive: { color: "white" },

  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 24,
  },
  loadingText: { color: "#94a3b8", fontWeight: "800", marginTop: 10 },

  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0b1220",
    backgroundColor: "#0b1220",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  category: { color: "#cbd5f5", fontWeight: "800" },

  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgePending: { backgroundColor: "#111827", borderColor: "#334155" },
  badgeDone: { backgroundColor: "#1d4ed8", borderColor: "#1d4ed8" },
  badgeText: { color: "white", fontWeight: "900", fontSize: 12 },

  cardTitle: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
    marginTop: 10,
  },
  cardNotes: { color: "#cbd5f5", marginTop: 6, lineHeight: 18 },

  cardBottom: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: { color: "#94a3b8", fontWeight: "700" },
  confidence: { color: "#94a3b8", fontWeight: "700" },

  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#020617",
  },
  tagText: { color: "#cbd5f5", fontWeight: "800", fontSize: 12 },
  moreTag: { color: "#94a3b8", fontWeight: "800" },

  dayBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  dayBadgeText: { color: "#fbbf24", fontWeight: "900", fontSize: 12 },
});
