import { View, Text, TouchableOpacity } from "react-native";
import { updateDecisionResult } from "@/lib/api";

export default function DecisionCard({
  decision,
  onUpdated,
}: {
  decision: any;
  onUpdated: () => void;
}) {
  const submit = async (result: "win" | "loss") => {
    await updateDecisionResult(decision.id, {
      result,
      confidence: decision.confidence,
    });
    onUpdated();
  };

  return (
    <View className="bg-white p-4 rounded-xl mb-3 shadow">
      <Text className="text-base font-semibold">{decision.title}</Text>

      <Text className="text-xs text-gray-500 mt-1">
        확신도 {decision.confidence}/5
      </Text>

      {!decision.result ? (
        <View className="flex-row mt-3 space-x-3">
          <TouchableOpacity
            onPress={() => submit("win")}
            className="flex-1 bg-green-500 py-2 rounded-lg"
          >
            <Text className="text-white text-center">성공</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => submit("loss")}
            className="flex-1 bg-red-500 py-2 rounded-lg"
          >
            <Text className="text-white text-center">실패</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text className="mt-3 font-semibold">
          결과: {decision.result === "win" ? "성공" : "실패"}
        </Text>
      )}
    </View>
  );
}
