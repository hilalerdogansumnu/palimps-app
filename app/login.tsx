import { View, Text, Pressable, ActivityIndicator } from "react-native";
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
        // OAuth callback handler will handle the redirect
        await new Promise(resolve => setTimeout(resolve, 2000));
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
          PALIMPS
        </Text>
        <Text className="text-sm text-muted text-center">
          Personal Reading Memory System
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
              Continue with Google
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
              Continue with Apple
            </Text>
          )}
        </Pressable>
      </View>

      {/* Privacy note (subtle) */}
      <View className="mt-16">
        <Text className="text-xs text-muted text-center">
          Your reading data stays private
        </Text>
      </View>
    </ScreenContainer>
  );
}
