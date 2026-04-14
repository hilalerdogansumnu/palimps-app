import { View, Text, TouchableOpacity, Modal, type PressableStateCallbackType } from "react-native";
import { useSubscription } from "@/hooks/use-subscription";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
              {t("premiumGate.title")}
            </Text>
            <Text className="text-base text-muted mb-6">
              {t("premiumGate.description", { feature })}
            </Text>

            <TouchableOpacity
              onPress={() => {
                setShowModal(false);
                router.push("/premium");
              }}
              className="bg-primary rounded-full py-3 mb-3"
              activeOpacity={0.8}
            >
              <Text className="text-background font-semibold text-center">
                {t("premiumGate.upgrade")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowModal(false)}
              className="py-2"
            >
              <Text className="text-muted text-center">{t("premiumGate.later")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
