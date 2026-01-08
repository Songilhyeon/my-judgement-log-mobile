import { View, Text, TouchableOpacity } from "react-native";

export default function PendingBanner({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  if (count === 0) return null;

  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-yellow-100 border border-yellow-300 rounded-xl p-4 mb-4"
    >
      <Text className="font-semibold text-yellow-900">
        아직 결과를 입력하지 않은 판단이 {count}개 있어요
      </Text>
      <Text className="text-xs text-yellow-700 mt-1">탭해서 확인하기 →</Text>
    </TouchableOpacity>
  );
}
