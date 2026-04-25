import { ActionSheetIOS, ActivityIndicator, Alert, ScrollView, Pressable, View, Text } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n, { saveLanguage } from "@/lib/i18n";
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
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

  // P0-5 re-entrancy guard: a fast double-tap on Çıkış Yap previously fired
  // Alert.alert twice, stacking two native alerts and producing the ghost-
  // text artifact seen in the QA video at 2:11-2:12. Ref instead of state to
  // avoid an extra render on every tap.
  const logoutPromptOpenRef = useRef(false);

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

  // Identity card — Apple Settings "Apple ID banner" deseni. Kart hesap
  // hub'ına (/profile/account) götürür; oradan isim/email/abonelik/silme hepsi
  // erişilebilir. Kartın kendisi sadece isim edit'e gitmiyor çünkü görsel
  // ağırlığı (56pt avatar + Premium rozeti + ›) kullanıcıya "tam hesap
  // ayarları"nı vaat ediyor — sadece text input beklentiyi kırar.
  //
  // Avatar: her zaman PALIMPS logosu. İsim ilk harfi göstermiyoruz çünkü
  // (a) Apple private-relay email'li kullanıcılarda "C3xy@privaterelay…"
  // harfi anlamsız ve (b) marka tekrarı (logo = ikon spot'u) Supercell-tier
  // kimlik pekiştirmesi. Logo kendi mor gradyanıyla geliyor — ayrı tint
  // backgroundı gerek yok, aksine "çift mor" görünümü yaratır.
  const hasName = !!user.name?.trim();
  const displayName = user.name?.trim() || t("profile.nameAdd");

  return (
    <ScreenContainer>
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header — iOS Large Title */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.foreground }}>
            {t("profile.title")}
          </Text>
        </View>

        {/* Identity card — tap to open account hub */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/profile/account");
          }}
          accessible
          accessibilityRole="button"
          accessibilityLabel={hasName ? user.name! : t("profile.nameAdd")}
          accessibilityHint={t("profile.openAccountHint")}
          style={({ pressed }) => ({
            marginHorizontal: 24,
            marginBottom: 12,
            paddingVertical: 16,
            paddingHorizontal: 16,
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 0.5,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Image
              source={require("@/assets/images/icon.png")}
              style={{ width: 56, height: 56 }}
              contentFit="cover"
              accessibilityLabel="PALIMPS"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 17,
                fontWeight: "600",
                color: hasName ? colors.foreground : colors.muted,
                marginBottom: isPremium ? 6 : 0,
              }}
              numberOfLines={1}
            >
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
                  {t("profile.premium")}
                </Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 20, color: colors.muted, marginLeft: 4 }}>›</Text>
        </Pressable>

        {/* Library stats — tap to jump to Kitaplarım */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/(tabs)");
          }}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`${t("profile.bookCountSummary", { count: bookCount })}, ${t("profile.momentCountSummary", { count: momentCount })}`}
          accessibilityHint={t("profile.viewLibraryHint")}
          style={({ pressed }) => ({
            marginHorizontal: 24,
            marginBottom: 32,
            paddingVertical: 14,
            paddingHorizontal: 16,
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 0.5,
            borderColor: colors.border,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ fontSize: 15, color: colors.foreground }}>
            {t("profile.bookCountSummary", { count: bookCount })} · {t("profile.momentCountSummary", { count: momentCount })}
          </Text>
          <Text style={{ fontSize: 20, color: colors.muted }}>›</Text>
        </Pressable>

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
              <Text style={{ fontSize: 16, color: colors.foreground }}>
                {t("auth.signOut")}
              </Text>
              {isLoggingOut ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <Text style={{ fontSize: 14, color: colors.muted }}>›</Text>
              )}
            </Pressable>

            {/* Privacy Policy Row — settings grubunun son öğesi; alt border
                yok. Eski "Hesap" row'u kaldırıldı — üstteki identity card artık
                hesap hub'ına gidiyor (Apple Settings banner deseni). */}
            <Pressable
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // In-app SFSafariViewController — app'ten çıkmadan gizlilik
                // politikasını gösterir. Eskiden Linking.openURL ile external
                // Safari'ye atıyorduk; kullanıcı bağlamı kaybediyor + tekrar
                // app'e dönmek için switcher gerekiyordu. WebBrowser native
                // iOS modal stiliyle açıyor, "Done" ile kapanır, ana ekran
                // duruyor. Renk token'ları primary/background ile uyumlu —
                // navigation bar ve link rengi app teması ile aynı görünür.
                try {
                  await WebBrowser.openBrowserAsync("https://palimps.app/privacy/", {
                    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
                    controlsColor: colors.primary,
                    toolbarColor: colors.background,
                  });
                } catch {
                  // SFSafariViewController nadiren init fail eder (corrupt
                  // simulator state vb.); silent — kullanıcı tekrar deneyebilir.
                }
              }}
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
              accessible={true}
              accessibilityRole="link"
              accessibilityLabel={t("profile.privacyPolicy")}
              accessibilityHint={t("profile.privacyPolicyHint")}
            >
              <Text style={{ fontSize: 16, color: colors.foreground }}>
                {t("profile.privacyPolicy")}
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted }}>›</Text>
            </Pressable>
          </View>
        </View>

        {/* Footer spacing */}
        <View style={{ height: 32 }} />
      </ScrollView>
    </ScreenContainer>
  );
}
