// app/outcome.tsx
import { getMarketConditionLabel } from "@/constants/invest";
import { getDecision, updateDecisionResult } from "@/lib/api";
import { getResultLabels } from "@/lib/categories";
import type { DecisionResult } from "@/types/category";
import type { Decision } from "@/types/decision";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type FinalResult = Exclude<DecisionResult, "pending">;

type BannerKind = "error" | "info";

function parseNumberInput(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

function calcReturnRate(entry: number, exit: number, action: "buy" | "sell") {
  if (entry <= 0) return null;
  const raw =
    action === "sell" ? (entry - exit) / entry : (exit - entry) / entry;
  return Math.round(raw * 1000) / 10;
}

function Banner({
  kind,
  text,
  onClose,
}: {
  kind: BannerKind;
  text: string;
  onClose?: () => void;
}) {
  const isError = kind === "error";
  return (
    <View
      style={[styles.banner, isError ? styles.bannerError : styles.bannerInfo]}
    >
      <Text style={styles.bannerText}>{text}</Text>
      {!!onClose && (
        <Pressable onPress={onClose} style={styles.bannerClose}>
          <Text style={styles.bannerCloseText}>닫기</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function OutcomeScreen() {
  const params = useLocalSearchParams<{ id?: string; categoryId?: string }>();

  const id = useMemo(
    () => (typeof params.id === "string" ? params.id : undefined),
    [params.id]
  );

  const categoryId = useMemo(
    () =>
      typeof params.categoryId === "string" ? params.categoryId : undefined,
    [params.categoryId]
  );

  const labels = useMemo(() => {
    const base = getResultLabels(categoryId);
    return {
      positive: base?.positive ?? "좋음",
      negative: base?.negative ?? "나쁨",
      neutral: base?.neutral ?? "보통",
    };
  }, [categoryId]);

  const [result, setResult] = useState<FinalResult | null>(null);
  const [confidence, setConfidence] = useState<number>(3);
  const [loading, setLoading] = useState(false);
  const [loadingDecision, setLoadingDecision] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);

  const [symbol, setSymbol] = useState("");
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [marketCondition, setMarketCondition] = useState<string | undefined>();
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");

  const [banner, setBanner] = useState<{
    kind: BannerKind;
    text: string;
  } | null>(null);

  const showError = (text: string) => setBanner({ kind: "error", text });
  const showInfo = (text: string) => setBanner({ kind: "info", text });

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoadingDecision(true);
    getDecision(id)
      .then((d) => {
        if (!alive) return;
        setDecision(d);
        const meta = d?.meta ?? {};
        setSymbol(typeof meta.symbol === "string" ? meta.symbol : "");
        setAction(meta.action === "sell" ? "sell" : "buy");
        setMarketCondition(
          typeof meta.marketCondition === "string" ? meta.marketCondition : undefined
        );
        setEntryPrice(
          typeof meta.entryPrice === "number" ? String(meta.entryPrice) : ""
        );
        setExitPrice(
          typeof meta.exitPrice === "number" ? String(meta.exitPrice) : ""
        );
      })
      .catch(() => {
        if (alive) showInfo("투자 정보를 불러오지 못했어요.");
      })
      .finally(() => {
        if (alive) setLoadingDecision(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const isInvest = (decision?.categoryId ?? categoryId) === "invest";
  const entryValue = parseNumberInput(entryPrice);
  const exitValue = parseNumberInput(exitPrice);
  const returnRate =
    entryValue !== null && exitValue !== null
      ? calcReturnRate(entryValue, exitValue, action)
      : null;

  const submit = async () => {
    setBanner(null);

    if (!id) {
      showError("잘못된 접근입니다. (id 없음)");
      return;
    }
    if (!result) {
      showInfo("결과를 선택해주세요.");
      return;
    }
    if (isInvest) {
      if (!entryPrice.trim()) {
        showInfo("매수가를 입력해주세요.");
        return;
      }
      if (!exitPrice.trim()) {
        showInfo("매도가를 입력해주세요.");
        return;
      }
      if (entryValue === null || exitValue === null) {
        showInfo("매수/매도 가격이 올바르지 않아요.");
        return;
      }
    }

    try {
      setLoading(true);
      await updateDecisionResult(id, {
        result,
        confidence,
        meta: isInvest
          ? {
              symbol: symbol || undefined,
              action,
              marketCondition,
              entryPrice: entryValue ?? undefined,
              exitPrice: exitValue ?? undefined,
            }
          : undefined,
      });

      router.replace({
        pathname: "/review",
        params: { id, from: "outcome" },
      });
    } catch (e) {
      console.error("updateDecisionResult failed:", e);
      showError("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  if (!id) {
    return (
      <View style={styles.container}>
        <Text style={styles.helper}>결과를 입력할 기록을 찾지 못했어요.</Text>

        {banner && (
          <Banner
            kind={banner.kind}
            text={banner.text}
            onClose={() => setBanner(null)}
          />
        )}

        {/* 홈 이동은 layout의 back 로직에 맡김 */}
        <Pressable style={styles.submit} onPress={() => router.replace("/")}>
          <Text style={styles.text}>홈으로 돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>결과 선택</Text>

      {banner && (
        <Banner
          kind={banner.kind}
          text={banner.text}
          onClose={() => setBanner(null)}
        />
      )}

      {/* 결과 선택 */}
      <View style={styles.row}>
        <Pressable
          style={[styles.choice, result === "positive" && styles.activeChoice]}
          onPress={() => {
            setResult("positive");
            setBanner(null);
          }}
          disabled={loading}
        >
          <Text style={styles.text}>{labels.positive}</Text>
        </Pressable>

        <Pressable
          style={[styles.choice, result === "negative" && styles.activeChoice]}
          onPress={() => {
            setResult("negative");
            setBanner(null);
          }}
          disabled={loading}
        >
          <Text style={styles.text}>{labels.negative}</Text>
        </Pressable>

        <Pressable
          style={[styles.choice, result === "neutral" && styles.activeChoice]}
          onPress={() => {
            setResult("neutral");
            setBanner(null);
          }}
          disabled={loading}
        >
          <Text style={styles.text}>{labels.neutral}</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>확신도</Text>

      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((v) => (
          <Pressable
            key={v}
            style={[
              styles.confidence,
              confidence === v && styles.activeConfidence,
            ]}
            onPress={() => setConfidence(v)}
            disabled={loading}
          >
            <Text style={styles.text}>{v}</Text>
          </Pressable>
        ))}
      </View>

      {isInvest && (
        <View style={styles.investBox}>
          <Text style={styles.label}>투자 결과</Text>
          {!!symbol && (
            <Text style={styles.subtle}>
              {symbol} · {getMarketConditionLabel(marketCondition)}
            </Text>
          )}

          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>매수가</Text>
            <TextInput
              value={entryPrice}
              onChangeText={setEntryPrice}
              placeholder="예: 72000"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              keyboardType="numeric"
              editable={!loading && !loadingDecision}
            />
          </View>

          <View style={{ marginTop: 10 }}>
            <Text style={styles.label}>매도가</Text>
            <TextInput
              value={exitPrice}
              onChangeText={setExitPrice}
              placeholder="예: 76000"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              keyboardType="numeric"
              editable={!loading && !loadingDecision}
            />
          </View>

          {returnRate !== null && (
            <Text style={styles.subtle}>
              예상 수익률 {returnRate > 0 ? "+" : ""}
              {returnRate}%
            </Text>
          )}
        </View>
      )}

      <Text style={styles.helperText}>
        결과 입력은 지금 하지 않아도 괜찮아요.
      </Text>
      <View style={styles.buttonArea}>
        <Pressable
          style={[styles.submit, loading && { opacity: 0.6 }]}
          onPress={submit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.text}>저장</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.secondary, loading && { opacity: 0.6 }]}
          onPress={() => {
            router.replace({ pathname: "/detail", params: { id } });
          }}
          disabled={loading}
        >
          <Text style={styles.secondaryText}>기록 상세로</Text>
        </Pressable>

        <Pressable
          style={[styles.ghost, loading && { opacity: 0.6 }]}
          onPress={() => {
            router.replace("/");
          }}
          disabled={loading}
        >
          <Text style={styles.ghostText}>나중에 하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#020617" },
  title: { color: "white", fontSize: 20, fontWeight: "800", marginBottom: 12 },
  helper: { color: "#cbd5f5", marginBottom: 16 },
  helperText: { color: "#94a3b8", marginTop: 6, fontWeight: "700" },

  // 배너
  banner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  bannerError: { backgroundColor: "#1f0a0a", borderColor: "#ef4444" },
  bannerInfo: { backgroundColor: "#0b1220", borderColor: "#334155" },
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

  row: { flexDirection: "row", gap: 12, marginBottom: 24 },

  choice: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    backgroundColor: "#0b1220",
  },

  confidence: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b1220",
  },

  activeChoice: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  activeConfidence: { backgroundColor: "#2563eb", borderColor: "#2563eb" },

  text: { color: "white", fontWeight: "800" },
  label: { color: "#cbd5f5", marginBottom: 8, fontWeight: "700" },
  subtle: { color: "#94a3b8", marginTop: 8, fontWeight: "700" },

  buttonArea: {
    marginTop: "auto",
    gap: 10,
  },

  submit: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },

  secondary: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
    alignItems: "center",
  },
  secondaryText: { color: "#cbd5f5", fontWeight: "800" },
  ghost: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0f172a",
    backgroundColor: "#020617",
    alignItems: "center",
  },
  ghostText: { color: "#94a3b8", fontWeight: "800" },

  investBox: {
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0b1220",
    backgroundColor: "#0b1220",
  },
  input: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    padding: 12,
    color: "white",
    backgroundColor: "#0b1220",
  },
});
