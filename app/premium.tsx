import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { useTranslation } from "react-i18next";
import { ScreenContainer } from "@/components/screen-container";
import { router } from "expo-router";
import { useSubscription } from "@/hooks/use-subscription";

const ENTITLEMENT_ID = "premium";

export default function PremiumScreen() {
  const { t } = useTranslation();
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
    { icon: "✨", title: t("premium.feature1.title"), description: t("premium.feature1.desc"), badge: t("premium.unlimited") },
    { icon: "🧠", title: t("premium.feature2.title"), description: t("premium.feature2.desc"), badge: t("premium.unlimited") },
    { icon: "🎨", title: t("premium.feature3.title"), description: t("premium.feature3.desc"), badge: t("premium.unlimited") },
    { icon: "🔍", title: t("premium.feature4.title"), description: t("premium.feature4.desc"), badge: null },
    { icon: "📊", title: t("premium.feature5.title"), description: t("premium.feature5.desc"), badge: null },
    { icon: "📤", title: t("premium.feature6.title"), description: t("premium.feature6.desc"), badge: t("premium.unlimited") },
    { icon: "🌍", title: t("premium.feature7.title"), description: t("premium.feature7.desc"), badge: null },
    { icon: "☁️", title: t("premium.feature8.title"), description: t("premium.feature8.desc"), badge: t("premium.unlimited") },
  ];

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1">
          <TouchableOpacity onPress={() => router.back()} className="mb-6">
            <Text className="text-primary text-base">{"← " + t("premium.back")}</Text>
          </TouchableOpacity>

          <Text className="text-4xl font-bold text-foreground mb-2">{t("premium.title")}</Text>
          <Text className="text-base text-muted mb-2">
            {t("premium.subtitle")}
          </Text>
          <View className="bg-primary/10 rounded-xl px-4 py-2 self-start mb-8">
            <Text className="text-primary font-semibold text-sm">
              {"🚫 " + t("premium.noCreditSystem")}
            </Text>
          </View>

          {isPremium && (
            <View className="bg-success/10 rounded-2xl p-4 mb-6">
              <Text className="text-success font-semibold text-center">
                {"✓ " + t("premium.alreadyPremium")}
              </Text>
            </View>
          )}

          <View className="gap-4 mb-8">
            {features.map((feature, index) => (
              <View key={index} className="bg-surface rounded-2xl p-4 flex-row items-start">
                <Text className="text-3xl mr-3">{feature.icon}</Text>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-lg font-semibold text-foreground">{feature.title}</Text>
                    {feature.badge && (
                      <View className="bg-primary/20 rounded-full px-2 py-0.5">
                        <Text className="text-primary text-xs font-semibold">{feature.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm text-muted">{feature.description}</Text>
                </View>
              </View>
            ))}
          </View>

          {!isPremium && (
            <View className="gap-3 mb-4">
              {loading ? (
                <ActivityIndicator size="large" />
              ) : packages.length === 0 ? (
                <View className="bg-muted/30 rounded-2xl p-4">
                  <Text className="text-muted text-center">
                    {t("premium.noPackages")}
                  </Text>
                </View>
              ) : (
                packages.map((pkg) => (
                  <TouchableOpacity
                    key={pkg.identifier}
                    disabled={purchasing}
                    onPress={() => handlePurchase(pkg)}
                    className="bg-primary rounded-2xl py-4 px-6"
                  >
                    {purchasing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <View>
                        <Text className="text-white font-bold text-center text-lg">
                          {pkg.product.title}
                        </Text>
                        <Text className="text-white/90 text-center text-base mt-1">
                          {pkg.product.priceString}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))
              )}

              <TouchableOpacity
                disabled={purchasing}
                onPress={handleRestore}
                className="py-3"
              >
                <Text className="text-primary text-center text-sm">
                  {t("premium.restorePurchase")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text className="text-xs text-muted text-center mt-4">
            {t("premium.terms")}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
