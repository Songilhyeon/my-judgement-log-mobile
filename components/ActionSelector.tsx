// components/ActionSelector.tsx (예시)
import { View, Pressable, Text, StyleSheet } from "react-native";

export default function ActionSelector({
  value,
  onChange,
}: {
  value: "buy" | "sell";
  onChange: (v: "buy" | "sell") => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange("buy")}
        style={[styles.btn, value === "buy" && styles.active]}
      >
        <Text style={[styles.btnText, value === "buy" && styles.activeText]}>
          BUY
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onChange("sell")}
        style={[styles.btn, value === "sell" && styles.active]}
      >
        <Text style={[styles.btnText, value === "sell" && styles.activeText]}>
          SELL
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12 },
  btn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0b1220",
    alignItems: "center",
  },
  btnText: {
    color: "#e2e8f0", // ✅ 다크에서 보이게
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  active: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  activeText: { color: "white" },
});
