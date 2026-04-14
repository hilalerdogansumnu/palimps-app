import { ActivityIndicator, Alert, ScrollView, Pressable, View, Text } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { saveLanguage } from "@/lib/i18n";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { useSubscription } from "@/hooks/use-subscription";
import { a11y } from "@/lib/accessibility";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "tr", name: "Türkçe" },
];

export default function ProfileScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { isPremium } = useSubscription();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation();

  const { data: books } = trpc.books.list.useQuery();
  const bookCount = books?.length || 0;
  const momentCount = books?.reduce((sum, book) => sum + (book.momentCount || 0), 0) || 0;

  const currentLanguageName = LANGUAGES.find((l) => l.code === currentLanguage)?.name || "English";

  const handleLanguageChange = async (languageCode: string) => {
    try {
      await i18n.changeLanguage(languageCode);
      await saveLanguage(languageCode);
      setCurrentLanguage(languageCode);
      setShowLanguagePicker(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      // silently fail
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t("profile.deleteAccountConfirmTitle"),
      t("profile.deleteAccountConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.deleteAccount"),
          style: "destructive",
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              await deleteAccountMutation.mutateAsync();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace("/login");
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(t("common.error"), t("profile.deleteAccountError"));
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      t("auth.signOut"),
      t("auth.signOutConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("auth.signOut"),
          style: "destructive",
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace("/login");
            } catch (error) {
              Alert.alert(t("common.error"), t("auth.logoutError"));
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  // Display name: use Apple name if available, otherwise extract from email, fallback to "Reader"
  const displayName = user.name || t("profile.reader");
  const initial = (user.name?.charAt(0) || user.email?.charAt(0) || "?").toUpperCase();

  return (
    <ScreenContainer>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header — iOS Large Title */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.foreground }}>
            Profil
          </Text>
        </View>

        {/* User Card */}
        <View
          style={{
            marginHorizontal: 24,
            marginBottom: 32,
            paddingVertical: 16,
            paddingHorizontal: 16,
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 0.5,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.primary + "33",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: "700", color: colors.primary }}>
              {initial}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, marginBottom: 4 }}>
              {displayName}
            </Text>
            {isPremium && (
              <View
                style={{
                  backgroundColor: colors.accent + "33",
                  borderRadius: 12,
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  alignSelf: "flex-start",
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.accent }}>
                  Premium
                </Text>
              </View>
            )}
            <Text style={{ fontSize: 14, color: colors.muted, marginTop: 8 }}>
              {bookCount} kitap · {momentCount} an
            </Text>
          </View>
        </View>

        {/* Settings Section */}
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
            AYARLAR
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
            {/* Notifications Row */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/notification-settings");
              }}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.border,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={a11y.notifications.label}
              accessibilityHint={a11y.notifications.hint}
            >
              <Text style={{ fontSize: 16, color: colors.foreground }}>
                {t("notifications.title")}
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted }}>›</Text>
            </Pressable>

            {/* Language Row */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowLanguagePicker(true);
              }}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.border,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={a11y.language.label}
              accessibilityHint={a11y.language.hint}
            >
              <Text style={{ fontSize: 16, color: colors.foreground }}>
                Dil
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 14, color: colors.muted, marginRight: 4 }}>
                  {currentLanguageName}
                </Text>
                <Text style={{ fontSize: 14, color: colors.muted }}>›</Text>
              </View>
            </Pressable>

            {/* Premium Row (only for free users) */}
            {!isPremium && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/premium");
                }}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.border,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel={a11y.upgradePremium.label}
                accessibilityHint={a11y.upgradePremium.hint}
              >
                <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: "600" }}>
                  Premium'e Yükselt
                </Text>
                <Text style={{ fontSize: 14, color: colors.muted }}>›</Text>
              </Pressable>
            )}

            {/* Logout Row */}
            <Pressable
              onPress={handleLogout}
              disabled={isLoggingOut}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.border,
                  opacity: pressed || isLoggingOut ? 0.6 : 1,
                },
              ]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={a11y.logout.label}
              accessibilityHint={a11y.logout.hint}
            >
              <Text style={{ fontSize: 16, color: colors.error }}>
                {t("auth.signOut")}
              </Text>
              {isLoggingOut ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text style={{ fontSize: 14, color: colors.muted }}>›</Text>
              )}
            </Pressable>

            {/* Privacy Policy Row */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                import("expo-linking").then(({ default: Linking }) => {
                  Linking.openURL("https://palimps.app/privacy");
                });
              }}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.border,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
              accessible={true}
              accessibilityRole="link"
              accessibilityLabel="Gizlilik Politikası"
              accessibilityHint="Gizlilik politikası sayfasını açar"
            >
              <Text style={{ fontSize: 16, color: colors.foreground }}>
                Gizlilik Politikası
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted }}>›</Text>
            </Pressable>

            {/* Delete Account Row */}
            <Pressable
              onPress={handleDeleteAccount}
              disabled={isDeletingAccount}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: pressed || isDeletingAccount ? 0.6 : 1,
                },
              ]}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Hesabı Sil"
              accessibilityHint="Tüm verilerinizi kalıcı olarak siler"
            >
              <Text style={{ fontSize: 16, color: colors.error, opacity: 0.7 }}>
                Hesabı Sil
              </Text>
              {isDeletingAccount ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text style={{ fontSize: 14, color: colors.muted }}>›</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Language Picker Modal */}
        {showLanguagePicker && (
          <View
            style={{
              marginHorizontal: 24,
              marginBottom: 24,
              backgroundColor: colors.surface,
              borderRadius: 16,
              borderWidth: 0.5,
              borderColor: colors.border,
              overflow: "hidden",
            }}
          >
            {LANGUAGES.map((lang, index) => (
              <Pressable
                key={lang.code}
                onPress={() => handleLanguageChange(lang.code)}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottomWidth: index < LANGUAGES.length - 1 ? 0.5 : 0,
                    borderBottomColor: colors.border,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
                accessible={true}
                accessibilityRole="radio"
                accessibilityLabel={lang.name}
                accessibilityState={{ selected: currentLanguage === lang.code }}
              >
                <Text style={{ fontSize: 16, color: colors.foreground }}>
                  {lang.name}
                </Text>
                {currentLanguage === lang.code && (
                  <Text style={{ fontSize: 18, color: colors.primary }}>✓</Text>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Footer spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenContainer>
  );
}
