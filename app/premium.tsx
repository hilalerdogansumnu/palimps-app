import { View, Text, ScrollView, TouchableOpacity, Modal } from "react-native";
import { useState } from "react";
import { ScreenContainer } from "@/components/screen-container";
import { router } from "expo-router";
import { useSubscription } from "@/hooks/use-subscription";
import { IyzicoPaymentForm } from "@/components/iyzico-payment-form";

export default function PremiumScreen() {
  const { isPremium } = useSubscription();
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleUpgrade = () => {
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    router.back();
  };

  const features = [
    {
      icon: "✨",
      title: "AI Not Oluşturma",
      description: "Okuma anlarınızdan otomatik olarak akıllı notlar oluşturun",
      badge: "Sınırsız",
    },
    {
      icon: "🧠",
      title: "AI Özet Çıkarma",
      description: "Kitaplarınızın kapsamlı özetlerini AI ile oluşturun",
      badge: "Sınırsız",
    },
    {
      icon: "🎨",
      title: "AI Tematik Analiz",
      description: "Okuma anlarınızı tematik olarak gruplandırın ve bağlantılar keşfedin",
      badge: "Sınırsız",
    },
    {
      icon: "🔍",
      title: "Gelişmiş Arama",
      description: "Tüm kitaplarınızda ve notlarınızda güçlü filtrelerle arama yapın",
      badge: null,
    },
    {
      icon: "📊",
      title: "Okuma İstatistikleri",
      description: "Detaylı grafikler ve analizlerle okuma ilerlemenizi takip edin",
      badge: null,
    },
    {
      icon: "📤",
      title: "Export Seçenekleri",
      description: "Notlarınızı PDF, Markdown veya düz metin olarak dışa aktarın",
      badge: "Sınırsız",
    },
    {
      icon: "🌍",
      title: "Çoklu Dil Desteği",
      description: "Türkçe, İngilizce, Almanca ve İspanyolca dillerinde kullanın",
      badge: null,
    },
    {
      icon: "☁️",
      title: "Sınırsız Depolama",
      description: "Tüm okuma anlarınızı ve fotoğraflarınızı sınırsız saklayın",
      badge: "Sınırsız",
    },
  ];

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1">
          {/* Header */}
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-6"
          >
            <Text className="text-primary text-base">← Geri</Text>
          </TouchableOpacity>

          {/* Title */}
          <Text className="text-4xl font-bold text-foreground mb-2">
            PALIMPS Premium
          </Text>
          <Text className="text-base text-muted mb-2">
            Okuma hafızanızın tüm gücünü açığa çıkarın
          </Text>
          <View className="bg-primary/10 rounded-xl px-4 py-2 self-start mb-8">
            <Text className="text-primary font-semibold text-sm">
              🚫 Kredi sistemi yok - Tüm özellikler sınırsız
            </Text>
          </View>

          {/* Current Status */}
          {isPremium && (
            <View className="bg-success/10 rounded-2xl p-4 mb-6">
              <Text className="text-success font-semibold text-center">
                ✓ Zaten Premium üyesiniz
              </Text>
            </View>
          )}

          {/* Features List */}
          <View className="gap-4 mb-8">
            {features.map((feature, index) => (
              <View
                key={index}
                className="bg-surface rounded-2xl p-4 flex-row items-start"
              >
                <Text className="text-3xl mr-3">{feature.icon}</Text>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-lg font-semibold text-foreground">
                      {feature.title}
                    </Text>
                    {feature.badge && (
                      <View className="bg-primary/20 rounded-full px-2 py-0.5">
                        <Text className="text-primary text-xs font-semibold">
                          {feature.badge}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm text-muted">
                    {feature.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* CTA Button */}
          {!isPremium && (
            <View className="bg-muted/30 rounded-full py-4 mb-4">
              <Text className="text-muted font-bold text-center text-lg">
                🕒 Yakında Aktif Olacak
              </Text>
            </View>
          )}

          {/* Terms */}
          <Text className="text-xs text-muted text-center">
            İstediğiniz zaman iptal edebilirsiniz. Şartlar ve koşullar geçerlidir.
          </Text>
          
          {/* Coming Soon Notice */}
          {!isPremium && (
            <View className="mt-4 bg-primary/10 rounded-xl p-4">
              <Text className="text-sm text-primary text-center font-semibold mb-1">
                🚀 Çok Yakında!
              </Text>
              <Text className="text-xs text-muted text-center">
                Premium özellikler çok yakında aktif olacak. Şimdilik ücretsiz özellikleri kullanabilirsiniz.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Ödeme Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <IyzicoPaymentForm
          onSuccess={handlePaymentSuccess}
          onCancel={() => setShowPaymentModal(false)}
        />
      </Modal>
    </ScreenContainer>
  );
}
