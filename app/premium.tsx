import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { useTranslation } from "react-i18next";
import { ScreenContainer } from "@/components/screen-container";
import { router } from "expo-router";
import { useSubscription } from "@/hooks/use-subscription";
import { useColors } from "@/hooks/use-colors";

const ENTITLEMENT_ID = "premium";

export default function PremiumScreen() {
  const { t } = useTranslation();
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

  const features = [
    { icon: "✨", title: t("premium.feature1.title"), description: t("premium.feature1.desc") },
    { icon: "🧠", title: t("premium.feature2.title"), description: t("premium.feature2.desc") },
    { icon: "🎨", title: t("premium.feature3.title"), description: t("premium.feature3.desc") },
    { icon: "🔍", title: t("premium.feature4.title"), description: t("premium.feature4.desc") },
    { icon: "📊", title: t("premium.feature5.title"), description: t("premium.feature5.desc") },
    { icon: "📤", title: t("premium.feature6.title"), description: t("premium.feature6.desc") },
    { icon: "🌍", title: t("premium.feature7.title"), description: t("premium.feature7.desc") },
    { icon: "☁️", title: t("premium.feature8.title"), description: t("premium.feature8.desc") },
  ];

  return (
    <ScreenContainer style={{ paddingHorizontal: 0, paddingVertical: 0 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16 }}>
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginBottom: 24 }}
          >
            <Text style={{ fontSize: 16, color: colors.primary }}>← Geri</Text>
          </TouchableOpacity>

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
              Okuma hafızanızın tüm gücünü açığa çıkarın
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
                ✓ Premium üyesiniz
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
                  <Text style={{ fontSize: 24, marginRight: 12, marginTop: 2 }}>
                    {feature.icon}
                  </Text>
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
                packages.map((pkg) => (
                  <TouchableOpacity
                    key={pkg.identifier}
                    disabled={purchasing}
                    onPress={() => handlePurchase(pkg)}
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
                ))
              )}

              {packages.length > 0 && (
                <TouchableOpacity
                  disabled={purchasing}
                  onPress={handleRestore}
                  style={{ paddingVertical: 12 }}
                >
                  <Text style={{ fontSize: 13, color: colors.primary, textAlign: "center" }}>
                    Önceki satın almayı geri yükle
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Terms */}
          <Text style={{ fontSize: 12, color: colors.muted, textAlign: "center", paddingBottom: 16 }}>
            {t("premium.terms")}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
