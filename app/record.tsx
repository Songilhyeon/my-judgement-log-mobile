// app/record.tsx
import { MARKET_CONDITIONS } from "@/constants/invest";
import { createDecision } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import type { MarketCondition } from "@/types/decision";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type BannerKind = "error" | "info";

function parseNumberInput(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
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

export default function RecordScreen() {
  const [categoryId, setCategoryId] = useState<string>("invest");

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [confidence, setConfidence] = useState<number>(3);

  const isInvest = categoryId === "invest";
  const [symbol, setSymbol] = useState("");
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [marketCondition, setMarketCondition] =
    useState<MarketCondition>("uncertain");
  const [entryPrice, setEntryPrice] = useState("");

  const [loading, setLoading] = useState(false);

  const [banner, setBanner] = useState<{
    kind: BannerKind;
    text: string;
  } | null>(null);
  const showError = (text: string) => setBanner({ kind: "error", text });
  const showInfo = (text: string) => setBanner({ kind: "info", text });
  const clearBanner = () => setBanner(null);

  const selectedCategoryName = useMemo(
    () => CATEGORIES.find((c) => c.id === categoryId)?.name ?? "카테고리",
    [categoryId]
  );

  useEffect(() => {
    if (!isInvest) {
      setSymbol("");
      setAction("buy");
      setMarketCondition("uncertain");
      setEntryPrice("");
    }
  }, [isInvest]);

  const buildPayload = () => {
    const tagsValue = tags
      ? tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const entryPriceValue = isInvest ? parseNumberInput(entryPrice) : null;

    return {
      categoryId,
      title: title.trim(),
      notes: notes.trim() ? notes.trim() : undefined,
      tags: tagsValue,
      confidence,
      result: "pending" as const,
      meta: isInvest
        ? {
            symbol: symbol.trim().toUpperCase(),
            action,
            marketCondition,
            entryPrice: entryPriceValue ?? undefined,
          }
        : undefined,
    };
  };

  const validate = () => {
    if (!title.trim()) {
      showInfo("제목(한 줄 요약)을 입력해주세요.");
      return false;
    }

    if (isInvest && !symbol.trim()) {
      showInfo("투자 카테고리에서는 종목(symbol)을 입력해주세요.");
      return false;
    }
    if (isInvest && !entryPrice.trim()) {
      showInfo("매수가를 입력해주세요.");
      return false;
    }

    const entryPriceValue = isInvest ? parseNumberInput(entryPrice) : null;
    if (isInvest && entryPriceValue === null) {
      showInfo("매수가가 올바르지 않아요.");
      return false;
    }

    return true;
  };

  const saveOnly = async () => {
    clearBanner();
    if (!validate()) return;

    try {
      setLoading(true);
      const created = await createDecision(buildPayload());
      router.replace("/");
    } catch (e) {
      console.error("createDecision failed:", e);
      showError("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const saveAndOutcome = async () => {
    clearBanner();

    if (!validate()) return;

    try {
      setLoading(true);

      const created = await createDecision(buildPayload());
      router.replace({
        pathname: "/",
        params: { focusId: created.id, prompt: "outcome" },
      });
    } catch (e) {
      console.error("createDecision failed:", e);
      showError("저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>기록하기</Text>

      {banner && (
        <Banner kind={banner.kind} text={banner.text} onClose={clearBanner} />
      )}

      {/* 카테고리 */}
      <Text style={styles.label}>카테고리</Text>
      <View style={styles.chipsWrap}>
        {CATEGORIES.map((c) => {
          const active = c.id === categoryId;
          return (
            <Pressable
              key={c.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                setCategoryId(c.id);
                clearBanner();
              }}
              disabled={loading}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 제목 */}
      <View style={styles.section}>
        <Text style={styles.label}>제목 (한 줄 요약)</Text>
        <TextInput
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            clearBanner();
          }}
          placeholder={`${selectedCategoryName}에 대한 판단을 한 줄로`}
          placeholderTextColor="#94a3b8"
          style={styles.input}
          editable={!loading}
        />
      </View>

      {/* 투자 전용 입력 */}
      {isInvest && (
        <View style={styles.section}>
          <Text style={styles.label}>투자 정보</Text>

          <TextInput
            value={symbol}
            onChangeText={(v) => {
              setSymbol(v);
              clearBanner();
            }}
            placeholder="종목 (AAPL, BTC, 005930)"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            autoCapitalize="characters"
            editable={!loading}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>
            시장 상황 (우선)
          </Text>
          <View style={styles.chipsWrap}>
            {MARKET_CONDITIONS.map((c) => {
              const active = marketCondition === c.id;
              return (
                <Pressable
                  key={c.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => {
                    setMarketCondition(c.id);
                    clearBanner();
                  }}
                  disabled={loading}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { marginTop: 10 }]}>매수가</Text>
          <TextInput
            value={entryPrice}
            onChangeText={(v) => {
              setEntryPrice(v);
              clearBanner();
            }}
            placeholder="예: 72000"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            keyboardType="numeric"
            editable={!loading}
          />

          <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
            <Pressable
              style={[styles.choice, action === "buy" && styles.activeChoice]}
              onPress={() => {
                setAction("buy");
                clearBanner();
              }}
              disabled={loading}
            >
              <Text style={styles.choiceText}>BUY</Text>
            </Pressable>

            <Pressable
              style={[styles.choice, action === "sell" && styles.activeChoice]}
              onPress={() => {
                setAction("sell");
                clearBanner();
              }}
              disabled={loading}
            >
              <Text style={styles.choiceText}>SELL</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 노트 */}
      <View style={styles.section}>
        <Text style={styles.label}>노트 (근거/상황)</Text>
        <TextInput
          value={notes}
          onChangeText={(v) => {
            setNotes(v);
            clearBanner();
          }}
          placeholder="왜 그렇게 판단했는지 간단히"
          placeholderTextColor="#94a3b8"
          style={[styles.input, { height: 92, textAlignVertical: "top" }]}
          multiline
          editable={!loading}
        />
      </View>

      {/* 태그 */}
      <View style={styles.section}>
        <Text style={styles.label}>태그 (쉼표로 구분)</Text>
        <TextInput
          value={tags}
          onChangeText={(v) => {
            setTags(v);
            clearBanner();
          }}
          placeholder="실적, 습관, 면접, 관계"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          editable={!loading}
        />
      </View>

      {/* 확신도 */}
      <View style={styles.section}>
        <Text style={styles.label}>확신도</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[1, 2, 3, 4, 5].map((v) => (
            <Pressable
              key={v}
              style={[
                styles.confidence,
                confidence === v && styles.activeConfidence,
              ]}
              onPress={() => {
                setConfidence(v);
                clearBanner();
              }}
              disabled={loading}
            >
              <Text style={styles.choiceText}>{v}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 저장 */}
      <View style={styles.submitRow}>
        <Pressable
          style={[styles.submit, loading && { opacity: 0.6 }]}
          onPress={saveOnly}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitText}>저장</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.secondarySubmit, loading && { opacity: 0.6 }]}
          onPress={saveAndOutcome}
          disabled={loading}
        >
          <Text style={styles.secondarySubmitText}>저장 후 결과 입력</Text>
        </Pressable>
      </View>
      <Text style={styles.submitHint}>
        저장만 해도 기록이 완료돼요. 결과 입력은 나중에 해도 돼요.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#020617" },
  title: { fontSize: 22, fontWeight: "800", color: "white", marginBottom: 12 },

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

  section: { marginTop: 18 },
  label: { color: "#cbd5f5", marginBottom: 8, fontWeight: "700" },

  input: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    padding: 12,
    color: "white",
    backgroundColor: "#0b1220",
  },

  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
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
  chipText: { color: "#cbd5f5", fontWeight: "700" },
  chipTextActive: { color: "white" },

  choice: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    backgroundColor: "#0b1220",
  },
  activeChoice: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  choiceText: { color: "white", fontWeight: "800" },

  confidence: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b1220",
  },
  activeConfidence: { backgroundColor: "#2563eb", borderColor: "#2563eb" },

  submit: {
    flex: 1,
    backgroundColor: "#2563eb",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  submitText: { color: "white", fontSize: 16, fontWeight: "800" },

  submitRow: { marginTop: 24, flexDirection: "row", gap: 12 },
  secondarySubmit: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
    alignItems: "center",
  },
  secondarySubmitText: { color: "#cbd5f5", fontSize: 14, fontWeight: "800" },
  submitHint: { color: "#94a3b8", fontWeight: "700", marginTop: 10 },
});
