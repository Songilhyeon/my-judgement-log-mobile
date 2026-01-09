// app/review.tsx
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { getDecision, getDecisions, updateDecision } from "@/lib/api";
import { getCategory, getResultLabels } from "@/lib/categories";
import type { Decision, DecisionMeta } from "@/types/decision";

type BannerKind = "error" | "info" | "success";

function Banner({
  kind,
  text,
  onClose,
}: {
  kind: BannerKind;
  text: string;
  onClose?: () => void;
}) {
  const style =
    kind === "error"
      ? styles.bannerError
      : kind === "success"
      ? styles.bannerSuccess
      : styles.bannerInfo;

  return (
    <View style={[styles.banner, style]}>
      <Text style={styles.bannerText}>{text}</Text>
      {!!onClose && (
        <Pressable onPress={onClose} style={styles.bannerClose}>
          <Text style={styles.bannerCloseText}>닫기</Text>
        </Pressable>
      )}
    </View>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function safeInt(v: unknown, fallback = 0) {
  return typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : fallback;
}

function clamp1to5(v: number) {
  return Math.max(1, Math.min(5, v));
}

function percent(rate01: number) {
  const n = Math.round(rate01 * 1000) / 10; // 1자리
  return `${n}%`;
}

function isCompleted(d: Decision) {
  return d.result !== "pending";
}

function isPositive(d: Decision) {
  return d.result === "positive";
}

function pillText(d: Decision) {
  if (d.result === "pending") return "미완료";
  const labels = getResultLabels(d.categoryId);
  if (d.result === "positive") return labels.positive;
  if (d.result === "negative") return labels.negative;
  return labels.neutral;
}

function pillStyleByResult(result: Decision["result"]) {
  if (result === "positive") return styles.pillPos;
  if (result === "negative") return styles.pillNeg;
  return styles.pillNeu;
}

// meta 타입이 엄격하지 않아도 안전하게 꺼내기
function getReflection(meta?: DecisionMeta): string {
  return typeof meta?.reflection === "string" ? meta.reflection : "";
}

export default function ReviewScreen() {
  const { id, from } = useLocalSearchParams<{
    id?: string;
    from?: "detail" | "outcome" | "unknown";
  }>();

  const [target, setTarget] = useState<Decision | null>(null);
  const [all, setAll] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // ✅ 한 줄 회고 입력/저장 상태
  const [reflection, setReflection] = useState("");
  const [saving, setSaving] = useState(false);

  // ✅ Alert 대체: 배너
  const [banner, setBanner] = useState<{
    kind: BannerKind;
    text: string;
  } | null>(null);
  const showError = (text: string) => setBanner({ kind: "error", text });
  const showInfo = (text: string) => setBanner({ kind: "info", text });
  const showSuccess = (text: string) => setBanner({ kind: "success", text });
  const clearBanner = () => setBanner(null);

  const decisionId = useMemo(() => (typeof id === "string" ? id : ""), [id]);

  const load = useCallback(async () => {
    if (!decisionId) {
      setErr("id가 없습니다.");
      return;
    }

    try {
      setLoading(true);
      setErr(null);
      clearBanner();

      const [d, list] = await Promise.all([
        getDecision(decisionId),
        getDecisions(),
      ]);

      if (!d) throw new Error("데이터가 없습니다.");

      setTarget(d);
      setAll(list ?? []);
      setReflection(getReflection((d as any)?.meta));
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, [decisionId]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {};
    }, [load])
  );

  const stats = useMemo(() => {
    if (!target) return null;

    const completed = all.filter(isCompleted);

    const overallTotal = completed.length;
    const overallPositive = completed.filter(isPositive).length;
    const overallRate = overallTotal > 0 ? overallPositive / overallTotal : 0;

    const sameCat = completed.filter((d) => d.categoryId === target.categoryId);
    const catTotal = sameCat.length;
    const catPositive = sameCat.filter(isPositive).length;
    const catRate = catTotal > 0 ? catPositive / catTotal : 0;

    const myConf = clamp1to5(safeInt(target.confidence, 3));
    const sameConf = completed.filter(
      (d) => clamp1to5(safeInt(d.confidence, 3)) === myConf
    );
    const confTotal = sameConf.length;
    const confPositive = sameConf.filter(isPositive).length;
    const confRate = confTotal > 0 ? confPositive / confTotal : 0;

    return {
      myConfidence: myConf,
      overall: { total: overallTotal, rate: overallRate },
      category: { total: catTotal, rate: catRate },
      confidence: { total: confTotal, rate: confRate },
    };
  }, [all, target]);

  const category = target ? getCategory(target.categoryId) : null;

  // ✅ tabs 제거
  const goHome = () => router.replace("/");

  const goDetail = () => {
    if (!target) return;
    if (from === "detail" && router.canDismiss()) {
      router.dismiss();
      return;
    }
    if (from === "outcome") {
      router.replace("/");
      return;
    }
    router.replace({ pathname: "/detail", params: { id: target.id } });
  };

  const saveReflection = async () => {
    if (!target) return;

    clearBanner();

    const text = reflection.trim();
    // 너무 길면 UX/데이터 부담 → 120자로 제한
    if (text.length > 120) {
      showInfo("한 줄 회고는 120자 이내로 적어주세요.");
      return;
    }

    try {
      setSaving(true);

      // ✅ 기존 meta 유지하면서 reflection만 덮어쓰기
      const prevMeta: any = (target as any).meta ?? {};
      const nextMeta = { ...prevMeta, reflection: text };

      const updated = await updateDecision(target.id, { meta: nextMeta });

      // ✅ 화면 즉시 반영
      setTarget(updated);
      setReflection(getReflection((updated as any).meta));

      showSuccess("한 줄 회고를 저장했어요.");

      setTimeout(() => {
        if (from === "detail" && router.canDismiss()) {
          router.dismiss();
          return;
        }
        if (from === "outcome") {
          router.replace("/");
          return;
        }
        router.replace({ pathname: "/detail", params: { id: target.id } });
      }, 600);
    } catch (e) {
      console.error(e);
      showError("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>회고 데이터를 불러오는 중…</Text>
      </View>
    );
  }

  if (err || !target) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>{err ?? "데이터가 없습니다."}</Text>

        <Pressable style={styles.primaryBtn} onPress={goHome}>
          <Text style={styles.primaryBtnText}>홈으로</Text>
        </Pressable>
      </View>
    );
  }

  const pill = pillText(target);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 28 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.sub}>
          {category?.name ?? target.categoryId} · {formatDate(target.createdAt)}
        </Text>
      </View>

      {banner && (
        <Banner
          kind={banner.kind}
          text={banner.text}
          onClose={() => setBanner(null)}
        />
      )}

      {/* 메인 카드 */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {target.title}
          </Text>

          <View style={[styles.pill, pillStyleByResult(target.result)]}>
            <Text style={styles.pillText}>{pill}</Text>
          </View>
        </View>

        {!!target.notes && <Text style={styles.notes}>{target.notes}</Text>}

        <View style={styles.hr} />

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>내 확신도</Text>
            <Text style={styles.kpiValue}>{stats?.myConfidence ?? "-"}</Text>
            <Text style={styles.kpiHint}>1(낮음) ~ 5(높음)</Text>
          </View>

          <View style={styles.kpi}>
            <Text style={styles.kpiLabel}>전체 긍정률</Text>
            <Text style={styles.kpiValue}>
              {stats ? percent(stats.overall.rate) : "-"}
            </Text>
            <Text style={styles.kpiHint}>
              표본 {stats?.overall.total ?? 0}건
            </Text>
          </View>
        </View>
      </View>

      {/* 비교 카드 2개 */}
      <View style={styles.grid}>
        <View style={styles.smallCard}>
          <Text style={styles.smallTitle}>같은 카테고리 평균</Text>
          <Text style={styles.big}>
            {stats ? percent(stats.category.rate) : "-"}
          </Text>
          <Text style={styles.muted}>표본 {stats?.category.total ?? 0}건</Text>
        </View>

        <View style={styles.smallCard}>
          <Text style={styles.smallTitle}>같은 확신도(1~5) 평균</Text>
          <Text style={styles.big}>
            {stats ? percent(stats.confidence.rate) : "-"}
          </Text>
          <Text style={styles.muted}>
            확신도 {stats?.myConfidence ?? "-"} · 표본{" "}
            {stats?.confidence.total ?? 0}건
          </Text>
        </View>
      </View>

      {/* ✅ 한 줄 회고 입력/저장 */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>한 줄 회고</Text>
        <Text style={styles.muted}>
          이번 판단에서 배운 점을 짧게 남겨두면 다음 판단이 더 좋아져요.
        </Text>

        <TextInput
          value={reflection}
          onChangeText={(v) => {
            setReflection(v);
            clearBanner();
          }}
          placeholder="예) 근거는 있었지만, 리스크 시나리오를 과소평가했음"
          placeholderTextColor="#64748b"
          editable={!saving}
          maxLength={120}
          style={styles.input}
        />

        <View style={styles.actions}>
          <Pressable
            style={[styles.secondaryBtn, saving && { opacity: 0.6 }]}
            onPress={goDetail}
            disabled={saving}
          >
            <Text style={styles.secondaryBtnText}>
              {from === "outcome" ? "홈으로" : "상세 보기"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
            onPress={saveReflection}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryBtnText}>회고 저장</Text>
            )}
          </Pressable>
        </View>

        <Pressable
          style={[styles.ghostBtn, saving && { opacity: 0.6 }]}
          onPress={goHome}
          disabled={saving}
        >
          <Text style={styles.ghostBtnText}>홈으로</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#020617", paddingHorizontal: 16 },

  header: { paddingTop: 16, paddingBottom: 12 },
  title: { color: "white", fontSize: 22, fontWeight: "900" },
  sub: { color: "#cbd5f5", marginTop: 6, fontWeight: "700" },

  // 배너
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  bannerError: { backgroundColor: "#1f0a0a", borderColor: "#ef4444" },
  bannerInfo: { backgroundColor: "#0b1220", borderColor: "#334155" },
  bannerSuccess: { backgroundColor: "#052013", borderColor: "#22c55e" },
  bannerText: { color: "white", fontWeight: "700", flex: 1 },
  bannerClose: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
  },
  bannerCloseText: { color: "#cbd5f5", fontWeight: "800" },

  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0b1220",
    backgroundColor: "#0b1220",
  },

  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: { color: "white", fontWeight: "900", fontSize: 16, flex: 1 },

  pill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  pillText: { color: "white", fontWeight: "900", fontSize: 12 },
  pillPos: { backgroundColor: "#16a34a" },
  pillNeg: { backgroundColor: "#ef4444" },
  pillNeu: { backgroundColor: "#1d4ed8" },

  notes: {
    color: "#cbd5f5",
    marginTop: 10,
    lineHeight: 18,
    fontWeight: "700",
  },

  hr: {
    height: 1,
    backgroundColor: "#0f172a",
    marginTop: 12,
    marginBottom: 12,
  },

  kpiRow: { flexDirection: "row", gap: 12 },
  kpi: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#0f172a",
  },
  kpiLabel: { color: "#94a3b8", fontWeight: "800" },
  kpiValue: {
    color: "white",
    fontWeight: "900",
    fontSize: 22,
    marginTop: 6,
  },
  kpiHint: { color: "#94a3b8", fontWeight: "700", marginTop: 4 },

  grid: { flexDirection: "row", gap: 12, marginTop: 12 },
  smallCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0b1220",
    backgroundColor: "#0b1220",
  },
  smallTitle: { color: "#cbd5f5", fontWeight: "900" },
  big: { color: "white", fontWeight: "900", fontSize: 24, marginTop: 10 },
  muted: { color: "#94a3b8", fontWeight: "700", marginTop: 6 },

  sectionTitle: { color: "white", fontWeight: "900", fontSize: 16 },

  input: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#020617",
    color: "white",
    fontWeight: "700",
  },

  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  primaryBtn: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "white", fontWeight: "900" },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  secondaryBtnText: { color: "white", fontWeight: "900" },

  ghostBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0f172a",
    backgroundColor: "#020617",
  },
  ghostBtnText: { color: "#cbd5f5", fontWeight: "900" },
});
