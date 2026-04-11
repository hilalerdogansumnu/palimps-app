import { View, Text, ActivityIndicator, Alert, Platform } from "react-native";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

type ServerAuthResponse = {
  sessionToken: string;
  user: {
    id: number;
    openId: string;
    name: string | null;
    email: string | null;
    loginMethod: string | null;
    isPremium?: number;
    lastSignedIn: string;
  };
};

async function postToServer(
  path: "/api/auth/apple",
  body: Record<string, unknown>,
): Promise<ServerAuthResponse> {
  const apiUrl = getApiBaseUrl();
  if (!apiUrl) {
    throw new Error("API base URL is not configured");
  }
  const res = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Server returned ${res.status}: ${text}`);
  }
  return res.json();
}

async function persistSession(result: ServerAuthResponse) {
  await Auth.setSessionToken(result.sessionToken);
  await Auth.setUserInfo({
    id: result.user.id,
    openId: result.user.openId,
    name: result.user.name,
    email: result.user.email,
    loginMethod: result.user.loginMethod,
    isPremium: result.user.isPremium ?? 0,
    lastSignedIn: new Date(result.user.lastSignedIn || Date.now()),
  });
}

export default function LoginScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync()
        .then(setAppleAvailable)
        .catch(() => setAppleAvailable(false));
    }
  }, []);

  const handleAppleLogin = async () => {
    setIsLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error("No identityToken returned by Apple");
      }

      const result = await postToServer("/api/auth/apple", {
        identityToken: credential.identityToken,
        // Apple only sends fullName + email on the FIRST sign-in. We forward
        // them so the server can persist them on first save; the server is
        // careful not to overwrite an existing record.
        fullName: credential.fullName ?? null,
        email: credential.email ?? null,
      });

      await persistSession(result);
      router.replace("/(tabs)");
    } catch (err: any) {
      if (err?.code === "ERR_REQUEST_CANCELED") {
        // User cancelled the sheet — quietly return.
      } else {
        console.error("[Login/Apple] failed:", err);
        Alert.alert(t("auth.errorTitle"), t("auth.appleError"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="items-center justify-center px-8">
      <View className="items-center mb-16">
        <Text className="text-lg text-foreground mb-2 font-medium tracking-wide">
          {t("app.name")}
        </Text>
        <Text className="text-sm text-muted text-center">{t("app.tagline")}</Text>
      </View>

      <View className="w-full max-w-xs gap-4">
        {/* Apple Sign In — the only auth method, per Apple ecosystem design */}
        {Platform.OS === "ios" && appleAvailable ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={
              AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={12}
            style={{ width: "100%", height: 52 }}
            onPress={handleAppleLogin}
          />
        ) : (
          <View
            style={{
              paddingVertical: 16,
              paddingHorizontal: 24,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center" }}>
              {t("auth.iosOnly")}
            </Text>
          </View>
        )}

        {isLoading && (
          <View style={{ alignItems: "center", marginTop: 12 }}>
            <ActivityIndicator size="small" color={colors.foreground} />
          </View>
        )}
      </View>

      <View className="mt-16">
        <Text className="text-xs text-muted text-center">{t("auth.privacyNote")}</Text>
      </View>
    </ScreenContainer>
  );
}
