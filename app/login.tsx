import { View, Text, Pressable, ActivityIndicator, Image } from "react-native";
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
  const [provider, setProvider] = useState<string | null>(null);

  const handleLogin = async (authProvider: "google" | "apple") => {
    setIsLoading(true);
    setProvider(authProvider);
    try {
      const redirectUrl = Linking.createURL("/oauth/callback");
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";
      const authUrl = `${apiUrl}/auth/login/${authProvider}?redirect_uri=${encodeURIComponent(redirectUrl)}`;
      
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      
      if (result.type === "success") {
        // Başarılı giriş sonrası ana ekrana yönlendir
        router.replace("/");
      }
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
      setProvider(null);
    }
  };

  return (
    <ScreenContainer className="items-center justify-center p-6">
      {/* Logo ve Başlık */}
      <View className="items-center mb-12">
        <View className="w-24 h-24 rounded-3xl bg-primary items-center justify-center mb-6">
          <Text className="text-5xl">📚</Text>
        </View>
        <Text className="text-4xl font-bold text-foreground mb-3">Okuma Hafızası</Text>
        <Text className="text-base text-muted text-center leading-relaxed px-4">
          Basılı kitaplarınızdan sayfa fotoğrafı çekerek{"\n"}okuma anılarınızı kaydedin ve saklayın.
        </Text>
      </View>

      {/* OAuth Butonları */}
      <View className="w-full max-w-sm gap-4">
        {/* Google ile Giriş */}
        <Pressable
          onPress={() => handleLogin("google")}
          disabled={isLoading}
          className="bg-background border-2 border-border px-6 py-4 rounded-2xl flex-row items-center justify-center"
          style={({ pressed }) => [
            {
              opacity: isLoading ? 0.5 : pressed ? 0.9 : 1,
              transform: [{ scale: pressed && !isLoading ? 0.98 : 1 }],
            },
          ]}
        >
          {isLoading && provider === "google" ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <>
              <Text className="text-2xl mr-3">🔍</Text>
              <Text className="text-foreground font-semibold text-base">
                Google ile Giriş Yap
              </Text>
            </>
          )}
        </Pressable>

        {/* Apple ile Giriş */}
        <Pressable
          onPress={() => handleLogin("apple")}
          disabled={isLoading}
          className="bg-foreground px-6 py-4 rounded-2xl flex-row items-center justify-center"
          style={({ pressed }) => [
            {
              opacity: isLoading ? 0.5 : pressed ? 0.9 : 1,
              transform: [{ scale: pressed && !isLoading ? 0.98 : 1 }],
            },
          ]}
        >
          {isLoading && provider === "apple" ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <>
              <Text className="text-2xl mr-3">🍎</Text>
              <Text className="text-background font-semibold text-base">
                Apple ile Giriş Yap
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* Bilgilendirme */}
      <Text className="text-xs text-muted text-center mt-8 px-8 leading-relaxed">
        Giriş yaparak Kullanım Koşulları ve Gizlilik Politikası'nı kabul etmiş olursunuz.
      </Text>
    </ScreenContainer>
  );
}
