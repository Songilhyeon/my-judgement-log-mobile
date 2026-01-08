import { View, Text, TouchableOpacity } from "react-native";

export default function ConfidenceSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View className="flex-row justify-between">
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity
          key={n}
          onPress={() => onChange(n)}
          className={`w-12 h-12 rounded-full items-center justify-center ${
            value === n ? "bg-black" : "bg-gray-200"
          }`}
        >
          <Text
            className={`font-semibold ${
              value === n ? "text-white" : "text-black"
            }`}
          >
            {n}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
