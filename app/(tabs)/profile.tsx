import { ActionSheetIOS, ActivityIndicator, Alert, ScrollView, Pressable, View, Text } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { saveLanguage } from "@/lib/i18n";
import { captureException } from "@/lib/_core/sentry";

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

  // P0-5 re-entrancy guard: a fast double-tap on Çıkış Yap / Hesabı Sil
  // previously fired Alert.alert twice, stacking two native alerts and
  // producing the ghost-text artifact seen in the QA video at 2:11-2:12.
  // Refs instead of state to avoid an extra render on every tap.
  const logoutPromptOpenRef = useRef(false);
  const deletePromptOpenRef = useRef(false);

  const deleteAccountMutation = trpc.auth.deleteAccount.useMutation();

  const { data: books } = trpc.books.list.useQuery();
  const bookCount = books?.length || 0;
  const momentCount = books?.reduce((sum, book) => sum + (book.momentCount || 0), 0) || 0;

  const currentLanguageName = LANGUAGES.find((l) => l.code === currentLanguage)?.name || "English";

  const applyLanguage = async (languageCode: string) => {
    if (languageCode === currentLanguage) return;
    try {
      await i18n.changeLanguage(languageCode);
      await saveLanguage(languageCode);
      setCurrentLanguage(languageCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      // P1-1: Previously a silent catch hid failures. Language persistence
      // failures are rare but not invisible — tell the user and capture it.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      captureException(
        error instanceof Error ? error : new Error("applyLanguage failed"),
        { surface: "profile.language", languageCode },
      );
      Alert.alert(t("common.error"), t("profile.languageChangeError"));
    }
  };

  /**
   * Present a native iOS action sheet for language selection. Previously the
   * picker rendered as an inline panel at the bottom of the ScrollView —
   * disconnected from the row the user tapped and not dismissible without
   * making a selection. ActionSheetIOS matches iOS Settings conventions:
   * the current language shows a trailing check in the button label and the
   * user can cancel at any time.
   */
  const handleOpenLanguagePicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const languages = LANGUAGES;
    const options = [
      ...languages.map((l) =>
        l.code === currentLanguage ? `${l.name}  ✓` : l.name,
      ),
      t("common.cancel"),
    ];
    const cancelButtonIndex = options.length - 1;

    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t("profile.language"),
        options,
        cancelButtonIndex,
        userInterfaceStyle: colors.background === "#000000" ? "dark" : undefined,
      },
      (selectedIndex) => {
        if (selectedIndex === cancelButtonIndex || selectedIndex === undefined) return;
        const picked = languages[selectedIndex];
        if (picked) applyLanguage(picked.code);
      },
    );
  };

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
      ],
    );
  };

  const handleLogout = () => {
    if (logoutPromptOpenRef.current) return;
    logoutPromptOpenRef.current = true;
    Alert.alert(
      t("auth.signOut"),
      t("auth.signOutConfirm"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
          onPress: () => {
            logoutPromptOpenRef.current = false;
          },
        },
        {
          text: t("auth.signOut"),
          style: "destructive",
          onPress: async () => {
            logoutPromptOpenRef.current = false;
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
      ],
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
            {t("profile.title")}
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
              {t("profile.bookCountSummary", { count: bookCount })} · {t("profile.momentCountSummary", { count: momentCount })}
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
            {t("profile.settings")}
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
              onPress={handleOpenLanguagePicker}
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
                {t("profile.language")}
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
                  {t("profile.upgradePremium")}
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
              accessibilityLabel={t("profile.deleteAccount")}
              accessibilityHint={t("profile.deleteAccountHint")}
            >
              <Text style={{ fontSize: 16, color: colors.error, opacity: 0.7 }}>
                {t("profile.deleteAccount")}
              </Text>
              {isDeletingAccount ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text style={{ fontSize: 14, color: colors.muted }}>›</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Footer spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenContainer>
  );
}
