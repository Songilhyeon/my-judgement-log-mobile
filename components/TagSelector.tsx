import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  selected: string[];
  onChange: (tags: string[]) => void;
};

const MAX = 5;

export const TAGS = [
  "실적",
  "차트",
  "뉴스",
  "수급",
  "저평가",
  "고평가",
  "단기",
  "중기",
  "장기",
  "리스크 있음",
];

export default function TagSelector({ selected, onChange }: Props) {
  const toggle = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      if (selected.length >= MAX) return;
      onChange([...selected, tag]);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        투자 근거 선택 ({selected.length}/{MAX})
      </Text>

      <View style={styles.container}>
        {TAGS.map((tag) => {
          const active = selected.includes(tag);
          return (
            <Pressable
              key={tag}
              onPress={() => toggle(tag)}
              style={[styles.tag, active && styles.active]}
            >
              <Text style={styles.text}>{tag}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 32,
  },
  label: {
    color: "#cbd5f5",
    marginBottom: 12,
  },
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#334155",
  },
  active: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  text: {
    color: "white",
    fontSize: 13,
  },
});
