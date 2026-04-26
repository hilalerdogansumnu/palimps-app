import { View, Text, ActivityIndicator, Alert, Platform } from "react-native";
import { router } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import { notifyAuthChange } from "@/lib/_core/auth";

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
        throw new Error(
          `No identityToken from Apple. hasUser=${!!credential.user} hasName=${!!credential.fullName} apiUrl=${getApiBaseUrl()}`
        );
      }

      const result = await postToServer("/api/auth/apple", {
        identityToken: credential.identityToken,
        fullName: credential.fullName ?? null,
        email: credential.email ?? null,
        authorizationCode: credential.authorizationCode ?? null,
      });

      await persistSession(result);
      notifyAuthChange();
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
    <ScreenContainer className="items-center justify-center px-6">
      {/* Top: App name + tagline */}
      <View className="items-center">
        <Text
          style={{
            fontSize: 28,
            fontWeight: "700",
            letterSpacing: 2,
            color: colors.primary,
            marginBottom: 8,
          }}
        >
          PALIMPS
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: colors.muted,
            textAlign: "center",
          }}
        >
          {t("app.tagline")}
        </Text>
      </View>

      {/* Breathing gap */}
      <View style={{ height: 80 }} />

      {/* Apple Sign In or loading state */}
      {isLoading ? (
        <View className="w-full items-center gap-4">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ fontSize: 14, color: colors.muted }}>
            {t("auth.loggingIn")}
          </Text>
        </View>
      ) : Platform.OS === "ios" && appleAvailable ? (
        <View className="w-full">
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
        </View>
      ) : (
        <Text
          style={{
            fontSize: 14,
            color: colors.muted,
            textAlign: "center",
          }}
        >
          {t("auth.iosOnly")}
        </Text>
      )}

      {/* Privacy note with lock icon */}
      {!isLoading && (
        <View style={{ marginTop: 16, alignItems: "center" }}>
          <View className="flex-row items-center gap-2">
            <IconSymbol
              size={13}
              name="lock.fill"
              color={colors.muted}
            />
            <Text
              style={{
                fontSize: 13,
                color: colors.muted,
                textAlign: "center",
              }}
            >
              {t("auth.privacyNote")}
            </Text>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}
