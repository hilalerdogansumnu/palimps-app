import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';

interface PaymentSuccessScreenProps {
  onClose: () => void;
}

export function PaymentSuccessScreen({ onClose }: PaymentSuccessScreenProps) {
  useEffect(() => {
    // Başarı haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    router.back();
  };

  return (
    <View className="flex-1 bg-background items-center justify-center p-6">
      {/* Success Icon */}
      <View className="w-24 h-24 rounded-full bg-success/20 items-center justify-center mb-6">
        <Text className="text-6xl">✓</Text>
      </View>

      {/* Title */}
      <Text className="text-3xl font-bold text-foreground mb-3 text-center">
        Hoş Geldiniz!
      </Text>

      {/* Subtitle */}
      <Text className="text-base text-muted text-center mb-8 px-4">
        Premium üyeliğiniz başarıyla aktif edildi. Artık tüm AI özelliklerinden sınırsız faydalanabilirsiniz.
      </Text>

      {/* Features List */}
      <View className="w-full max-w-sm mb-8">
        {[
          '✨ AI ile otomatik not oluşturma',
          '🔍 Gelişmiş arama ve filtreleme',
          '📊 Okuma istatistikleri ve analizler',
          '☁️ Sınırsız bulut depolama',
          '📤 PDF, Markdown export',
        ].map((feature, index) => (
          <View key={index} className="flex-row items-center mb-3">
            <View className="w-2 h-2 rounded-full bg-primary mr-3" />
            <Text className="text-sm text-foreground">{feature}</Text>
          </View>
        ))}
      </View>

      {/* CTA Button */}
      <TouchableOpacity
        onPress={handleContinue}
        className="bg-primary rounded-full px-8 py-4 w-full max-w-sm"
        activeOpacity={0.8}
      >
        <Text className="text-background font-bold text-center text-lg">
          Keşfetmeye Başla
        </Text>
      </TouchableOpacity>

      {/* Info Text */}
      <Text className="text-xs text-muted text-center mt-6">
        Aboneliğinizi istediğiniz zaman profil ekranından yönetebilirsiniz.
      </Text>
    </View>
  );
}
