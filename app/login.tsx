import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getApiBaseUrl } from "@/constants/oauth";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<string | null>(null);

  const handleLogin = async (authProvider: "google" | "apple") => {
    setIsLoading(true);
    setProvider(authProvider);
    try {
      const redirectUrl = Linking.createURL("/oauth/callback");
      const apiUrl = getApiBaseUrl() || "http://localhost:3000";
      const authUrl = `${apiUrl}/auth/login/${authProvider}?redirect_uri=${encodeURIComponent(redirectUrl)}&platform=mobile`;
      
      console.log("[Login] Starting OAuth flow:", {
        provider: authProvider,
        redirectUrl,
        authUrl,
      });
      
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      
      console.log("[Login] WebBrowser result:", result);
      
      if (result.type === "success") {
        console.log("[Login] OAuth success, waiting for callback...");
        // OAuth callback handler will handle the redirect
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else if (result.type === "cancel") {
        console.log("[Login] User cancelled OAuth");
      } else {
        console.log("[Login] OAuth failed:", result);
      }
    } catch (error) {
      console.error("[Login] Login error:", error);
    } finally {
      setIsLoading(false);
      setProvider(null);
    }
  };

  return (
    <ScreenContainer className="items-center justify-center px-8">
      {/* Logo and tagline (quiet, minimal) */}
      <View className="items-center mb-16">
        <Text className="text-lg text-foreground mb-2 font-medium tracking-wide">
          {t("app.name")}
        </Text>
        <Text className="text-sm text-muted text-center">
          {t("app.tagline")}
        </Text>
      </View>

      {/* OAuth buttons (minimal, clean) */}
      <View className="w-full max-w-xs gap-4">
        {/* Google Sign In */}
        <Pressable
          onPress={() => handleLogin("google")}
          disabled={isLoading}
          style={({ pressed }) => [
            {
              opacity: isLoading ? 0.5 : pressed ? 0.6 : 1,
              paddingVertical: 16,
              paddingHorizontal: 24,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              alignItems: "center",
            },
          ]}
        >
          {isLoading && provider === "google" ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <Text style={{ fontSize: 15, color: colors.foreground }}>
              {t("auth.continueWithGoogle")}
            </Text>
          )}
        </Pressable>

        {/* Apple Sign In */}
        <Pressable
          onPress={() => handleLogin("apple")}
          disabled={isLoading}
          style={({ pressed }) => [
            {
              opacity: isLoading ? 0.5 : pressed ? 0.6 : 1,
              paddingVertical: 16,
              paddingHorizontal: 24,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              alignItems: "center",
            },
          ]}
        >
          {isLoading && provider === "apple" ? (
            <ActivityIndicator size="small" color={colors.foreground} />
          ) : (
            <Text style={{ fontSize: 15, color: colors.foreground }}>
              {t("auth.continueWithApple")}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Privacy note (subtle) */}
      <View className="mt-16">
        <Text className="text-xs text-muted text-center">
          {t("auth.privacyNote")}
        </Text>
      </View>
    </ScreenContainer>
  );
}
