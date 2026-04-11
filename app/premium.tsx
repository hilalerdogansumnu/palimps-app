import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import Purchases, { PurchasesPackage } from "react-native-purchases";
import { ScreenContainer } from "@/components/screen-container";
import { router } from "expo-router";
import { useSubscription } from "@/hooks/use-subscription";

const ENTITLEMENT_ID = "premium";

export default function PremiumScreen() {
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
        Alert.alert("Teşekkürler!", "Premium üyeliğiniz aktifleşti.");
        router.back();
      }
    } catch (err: any) {
      if (!err?.userCancelled) {
        console.error("[Premium] purchase failed:", err);
        Alert.alert("Satın alma başarısız", err?.message ?? "Bir hata oluştu, lütfen tekrar deneyin.");
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
        Alert.alert("Geri yüklendi", "Premium üyeliğiniz geri yüklendi.");
      } else {
        Alert.alert("Bulunamadı", "Aktif bir Premium aboneliği bulunamadı.");
      }
    } catch (err: any) {
      console.error("[Premium] restore failed:", err);
      Alert.alert("Hata", err?.message ?? "Geri yükleme başarısız.");
    } finally {
      setPurchasing(false);
    }
  };

  const features = [
    { icon: "✨", title: "AI Not Oluşturma", description: "Okuma anlarınızdan otomatik olarak akıllı notlar oluşturun", badge: "Sınırsız" },
    { icon: "🧠", title: "AI Özet Çıkarma", description: "Kitaplarınızın kapsamlı özetlerini AI ile oluşturun", badge: "Sınırsız" },
    { icon: "🎨", title: "AI Tematik Analiz", description: "Okuma anlarınızı tematik olarak gruplandırın ve bağlantılar keşfedin", badge: "Sınırsız" },
    { icon: "🔍", title: "Gelişmiş Arama", description: "Tüm kitaplarınızda ve notlarınızda güçlü filtrelerle arama yapın", badge: null },
    { icon: "📊", title: "Okuma İstatistikleri", description: "Detaylı grafikler ve analizlerle okuma ilerlemenizi takip edin", badge: null },
    { icon: "📤", title: "Export Seçenekleri", description: "Notlarınızı PDF, Markdown veya düz metin olarak dışa aktarın", badge: "Sınırsız" },
    { icon: "🌍", title: "Çoklu Dil Desteği", description: "Türkçe, İngilizce, Almanca ve İspanyolca dillerinde kullanın", badge: null },
    { icon: "☁️", title: "Sınırsız Depolama", description: "Tüm okuma anlarınızı ve fotoğraflarınızı sınırsız saklayın", badge: "Sınırsız" },
  ];

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1">
          <TouchableOpacity onPress={() => router.back()} className="mb-6">
            <Text className="text-primary text-base">← Geri</Text>
          </TouchableOpacity>

          <Text className="text-4xl font-bold text-foreground mb-2">PALIMPS Premium</Text>
          <Text className="text-base text-muted mb-2">
            Okuma hafızanızın tüm gücünü açığa çıkarın
          </Text>
          <View className="bg-primary/10 rounded-xl px-4 py-2 self-start mb-8">
            <Text className="text-primary font-semibold text-sm">
              🚫 Kredi sistemi yok – tüm özellikler sınırsız
            </Text>
          </View>

          {isPremium && (
            <View className="bg-success/10 rounded-2xl p-4 mb-6">
              <Text className="text-success font-semibold text-center">
                ✓ Zaten Premium üyesiniz
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
                    Şu an satın alınabilir bir paket yok. Lütfen daha sonra tekrar deneyin.
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
                  Önceki satın almayı geri yükle
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <Text className="text-xs text-muted text-center mt-4">
            Abonelik istediğiniz zaman App Store ayarlarından iptal edilebilir. Otomatik
            yenilenir; yenileme tarihinden 24 saat önce iptal etmediğiniz takdirde aynı ücretle
            tekrar yenilenir.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
