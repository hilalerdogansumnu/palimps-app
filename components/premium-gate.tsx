import { View, Text, TouchableOpacity, Modal, type PressableStateCallbackType } from "react-native";
import { useSubscription } from "@/hooks/use-subscription";
import { router } from "expo-router";
import { useState } from "react";

interface PremiumGateProps {
  children: React.ReactNode;
  feature: string; // "AI Note Generation", "Advanced Search", etc.
}

/**
 * Premium Gate Component
 * Wraps premium features and shows upgrade prompt for free users
 */
export function PremiumGate({ children, feature }: PremiumGateProps) {
  const { isPremium } = useSubscription();
  const [showModal, setShowModal] = useState(false);

  // Premium kullanıcılar için direkt içeriği göster
  if (isPremium) {
    return <>{children}</>;
  }

  // Free kullanıcılar için modal göster
  return (
    <>
      <TouchableOpacity
        onPress={() => setShowModal(true)}
        className="opacity-50"
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>

      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-6">
          <View className="bg-background rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-2xl font-bold text-foreground mb-2">
              Premium Feature
            </Text>
            <Text className="text-base text-muted mb-6">
              {feature} is a premium feature. Upgrade to unlock AI-powered note
              generation and more.
            </Text>

            <TouchableOpacity
              onPress={() => {
                setShowModal(false);
                // TODO: Navigate to premium screen
                alert("Premium upgrade coming soon!");
              }}
              className="bg-primary rounded-full py-3 mb-3"
              activeOpacity={0.8}
            >
              <Text className="text-background font-semibold text-center">
                Upgrade to Premium
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowModal(false)}
              className="py-2"
            >
              <Text className="text-muted text-center">Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
