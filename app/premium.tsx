import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { useTranslation } from "react-i18next";
import { ScreenContainer } from "@/components/screen-container";
import { NavigationBar } from "@/components/navigation-bar";
import { router } from "expo-router";
import { useSubscription } from "@/hooks/use-subscription";
import { useColors } from "@/hooks/use-colors";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const ENTITLEMENT_ID = "premium";

export default function PremiumScreen() {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const { isPremium, refetch } = useSubscription();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const offerings = await Purchases.getOfferings();
        if (cancelled) return;
        const current = offerings?.current;
        if (current?.availablePackages?.length) {
          setPackages(current.availablePackages);
        } else {
          setPackages([]);
        }
      } catch (err) {
        console.error("[Premium] failed to load offerings:", err);
        setPackages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    setPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const active = customerInfo.entitlements.active[ENTITLEMENT_ID];
      if (active) {
        await refetch?.();
        Alert.alert(t("premium.thanks"), t("premium.activated"));
        router.back();
      }
    } catch (err: any) {
      if (!err?.userCancelled) {
        console.error("[Premium] purchase failed:", err);
        Alert.alert(t("premium.purchaseFailed"), err?.message ?? t("common.error"));
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      const active = customerInfo.entitlements.active[ENTITLEMENT_ID];
      await refetch?.();
      if (active) {
        Alert.alert(t("premium.restored"), t("premium.restoredMessage"));
      } else {
        Alert.alert(t("premium.notFound"), t("premium.notFoundMessage"));
      }
    } catch (err: any) {
      console.error("[Premium] restore failed:", err);
      Alert.alert(t("common.error"), err?.message ?? t("common.error"));
    } finally {
      setPurchasing(false);
    }
  };

  // Features — 6 kalem, hepsi v1.0'da çalışan ve teslim edilen özellikler.
  // "Gelişmiş Arama" + "Okuma İstatistikleri" v1.0'da yok → listeden çıkarıldı
  // (App Store misleading content riski). "Sınırsız Depolama" → "Geniş Kapasite"
  // olarak dürüstleştirildi (server sanity cap zaten 500/kitap; kullanıcıya 100
  // söylüyoruz, headroom kalıyor + free=10 karşılaştırması paketi gerekçelendiriyor).
  const features: { icon: React.ComponentProps<typeof MaterialIcons>["name"]; title: string; description: string }[] = [
    { icon: "auto-awesome", title: t("premium.feature1.title"), description: t("premium.feature1.desc") },
    { icon: "psychology", title: t("premium.feature2.title"), description: t("premium.feature2.desc") },
    { icon: "palette", title: t("premium.feature3.title"), description: t("premium.feature3.desc") },
    { icon: "upload", title: t("premium.feature4.title"), description: t("premium.feature4.desc") },
    { icon: "language", title: t("premium.feature5.title"), description: t("premium.feature5.desc") },
    { icon: "library-books", title: t("premium.feature6.title"), description: t("premium.feature6.desc") },
  ];

  // Fiyat özeti — App Store Review 3.1.2 auto-renewable subscription için
  // price + duration açık gösterilmeli. RevenueCat `packageType` ile monthly/
  // annual'ı ayır, yıllık'ın ayda karşılığını Intl.NumberFormat ile formatla
  // (Hermes SDK 54 Intl desteği var). Eğer iki paket de yoksa null döner →
  // kullanıcı altta paket butonlarında zaten fiyatı görür, crash yok.
  const monthlyPkg = packages.find((p) => p.packageType === "MONTHLY");
  const annualPkg = packages.find((p) => p.packageType === "ANNUAL");
  let priceSummary: string | null = null;
  if (monthlyPkg && annualPkg) {
    const perMonth = annualPkg.product.price / 12;
    try {
      const perMonthFmt = new Intl.NumberFormat(i18n.language || "tr", {
        style: "currency",
        currency: annualPkg.product.currencyCode,
        maximumFractionDigits: 0,
      }).format(perMonth);
      priceSummary = t("premium.priceSummary", {
        monthly: monthlyPkg.product.priceString,
        yearly: annualPkg.product.priceString,
        perMonth: perMonthFmt,
      });
    } catch {
      // Intl fallback: yıllık/ay karşılığı gösteremezsek özet satırı atlansın.
      // Paket butonları yine priceString ile fiyat gösteriyor, compliance bozulmaz.
      priceSummary = null;
    }
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <NavigationBar
        title={t("premium.title")}
        backLabel={t("profile.title")}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>

          {/* Hero Section */}
          <View style={{ marginBottom: 32 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 8 }}>
              <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.primary }}>
                PALIMPS
              </Text>
              <Text style={{ fontSize: 28, fontWeight: "bold", color: colors.accent }}>
                Premium
              </Text>
            </View>
            <Text style={{ fontSize: 16, color: colors.muted, marginBottom: 16 }}>
              {t("premium.subtitle")}
            </Text>
          </View>

          {/* Success Banner (if already premium) */}
          {isPremium && (
            <View
              style={{
                backgroundColor: colors.success + "1A",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 16,
                marginBottom: 32,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: colors.success,
                  textAlign: "center",
                }}
              >
                {t("premium.alreadyPremium")}
              </Text>
            </View>
          )}

          {/* Feature List */}
          <View style={{ marginBottom: 32 }}>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 16,
                overflow: "hidden",
                borderWidth: 0.5,
                borderColor: colors.border,
              }}
            >
              {features.map((feature, index) => (
                <View
                  key={index}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                    flexDirection: "row",
                    alignItems: "flex-start",
                    borderBottomWidth: index < features.length - 1 ? 0.5 : 0,
                    borderBottomColor: colors.border,
                  }}
                >
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary + "1A", alignItems: "center", justifyContent: "center", marginRight: 12, marginTop: 2 }}>
                    <MaterialIcons name={feature.icon} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground, marginBottom: 4 }}>
                      {feature.title}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.muted }}>
                      {feature.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Purchase Section */}
          {!isPremium && (
            <View style={{ marginBottom: 32 }}>
              {loading ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : packages.length === 0 ? (
                <View
                  style={{
                    backgroundColor: colors.muted + "4D",
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 16,
                  }}
                >
                  <Text style={{ color: colors.muted, textAlign: "center" }}>
                    {t("premium.noPackages")}
                  </Text>
                </View>
              ) : (
                <>
                  {/* Fiyat özet satırı — App Store 3.1.2 için price+duration
                      paket butonlarının üstünde tek satırda açık. "ayda X"
                      yıllık paketi gerekçelendirir, "save Y%" hype'ından uzak,
                      sade kütüphaneci tonu. */}
                  {priceSummary && (
                    <View
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: 12,
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        marginBottom: 16,
                        borderWidth: 0.5,
                        borderColor: colors.border,
                      }}
                      accessible
                      accessibilityRole="text"
                      accessibilityLabel={priceSummary}
                    >
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "600",
                          color: colors.foreground,
                          textAlign: "center",
                        }}
                      >
                        {priceSummary}
                      </Text>
                    </View>
                  )}
                  {packages.map((pkg) => (
                    <TouchableOpacity
                      key={pkg.identifier}
                      disabled={purchasing}
                      onPress={() => handlePurchase(pkg)}
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={`${pkg.product.title} — ${pkg.product.priceString}`}
                      accessibilityState={{ disabled: purchasing }}
                      style={{
                        backgroundColor: colors.primary,
                        borderRadius: 12,
                        paddingVertical: 16,
                        paddingHorizontal: 16,
                        marginBottom: 16,
                        opacity: purchasing ? 0.7 : 1,
                      }}
                    >
                      {purchasing ? (
                        <ActivityIndicator color="white" />
                      ) : (
                        <View>
                          <Text
                            style={{
                              color: "white",
                              fontWeight: "600",
                              textAlign: "center",
                              fontSize: 16,
                              marginBottom: 4,
                            }}
                          >
                            {pkg.product.title}
                          </Text>
                          <Text
                            style={{
                              color: "white",
                              textAlign: "center",
                              fontSize: 14,
                            }}
                          >
                            {pkg.product.priceString}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {packages.length > 0 && (
                <TouchableOpacity
                  disabled={purchasing}
                  onPress={handleRestore}
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={t("premium.restorePurchase")}
                  accessibilityState={{ disabled: purchasing }}
                  style={{ paddingVertical: 12 }}
                >
                  <Text style={{ fontSize: 13, color: colors.primary, textAlign: "center" }}>
                    {t("premium.restorePurchase")}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Subscription Cancellation Info — App Store Review Guideline 3.1.2 */}
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: colors.foreground,
                marginBottom: 8,
              }}
            >
              {t("premium.cancellationTitle")}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 18 }}>
              {t("premium.cancellationInfo")}
            </Text>
          </View>

          {/* Terms */}
          <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", paddingBottom: 16 }}>
            {t("premium.terms")}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
