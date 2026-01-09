// app/_layout.tsx
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform, Pressable, Text, View } from "react-native";

function goBackSafely() {
  // modal 이면 닫기
  if (router.canDismiss()) {
    router.dismiss();
    return;
  }

  // 뒤로 갈 수 있으면 back
  if (router.canGoBack()) {
    router.back();
    return;
  }

  // 마지막 fallback: 홈
  router.replace("/");
}

const HeaderBackWithText = ({ label }: { label?: string }) => (
  <Pressable
    onPress={goBackSafely}
    style={{ paddingHorizontal: 12, paddingVertical: 8 }}
    hitSlop={10}
  >
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Text style={{ color: "#60a5fa", fontWeight: "900", fontSize: 20 }}>
        ←
      </Text>
      {label && (
        <Text style={{ color: "#60a5fa", fontWeight: "700", fontSize: 16 }}>
          {label}
        </Text>
      )}
    </View>
  </Pressable>
);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider value={theme}>
      <Stack
        screenOptions={{
          headerTitleAlign: "center",
          headerTitleStyle: {
            fontSize: 16,
            fontWeight: Platform.select({
              ios: "600",
              android: "700",
            }) as any,
          },
        }}
      >
        {/* 홈 */}
        <Stack.Screen
          name="index"
          options={{
            title: "내 판단 기록",
          }}
        />

        {/* 기록 */}
        <Stack.Screen
          name="record"
          options={{
            title: "기록하기",
            headerLeft: () => <HeaderBackWithText label="취소" />,
          }}
        />

        {/* 결과 입력 (모달) */}
        <Stack.Screen
          name="outcome"
          options={{
            title: "결과 입력",
            presentation: "modal",
            animation: "slide_from_bottom",
            headerLeft: () => <HeaderBackWithText />,
          }}
        />

        {/* 회고 (모달) */}
        <Stack.Screen
          name="review"
          options={{
            title: "회고",
            presentation: "modal",
            animation: "slide_from_bottom",
            headerLeft: () => <HeaderBackWithText />,
          }}
        />

        {/* 상세 */}
        <Stack.Screen
          name="detail"
          options={{
            title: "상세",
            headerLeft: () => <HeaderBackWithText />,
          }}
        />

        {/* 분석 */}
        <Stack.Screen
          name="analysis"
          options={{
            title: "분석",
            headerLeft: () => <HeaderBackWithText />,
          }}
        />

        {/* 주간 리포트 */}
        <Stack.Screen
          name="weekly-report"
          options={{
            title: "주간 리포트",
            headerLeft: () => <HeaderBackWithText />,
          }}
        />
      </Stack>

      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
