import { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";

import { ScreenContainer } from "@/components/screen-container";
import { NavigationBar } from "@/components/navigation-bar";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";

/**
 * Hesap bilgileri + hesap silme ekranı.
 *
 * Silme ana profil listesinden çıkarıldı çünkü yanlışlıkla tıklama riski
 * yüksekti. Burada ayrı bir "Tehlikeli Bölge" bloğunun içinde — kullanıcı
 * gerçekten silmeyi düşünüyorsa aramak zorunda.
 */
export default function AccountScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const deletePromptOpenRef = useRef(false);

  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation();

  // Free user'a ücretsiz kullanım kartı — Linear tarzı: iki satır progress,
  // sessiz, kaygı yaratmayan. Pro user'da query null döner, kart hiç render
  // edilmez.
  const usageQuery = trpc.subscriptions.usage.useQuery();
  const usage = usageQuery.data;
  const showUsageCard =
    !!usage && usage.isPremium === false && !!usage.books && !!usage.assistantQuestions;

  const handleDeleteAccount = () => {
    if (deletePromptOpenRef.current) return;
    deletePromptOpenRef.current = true;
    Alert.alert(
      t("profile.deleteAccountConfirmTitle"),
      t("profile.deleteAccountConfirmMessage"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
          onPress: () => {
            deletePromptOpenRef.current = false;
          },
        },
        {
          text: t("profile.deleteAccount"),
          style: "destructive",
          onPress: async () => {
            deletePromptOpenRef.current = false;
            setIsDeletingAccount(true);
            try {
              await deleteAccountMutation.mutateAsync();
              // Backend tarafında cookie temizlendi ama native session token
              // hâlâ AsyncStorage'ta — logout() onu da temizliyor.
              await logout().catch(() => {});
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace("/login");
            } catch {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(t("common.error"), t("profile.deleteAccountError"));
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <NavigationBar
        title={t("profile.accountTitle")}
        backLabel={t("profile.title")}
        onBack={() => router.back()}
      />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* Account info */}
        <View style={{ marginHorizontal: 24, marginTop: 24, marginBottom: 32 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: colors.muted,
              marginBottom: 8,
              marginLeft: 4,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {t("profile.accountTitle")}
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              overflow: "hidden",
              borderWidth: 0.5,
              borderColor: colors.border,
            }}
          >
            {/* Email row */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottomWidth: 0.5,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 16, color: colors.foreground }}>
                {t("profile.accountEmail")}
              </Text>
              <Text
                style={{ fontSize: 14, color: colors.muted, maxWidth: "60%" }}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {user?.email || t("profile.accountNoEmail")}
              </Text>
            </View>

            {/* Login method */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 16, color: colors.foreground }}>
                {t("profile.accountLoginMethod")}
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted }}>
                {t("profile.accountLoginMethodApple")}
              </Text>
            </View>
          </View>
        </View>

        {/* Free tier usage — 5/5 kitap · 10/10 Hafıza. Sayılar şişirmiyor,
            sakin progress bar'lar. Pro user'da gösterilmez (zaten sınırsız
            pazarlıyoruz, numara üretmek hayal kırıklığı olur). */}
        {showUsageCard && usage.books && usage.assistantQuestions ? (
          <View style={{ marginHorizontal: 24, marginBottom: 24 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.muted,
                marginBottom: 8,
                marginLeft: 4,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {t("freemium.usage.title")}
            </Text>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                overflow: "hidden",
                borderWidth: 0.5,
                borderColor: colors.border,
              }}
            >
              <UsageRow
                label={t("freemium.usage.booksLabel")}
                used={usage.books.used}
                limit={usage.books.limit}
                colors={colors}
                showDivider
              />
              <UsageRow
                label={t("freemium.usage.assistantLabel")}
                used={usage.assistantQuestions.used}
                limit={usage.assistantQuestions.limit}
                colors={colors}
              />
            </View>
            <Text
              style={{
                fontSize: 12,
                color: colors.muted,
                lineHeight: 17,
                marginTop: 8,
                marginHorizontal: 16,
              }}
            >
              {t("freemium.usage.lifetimeNote")}
            </Text>
          </View>
        ) : null}

        {/* Delete account — iOS HIG "inset grouped" pattern: tek satır
            destructive button (ortalanmış, kırmızı), altında küçük footer
            açıklaması. "Tehlikeli Bölge" header'ı kaldırıldı çünkü iOS
            Settings'te de böyle bir başlık yok — tek satırda yeterince net. */}
        <View style={{ marginHorizontal: 24, marginTop: 8 }}>
          <Pressable
            onPress={handleDeleteAccount}
            disabled={isDeletingAccount}
            style={({ pressed }) => ({
              backgroundColor: colors.surface,
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 0.5,
              borderColor: colors.border,
              opacity: pressed || isDeletingAccount ? 0.6 : 1,
            })}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t("profile.deleteAccount")}
            accessibilityHint={t("profile.deleteAccountHint")}
          >
            {isDeletingAccount ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <Text style={{ fontSize: 16, color: colors.error, fontWeight: "400" }}>
                {t("profile.deleteAccount")}
              </Text>
            )}
          </Pressable>
          <Text
            style={{
              fontSize: 12,
              color: colors.muted,
              lineHeight: 17,
              marginTop: 8,
              marginHorizontal: 16,
            }}
          >
            {t("profile.dangerZoneDesc")}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

interface UsageRowProps {
  label: string;
  used: number;
  limit: number;
  colors: ReturnType<typeof useColors>;
  showDivider?: boolean;
}

/**
 * Row with "Label · used/limit · progress bar". Progress bar'ın genişliği
 * foreground'daki yoğunlukla: %100'de yumuşakça accent'e kayar ama kırmızı
 * kullanmıyoruz (bu bir alarm değil).
 */
function UsageRow({ label, used, limit, colors, showDivider }: UsageRowProps) {
  const pct = Math.min(1, limit > 0 ? used / limit : 0);
  const isFull = used >= limit;
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: showDivider ? 0.5 : 0,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <Text style={{ fontSize: 16, color: colors.foreground }}>{label}</Text>
        <Text
          style={{
            fontSize: 14,
            color: isFull ? colors.accent : colors.muted,
            fontWeight: isFull ? "600" : "400",
            fontVariant: ["tabular-nums"],
          }}
        >
          {used}/{limit}
        </Text>
      </View>
      <View
        style={{
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            backgroundColor: isFull ? colors.accent : colors.primary,
            borderRadius: 2,
          }}
        />
      </View>
    </View>
  );
}
