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
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          {/* Avatar */}
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "bold", color: "white" }}>
              {initial}
            </Text>
          </View>

          {/* Name + Stats */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ fontSize: 22, fontWeight: "600", color: colors.foreground, marginRight: 8 }}>
                {displayName}
              </Text>
              {isPremium && (
                <View
                  style={{
                    backgroundColor: colors.accent + "33",
                    borderRadius: 12,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.accent }}>
                    Premium
                  </Text>
                </View>
              )}
            </View>
            <Text style={{ fontSize: 14, color: colors.muted }}>
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
              >
                <Text style={{ fontSize: 16, color: colors.foreground }}>
                  Premium
                </Text>
                <Text style={{ fontSize: 14, color: colors.accent }}>
                  Yükselt ›
                </Text>
              </Pressable>
            )}

            {/* Subscription Row (only for premium users) */}
            {isPremium && (
              <Pressable
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 16, color: colors.foreground }}>
                  Abonelik
                </Text>
                <Text style={{ fontSize: 14, color: colors.success }}>
                  Aktif ›
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Sign Out Section */}
        <View style={{ marginHorizontal: 24, marginBottom: 32 }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 16,
              overflow: "hidden",
              borderWidth: 0.5,
              borderColor: colors.border,
            }}
          >
            <Pressable
              onPress={handleLogout}
              disabled={isLoggingOut}
              style={({ pressed }) => [
                {
                  paddingHorizontal: 16,
                  paddingVertical: 16,
                  opacity: isLoggingOut ? 0.5 : pressed ? 0.6 : 1,
                },
              ]}
            >
              {isLoggingOut ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text style={{ fontSize: 16, color: colors.error }}>
                  Çıkış Yap
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Version */}
        <View style={{ paddingBottom: 32 }}>
          <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center" }}>
            PALIMPS v4.0
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
