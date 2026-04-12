import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView, Modal } from "react-native";
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

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "tr", name: "Türkçe" },
  { code: "de", name: "Deutsch" },
  { code: "es", name: "Español" },
];

export default function ProfileScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { isPremium } = useSubscription();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

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
        {/* Header — compact, personal */}
        <View className="px-6 pt-6 pb-8">
          <View className="flex-row items-center">
            {/* Small avatar */}
            <View
              className="w-14 h-14 rounded-full items-center justify-center mr-4"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-2xl font-bold" style={{ color: colors.background }}>
                {initial}
              </Text>
            </View>

            {/* Name + status */}
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-xl font-semibold text-foreground">
                  {displayName}
                </Text>
                {isPremium && (
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: colors.primary + "20" }}
                  >
                    <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                      Premium
                    </Text>
                  </View>
                )}
              </View>
              {/* Reading stats inline — subtle, not a whole card */}
              <Text className="text-sm text-muted mt-1">
                {bookCount} {t("profile.totalBooks").toLowerCase()} · {momentCount} {t("profile.totalMoments").toLowerCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Settings list — iOS Settings style */}
        <View className="px-6 mb-6">
          <Text className="text-xs font-semibold text-muted mb-2 ml-1">
            {t("profile.settings").toUpperCase()}
          </Text>
          <View className="rounded-2xl overflow-hidden border border-border" style={{ backgroundColor: colors.surface }}>
            {/* Language row */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowLanguagePicker(true);
              }}
              className="px-4 py-3.5 flex-row items-center justify-between border-b border-border"
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <Text className="text-base text-foreground">{t("profile.language")}</Text>
              <View className="flex-row items-center">
                <Text className="text-base text-muted mr-1">{currentLanguageName}</Text>
                <Text className="text-sm text-muted">›</Text>
              </View>
            </Pressable>

            {/* Premium row (only for free users) */}
            {!isPremium && (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/premium");
                }}
                className="px-4 py-3.5 flex-row items-center justify-between border-b border-border"
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Text className="text-base text-foreground">Premium</Text>
                <Text className="text-sm text-muted">›</Text>
              </Pressable>
            )}

            {/* Sign out row */}
            <Pressable
              onPress={handleLogout}
              disabled={isLoggingOut}
              className="px-4 py-3.5 flex-row items-center justify-between"
              style={({ pressed }) => [{ opacity: isLoggingOut ? 0.5 : pressed ? 0.6 : 1 }]}
            >
              {isLoggingOut ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text className="text-base" style={{ color: colors.error }}>
                  {t("auth.signOut")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* App Version — bottom */}
        <View className="px-6 pb-8">
          <Text className="text-xs text-muted text-center">
            {t("app.name")} v3.0
          </Text>
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onPress={() => setShowLanguagePicker(false)}
        >
          <Pressable
            className="w-72 rounded-2xl overflow-hidden"
            style={{ backgroundColor: colors.background }}
            onPress={() => {}} // prevent close on inner press
          >
            <View className="px-5 py-4 border-b border-border">
              <Text className="text-lg font-semibold text-foreground">
                {t("profile.language")}
              </Text>
            </View>
            {LANGUAGES.map((lang, index) => (
              <Pressable
                key={lang.code}
                onPress={() => handleLanguageChange(lang.code)}
                className="px-5 py-3.5 flex-row items-center justify-between"
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.6 : 1,
                    backgroundColor: currentLanguage === lang.code ? colors.primary + "10" : "transparent",
                    borderBottomWidth: index < LANGUAGES.length - 1 ? 0.5 : 0,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Text
                  className="text-base"
                  style={{
                    color: currentLanguage === lang.code ? colors.primary : colors.foreground,
                    fontWeight: currentLanguage === lang.code ? "600" : "400",
                  }}
                >
                  {lang.name}
                </Text>
                {currentLanguage === lang.code && (
                  <Text style={{ color: colors.primary, fontSize: 16 }}>✓</Text>
                )}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}
