import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView } from "react-native";
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
import { PremiumBadge } from "@/components/premium-badge";

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

  const { data: books } = trpc.books.list.useQuery();
  const bookCount = books?.length || 0;
  const momentCount = books?.reduce((sum, book) => sum + (book.momentCount || 0), 0) || 0;

  const handleLanguageChange = async (languageCode: string) => {
    try {
      await i18n.changeLanguage(languageCode);
      await saveLanguage(languageCode);
      setCurrentLanguage(languageCode);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Language change error:", error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t("auth.signOut"),
      t("auth.signOutConfirm"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
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
              console.error("Logout error:", error);
              Alert.alert(t("common.error"), "An error occurred while signing out.");
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

  return (
    <ScreenContainer>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="p-6 pb-4">
          <Text className="text-3xl font-bold text-foreground">{t("profile.title")}</Text>
        </View>

        {/* User Info */}
        <View className="px-6 mb-6">
          <View className="bg-surface rounded-2xl p-6 border border-border">
            {/* Avatar */}
            <View className="items-center mb-4">
              <View className="w-20 h-20 rounded-full bg-primary items-center justify-center">
                <Text className="text-4xl text-background font-bold">
                  {user.email?.charAt(0).toUpperCase() || "?"}
                </Text>
              </View>
            </View>

            {/* Email */}
            <View className="items-center mb-2">
              <Text className="text-lg font-semibold text-foreground mb-1">
                {user.name || "User"}
              </Text>
              <Text className="text-sm text-muted mb-2">{user.email}</Text>
              {isPremium && (
                <View className="mt-2">
                  <PremiumBadge size="medium" />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Subscription Management (Premium Users) */}
        {isPremium && (
          <View className="px-6 mb-6">
            <Text className="text-sm font-semibold text-muted mb-3">ABONELİK YÖNETİMİ</Text>
            <View className="bg-surface rounded-2xl p-6 border border-border">
              {/* Premium Status */}
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-1">
                  <Text className="text-lg font-semibold text-foreground mb-1">
                    PALIMPS Premium
                  </Text>
                  <Text className="text-sm text-success">
                    ✓ Aktif
                  </Text>
                </View>
                <PremiumBadge size="large" />
              </View>

              {/* Subscription Info */}
              <View className="bg-background rounded-xl p-4 mb-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm text-muted">Abonelik Tipi</Text>
                  <Text className="text-sm font-semibold text-foreground">Aylık</Text>
                </View>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm text-muted">Fiyat</Text>
                  <Text className="text-sm font-semibold text-foreground">₺149.99/ay</Text>
                </View>
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm text-muted">Sonraki Yenileme</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('tr-TR')}
                  </Text>
                </View>
              </View>

              {/* Cancel Button */}
              <Pressable
                onPress={() => {
                  Alert.alert(
                    'Aboneliği İptal Et',
                    'Aboneliğinizi iptal etmek istediğinizden emin misiniz? Dönem sonuna kadar premium özellikleriniz aktif kalacak.',
                    [
                      {
                        text: 'Vazgeç',
                        style: 'cancel',
                      },
                      {
                        text: 'İptal Et',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            // TODO: Cancel subscription API call
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            Alert.alert('Başarılı', 'Aboneliğiniz iptal edildi. Dönem sonuna kadar premium özelliklerinizi kullanmaya devam edebilirsiniz.');
                          } catch (error) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            Alert.alert('Hata', 'İptal işlemi başarısız oldu. Lütfen tekrar deneyin.');
                          }
                        },
                      },
                    ]
                  );
                }}
                className="border border-error/30 px-4 py-3 rounded-xl"
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <Text className="text-error font-semibold text-center text-sm">
                  Aboneliği İptal Et
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Upgrade to Premium (Free Users) */}
        {!isPremium && (
          <View className="px-6 mb-6">
            <Pressable
              onPress={() => router.push('/premium')}
              className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6"
              style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-lg font-bold text-background mb-1">
                    ✨ Premium'a Geç
                  </Text>
                  <Text className="text-sm text-background/80">
                    Tüm AI özelliklerini sınırsız kullan
                  </Text>
                </View>
                <Text className="text-2xl">→</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Statistics */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-semibold text-muted mb-3">{t("profile.stats").toUpperCase()}</Text>
          <View className="bg-surface rounded-2xl p-6 border border-border">
            <View className="flex-row items-center justify-between">
              <View className="items-center flex-1">
                <Text className="text-3xl font-bold text-primary mb-1">{bookCount}</Text>
                <Text className="text-sm text-muted">{t("profile.totalBooks")}</Text>
              </View>
              <View className="w-px h-12 bg-border" />
              <View className="items-center flex-1">
                <Text className="text-3xl font-bold text-primary mb-1">{momentCount}</Text>
                <Text className="text-sm text-muted">{t("profile.totalMoments")}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Language Selection */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-semibold text-muted mb-3">{t("profile.language").toUpperCase()}</Text>
          <View className="bg-surface rounded-2xl border border-border overflow-hidden">
            {LANGUAGES.map((lang, index) => (
              <Pressable
                key={lang.code}
                onPress={() => handleLanguageChange(lang.code)}
                style={({ pressed }) => [
                  {
                    opacity: pressed ? 0.6 : 1,
                    backgroundColor: currentLanguage === lang.code ? colors.primary + "10" : "transparent",
                  },
                ]}
                className="px-6 py-4 flex-row items-center justify-between"
              >
                <Text
                  className="text-base"
                  style={{
                    color: currentLanguage === lang.code ? colors.primary : colors.foreground,
                    fontWeight: currentLanguage === lang.code ? "600" : "normal",
                  }}
                >
                  {lang.name}
                </Text>
                {currentLanguage === lang.code && (
                  <Text style={{ color: colors.primary }}>✓</Text>
                )}
                {index < LANGUAGES.length - 1 && (
                  <View
                    className="absolute bottom-0 left-6 right-6 h-px"
                    style={{ backgroundColor: colors.border }}
                  />
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Settings */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-semibold text-muted mb-3">{t("profile.settings").toUpperCase()}</Text>
          
          {/* Sign Out Button */}
          <Pressable
            onPress={handleLogout}
            disabled={isLoggingOut}
            className="bg-error/10 border border-error/20 px-6 py-4 rounded-2xl flex-row items-center justify-center"
            style={({ pressed }) => [
              {
                opacity: isLoggingOut ? 0.5 : pressed ? 0.9 : 1,
                transform: [{ scale: pressed && !isLoggingOut ? 0.98 : 1 }],
              },
            ]}
          >
            {isLoggingOut ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <Text className="text-xl mr-2">🚪</Text>
                <Text className="text-error font-semibold text-base">{t("auth.signOut")}</Text>
              </>
            )}
          </Pressable>
        </View>

        {/* App Version */}
        <View className="px-6 pb-8">
          <Text className="text-xs text-muted text-center">{t("app.name")} v3.0</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
