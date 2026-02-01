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
      title: "AI Note Generation",
      description: "Automatically generate smart notes from your reading moments",
    },
    {
      icon: "🔍",
      title: "Advanced Search",
      description: "Search across all your books and notes with powerful filters",
    },
    {
      icon: "📊",
      title: "Reading Analytics",
      description: "Track your reading progress with detailed statistics",
    },
    {
      icon: "☁️",
      title: "Cloud Sync",
      description: "Access your library from any device, anytime",
    },
    {
      icon: "📤",
      title: "Export Options",
      description: "Export your notes as PDF, Markdown, or plain text",
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
            <Text className="text-primary text-base">← Back</Text>
          </TouchableOpacity>

          {/* Title */}
          <Text className="text-4xl font-bold text-foreground mb-2">
            PALIMPS Premium
          </Text>
          <Text className="text-base text-muted mb-8">
            Unlock the full power of your reading memory
          </Text>

          {/* Current Status */}
          {isPremium && (
            <View className="bg-primary/10 rounded-2xl p-4 mb-6">
              <Text className="text-primary font-semibold text-center">
                ✓ You're already a Premium member
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
                  <Text className="text-lg font-semibold text-foreground mb-1">
                    {feature.title}
                  </Text>
                  <Text className="text-sm text-muted">
                    {feature.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* CTA Button */}
          {!isPremium && (
            <TouchableOpacity
              onPress={handleUpgrade}
              className="bg-primary rounded-full py-4 mb-4"
              activeOpacity={0.8}
            >
              <Text className="text-background font-bold text-center text-lg">
                Premium'a Geç - ₺149.99/ay
              </Text>
            </TouchableOpacity>
          )}

          {/* Terms */}
          <Text className="text-xs text-muted text-center">
            Cancel anytime. Terms and conditions apply.
          </Text>
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
