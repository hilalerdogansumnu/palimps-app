import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useState } from "react";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const colors = useColors();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const redirectUrl = Linking.createURL("/oauth/callback");
      const authUrl = `${process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000"}/auth/login?redirect_uri=${encodeURIComponent(redirectUrl)}`;
      
      await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      
      // Kullanıcı giriş yaptıktan sonra ana ekrana yönlendir
      router.replace("/");
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="items-center justify-center p-6">
      <View className="items-center mb-8">
        <Text className="text-4xl font-bold text-foreground mb-4">Okuma Hafızası</Text>
        <Text className="text-base text-muted text-center">
          Basılı kitaplarınızı ve okuma anılarınızı kaydedin.
        </Text>
      </View>

      <Pressable
        onPress={handleLogin}
        disabled={isLoading}
        className="bg-primary px-12 py-4 rounded-full"
        style={({ pressed }) => [
          {
            opacity: isLoading ? 0.5 : pressed ? 0.9 : 1,
            transform: [{ scale: pressed && !isLoading ? 0.97 : 1 }],
          },
        ]}
      >
        <Text className="text-background font-semibold text-base">
          {isLoading ? "Yükleniyor..." : "Giriş Yap"}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.back()}
        className="mt-6 p-2"
        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
      >
        <Text className="text-muted text-sm">← Geri Dön</Text>
      </Pressable>
    </ScreenContainer>
  );
}
