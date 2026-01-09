// app/detail.tsx
import { MARKET_CONDITIONS } from "@/constants/invest";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  deleteDecision,
  getDecision,
  updateDecision,
  updateDecisionResult,
} from "@/lib/api";
import { CATEGORIES, getCategory, getResultLabels } from "@/lib/categories";
import type { Decision, DecisionMeta, MarketCondition } from "@/types/decision";

type AnyResult = "pending" | "positive" | "negative" | "neutral";

const parseTags = (raw: string) => {
  const arr = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return Array.from(new Set(arr));
};

const parseNumberInput = (value: string) => {
  const normalized = value.replace(/,/g, "").trim();
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
};

const calcReturnRate = (
  entry: number,
  exit: number,
  action: "buy" | "sell"
) => {
  if (entry <= 0) return null;
  const raw =
    action === "sell" ? (entry - exit) / entry : (exit - entry) / entry;
  return Math.round(raw * 1000) / 10;
};

function formatDateTime(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

type DialogState = null | {
  title: string;
  message: string;
  // confirm이 필요하면 confirmText/onConfirm 제공
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm?: () => void | Promise<void>;
};

function getReflection(meta?: DecisionMeta): string {
  return typeof meta?.reflection === "string" ? meta.reflection : "";
}

export default function DetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = useMemo(
    () => (typeof params.id === "string" ? params.id : undefined),
    [params.id]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ✅ 언마운트 이후 setState 방지(삭제/뒤로가기 타이밍에서 saving 꼬임 방지)
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [decision, setDecision] = useState<Decision | null>(null);

  // editable fields
  const [categoryId, setCategoryId] = useState<string>("daily");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [confidence, setConfidence] = useState<number>(3);

  // result editing (detail에서도 수정 가능)
  const [result, setResult] = useState<Decision["result"]>("pending");

  const isInvest = categoryId === "invest";
  const [symbol, setSymbol] = useState("");
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [marketCondition, setMarketCondition] =
    useState<MarketCondition>("uncertain");
  const [entryPrice, setEntryPrice] = useState("");
  const [exitPrice, setExitPrice] = useState("");

  // ✅ Alert 대신 커스텀 Confirm 모달 (Alert 미표시 문제 완전 회피)
  const [dialog, setDialog] = useState<DialogState>(null);
  const [toast, setToast] = useState<string | null>(null);

  const waitTime = 1000;

  const reflection = getReflection((decision as any)?.meta);
  const hasReflection = reflection.trim().length > 0;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), waitTime);
  };

  const openDialog = (next: NonNullable<DialogState>) => {
    Keyboard.dismiss();
    setDialog({
      cancelText: "취소",
      ...next,
    });
  };
  const closeDialog = () => setDialog(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await getDecision(id);
      if (!mountedRef.current) return;

      if (!d) {
        openDialog({ title: "오류", message: "데이터가 없습니다." });
        router.replace("/");
        return;
      }

      setDecision(d);
      setCategoryId(d.categoryId);
      setTitle(d.title ?? "");
      setNotes(d.notes ?? "");
      setTags((d.tags ?? []).join(", "));
      setConfidence(d.confidence ?? 3);
      setResult(d.result);

      const m = d.meta ?? {};
      setSymbol(typeof m.symbol === "string" ? m.symbol : "");
      setAction(m.action === "sell" ? "sell" : "buy");
      setMarketCondition(
        m.marketCondition === "bull" ||
          m.marketCondition === "bear" ||
          m.marketCondition === "sideways" ||
          m.marketCondition === "uncertain"
          ? m.marketCondition
          : "uncertain"
      );
      setEntryPrice(
        typeof m.entryPrice === "number" ? String(m.entryPrice) : ""
      );
      setExitPrice(typeof m.exitPrice === "number" ? String(m.exitPrice) : "");
    } catch {
      openDialog({ title: "오류", message: "상세를 불러오지 못했습니다." });
      router.replace("/");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {};
    }, [load])
  );

  // ✅ 카테고리 변경 UX: invest → nonInvest로 바꾸면 입력값도 정리(혼란 방지)
  useEffect(() => {
    if (categoryId !== "invest") {
      setSymbol("");
      setAction("buy");
      setMarketCondition("uncertain");
      setEntryPrice("");
      setExitPrice("");
    }
  }, [categoryId]);

  const onSaveMeta = async () => {
    if (!id) return;

    if (!title.trim()) {
      openDialog({ title: "입력 필요", message: "제목을 입력해주세요." });
      return;
    }
    if (isInvest && !symbol.trim()) {
      openDialog({
        title: "입력 필요",
        message: "투자 카테고리에서는 종목(symbol)이 필요해요.",
      });
      return;
    }
    if (isInvest && !entryPrice.trim()) {
      openDialog({
        title: "입력 필요",
        message: "투자 카테고리에서는 매수가가 필요해요.",
      });
      return;
    }

    const entryValue = isInvest ? parseNumberInput(entryPrice) : null;
    const exitValue = isInvest ? parseNumberInput(exitPrice) : null;
    if (isInvest && entryValue === null) {
      openDialog({
        title: "입력 필요",
        message: "매수가가 올바르지 않아요.",
      });
      return;
    }

    try {
      setSaving(true);

      const nextReturnRate =
        isInvest && entryValue !== null && exitValue !== null
          ? calcReturnRate(entryValue, exitValue, action)
          : null;

      const updated = await updateDecision(id, {
        categoryId,
        title: title.trim(),
        notes: notes.trim() ? notes.trim() : null,
        tags: parseTags(tags),
        confidence,
        meta: isInvest
          ? {
              ...(decision?.meta ?? {}),
              symbol: symbol.trim().toUpperCase(),
              action,
              marketCondition,
              entryPrice: entryValue ?? undefined,
              exitPrice: exitValue ?? undefined,
              returnRate: nextReturnRate ?? undefined,
            }
          : undefined, // ✅ nonInvest면 meta 제거
      });

      if (!mountedRef.current) return;

      setDecision(updated);
      setResult(updated.result);
      setConfidence(updated.confidence);
      showToast("저장 완료!");
      // openDialog({ title: "저장 완료", message: "수정 내용을 저장했어요." });
    } catch {
      openDialog({ title: "오류", message: "저장에 실패했습니다." });
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  // ✅ 결과 수정 저장(완료 상태 변경)
  const onSaveResult = async (next: AnyResult) => {
    if (!id) return;

    try {
      setSaving(true);
      const updated = await updateDecisionResult(id, {
        result: next,
        confidence,
      });

      if (!mountedRef.current) return;

      setDecision(updated);
      setResult(updated.result);
      setConfidence(updated.confidence);

      // openDialog({ title: "반영 완료", message: "결과를 업데이트했어요." });
    } catch {
      openDialog({ title: "오류", message: "결과 업데이트에 실패했습니다." });
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  // ✅ 삭제 로직 (confirm 모달에서 호출)
  const doDelete = async () => {
    if (!id) return;

    try {
      setSaving(true);
      await deleteDecision(id);
      goBack();
    } catch {
      openDialog({ title: "오류", message: "삭제에 실패했습니다." });
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  if (!id) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>상세</Text>
        <Text style={styles.muted}>잘못된 접근입니다. (id 없음)</Text>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.primaryText}>홈으로</Text>
        </Pressable>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator />
        <Text style={[styles.muted, { marginTop: 10 }]}>불러오는 중…</Text>
      </View>
    );
  }

  const categoryName = getCategory(categoryId)?.name ?? categoryId;
  const labels = getResultLabels(categoryId);

  const resultLabel =
    result === "pending"
      ? "미완료"
      : result === "positive"
      ? labels.positive
      : result === "negative"
      ? labels.negative
      : labels.neutral;

  const entryValue = parseNumberInput(entryPrice);
  const exitValue = parseNumberInput(exitPrice);
  const computedReturnRate =
    isInvest && entryValue !== null && exitValue !== null
      ? calcReturnRate(entryValue, exitValue, action)
      : null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 28 }}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>{categoryName}</Text>

        {/* 결과 섹션 */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <Text style={styles.cardTitle}>결과</Text>
            <View
              style={[
                styles.badge,
                result === "pending" ? styles.badgePending : styles.badgeDone,
              ]}
            >
              <Text style={styles.badgeText}>{resultLabel}</Text>
            </View>
          </View>

          <Text style={styles.hint}>
            완료 기록도 여기서 결과를 다시 수정할 수 있어요. 필요하면 미완료로
            되돌릴 수도 있어요.
          </Text>

          {/* 결과 선택 */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Pressable
              style={[
                styles.resultBtn,
                styles.resultPositive,
                saving && { opacity: 0.6 },
              ]}
              onPress={() => onSaveResult("positive")}
              disabled={saving}
            >
              <Text style={styles.resultBtnText}>{labels.positive}</Text>
            </Pressable>

            <Pressable
              style={[
                styles.resultBtn,
                styles.resultNegative,
                saving && { opacity: 0.6 },
              ]}
              onPress={() => onSaveResult("negative")}
              disabled={saving}
            >
              <Text style={styles.resultBtnText}>{labels.negative}</Text>
            </Pressable>

            <Pressable
              style={[
                styles.resultBtn,
                styles.resultNeutral,
                saving && { opacity: 0.6 },
              ]}
              onPress={() => onSaveResult("neutral")}
              disabled={saving}
            >
              <Text style={styles.resultBtnText}>{labels.neutral}</Text>
            </Pressable>
          </View>

          {/* 미완료로 되돌리기 (커스텀 confirm) */}
          <Pressable
            style={[styles.revertBtn, saving && { opacity: 0.6 }]}
            onPress={() =>
              openDialog({
                title: "미완료로 되돌리기",
                message: "이 기록을 미완료로 바꿀까요?",
                confirmText: "되돌리기",
                onConfirm: () => onSaveResult("pending"),
              })
            }
            disabled={saving}
          >
            <Text style={styles.revertText}>미완료로 되돌리기</Text>
          </Pressable>

          {/* 확신도 */}
          <Text style={[styles.label, { marginTop: 14 }]}>확신도</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[1, 2, 3, 4, 5].map((v) => (
              <Pressable
                key={v}
                style={[
                  styles.confidence,
                  confidence === v && styles.confidenceActive,
                ]}
                onPress={() => setConfidence(v)}
                disabled={saving}
              >
                <Text style={styles.choiceText}>{v}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.muted, { marginTop: 12 }]}>
            * 확신도 변경 후 위 결과 버튼을 누르면 함께 저장돼요.
          </Text>
        </View>

        {/* 카테고리 */}
        <Text style={[styles.label, { marginTop: 18 }]}>카테고리</Text>
        <View style={styles.chipsWrap}>
          {CATEGORIES.map((c) => {
            const active = c.id === categoryId;
            return (
              <Pressable
                key={c.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCategoryId(c.id)}
                disabled={saving}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 제목 */}
        <View style={styles.section}>
          <Text style={styles.label}>제목</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="한 줄 요약"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            editable={!saving}
          />
        </View>

        {/* 투자 meta */}
        {isInvest && (
          <View style={styles.section}>
            <Text style={styles.label}>투자 정보</Text>
            <TextInput
              value={symbol}
              onChangeText={setSymbol}
              placeholder="종목 (AAPL, BTC...)"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              editable={!saving}
              autoCapitalize="characters"
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
                    onPress={() => setMarketCondition(c.id)}
                    disabled={saving}
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

            <Text style={[styles.label, { marginTop: 8 }]}>매수가</Text>
            <TextInput
              value={entryPrice}
              onChangeText={setEntryPrice}
              placeholder="예: 72000"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              editable={!saving}
              keyboardType="numeric"
            />

            <Text style={[styles.label, { marginTop: 10 }]}>매도가</Text>
            <TextInput
              value={exitPrice}
              onChangeText={setExitPrice}
              placeholder="예: 76000"
              placeholderTextColor="#94a3b8"
              style={styles.input}
              editable={!saving}
              keyboardType="numeric"
            />

            {computedReturnRate !== null && (
              <Text style={[styles.muted, { marginTop: 8 }]}>
                수익률 {computedReturnRate > 0 ? "+" : ""}
                {computedReturnRate}%
              </Text>
            )}

            <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
              <Pressable
                style={[styles.choice, action === "buy" && styles.choiceActive]}
                onPress={() => setAction("buy")}
                disabled={saving}
              >
                <Text style={styles.choiceText}>BUY</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.choice,
                  action === "sell" && styles.choiceActive,
                ]}
                onPress={() => setAction("sell")}
                disabled={saving}
              >
                <Text style={styles.choiceText}>SELL</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* 노트 */}
        <View style={styles.section}>
          <Text style={styles.label}>노트</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="근거/상황"
            placeholderTextColor="#94a3b8"
            style={[styles.input, { height: 96, textAlignVertical: "top" }]}
            multiline
            editable={!saving}
          />
        </View>

        {/* 태그 */}
        <View style={styles.section}>
          <Text style={styles.label}>태그 (쉼표)</Text>
          <TextInput
            value={tags}
            onChangeText={setTags}
            placeholder="예: 실적, 습관"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            editable={!saving}
          />
        </View>

        {/* 회고 미리보기 */}
        <Pressable
          style={styles.reflectionCard}
          onPress={() =>
            router.push({ pathname: "/review", params: { id, from: "detail" } })
          }
          hitSlop={10}
        >
          <View style={styles.reflectionTop}>
            <Text style={styles.reflectionTitle}>한 줄 회고</Text>
            <Text style={styles.reflectionCta}>
              {hasReflection ? "수정" : "작성"}
            </Text>
          </View>

          {hasReflection ? (
            <Text style={styles.reflectionText} numberOfLines={3}>
              {reflection}
            </Text>
          ) : (
            <Text style={styles.reflectionEmpty}>
              아직 회고가 없어요. 이번 판단에서 배운 점을 한 줄로 남겨봐.
            </Text>
          )}
        </Pressable>

        {/* 저장 / 회고 */}
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
            onPress={onSaveMeta}
            disabled={saving}
          >
            <Text style={styles.primaryText}>
              {saving ? "저장 중..." : "내용 저장"}
            </Text>
          </Pressable>

          {decision?.result !== "pending" && (
            <Pressable
              style={styles.secondaryBtn}
              onPress={() =>
                router.push({ pathname: "/review", params: { id } })
              }
              hitSlop={10}
            >
              <Text style={styles.secondaryText}>회고 작성</Text>
            </Pressable>
          )}
        </View>

        {/* 삭제 */}
        <Pressable
          style={[styles.dangerBtn, saving && { opacity: 0.6 }]}
          onPress={() =>
            openDialog({
              title: "삭제",
              message: "이 기록을 삭제할까요?",
              confirmText: "삭제",
              destructive: true,
              onConfirm: () => doDelete(),
            })
          }
          disabled={saving}
        >
          <Text style={styles.dangerText}>삭제</Text>
        </Pressable>

        {/* 메타 정보 */}
        {decision && (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.muted}>
              생성: {formatDateTime(decision.createdAt)}
            </Text>
            <Text style={styles.muted}>
              완료: {formatDateTime(decision.resolvedAt)}
            </Text>
            <Text style={styles.muted}>상태: {decision.result}</Text>
          </View>
        )}
      </ScrollView>

      {/* ✅ 커스텀 Confirm 모달 */}
      <Modal
        visible={!!dialog}
        transparent
        animationType="fade"
        onRequestClose={closeDialog}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeDialog}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{dialog?.title ?? ""}</Text>
            <Text style={styles.modalMessage}>{dialog?.message ?? ""}</Text>

            <View style={styles.modalBtns}>
              {/* confirm이 없으면 닫기 버튼만 */}
              {!dialog?.onConfirm ? (
                <Pressable
                  style={[styles.modalBtn, styles.modalBtnPrimary]}
                  onPress={closeDialog}
                >
                  <Text style={styles.modalBtnText}>
                    {dialog?.cancelText ?? "닫기"}
                  </Text>
                </Pressable>
              ) : (
                <>
                  <Pressable style={styles.modalBtn} onPress={closeDialog}>
                    <Text style={styles.modalBtnText}>
                      {dialog?.cancelText ?? "취소"}
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.modalBtn,
                      dialog?.destructive
                        ? styles.modalBtnDanger
                        : styles.modalBtnPrimary,
                    ]}
                    onPress={async () => {
                      const action = dialog?.onConfirm;
                      closeDialog();
                      if (action) await action();
                    }}
                  >
                    <Text style={styles.modalBtnText}>
                      {dialog?.confirmText ?? "확인"}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#020617" },

  title: { color: "white", fontSize: 22, fontWeight: "900", marginBottom: 12 },
  label: { color: "#cbd5f5", fontWeight: "800", marginBottom: 8 },

  section: { marginTop: 16 },

  input: {
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    padding: 12,
    color: "white",
    backgroundColor: "#0b1220",
  },

  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#0b1220",
    backgroundColor: "#0b1220",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { color: "white", fontWeight: "900", fontSize: 16 },

  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgePending: { backgroundColor: "#111827", borderColor: "#334155" },
  badgeDone: { backgroundColor: "#1d4ed8", borderColor: "#1d4ed8" },
  badgeText: { color: "white", fontWeight: "900", fontSize: 12 },

  hint: { color: "#94a3b8", fontWeight: "700", marginTop: 8, lineHeight: 18 },

  resultBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  resultBtnText: { color: "white", fontWeight: "900" },
  resultPositive: { backgroundColor: "#2563eb" },
  resultNegative: { backgroundColor: "#ef4444" },
  resultNeutral: { backgroundColor: "#64748b" },

  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 6,
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

  choice: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    backgroundColor: "#0b1220",
  },
  choiceActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  choiceText: { color: "white", fontWeight: "900" },

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
  confidenceActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  primaryBtn: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  primaryText: {
    color: "white",
    fontWeight: "900",
  },

  secondaryBtn: {
    flex: 1,
    backgroundColor: "#111827",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },

  secondaryText: {
    color: "#cbd5f5",
    fontWeight: "900",
  },

  dangerBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#7f1d1d",
    backgroundColor: "#020617",
  },

  dangerText: {
    color: "#fecaca",
    fontWeight: "900",
  },

  muted: { color: "#94a3b8", fontWeight: "700" },

  revertBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#111827",
    alignItems: "center",
  },
  revertText: { color: "#cbd5f5", fontWeight: "900" },

  // ✅ Custom Confirm Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
    padding: 16,
  },
  modalTitle: {
    color: "white",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 8,
  },
  modalMessage: {
    color: "#cbd5f5",
    fontWeight: "700",
    lineHeight: 18,
  },
  modalBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#111827",
  },
  modalBtnPrimary: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  modalBtnDanger: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  modalBtnText: {
    color: "white",
    fontWeight: "900",
  },

  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#334155",
  },
  toastText: {
    color: "white",
    fontWeight: "900",
    textAlign: "center",
  },

  reflectionCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
  },
  reflectionTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  reflectionTitle: { color: "white", fontWeight: "900", fontSize: 15 },
  reflectionCta: { color: "#cbd5f5", fontWeight: "900" },

  reflectionText: {
    color: "#cbd5f5",
    fontWeight: "700",
    lineHeight: 20,
  },
  reflectionEmpty: {
    color: "#94a3b8",
    fontWeight: "700",
    lineHeight: 20,
  },
});
