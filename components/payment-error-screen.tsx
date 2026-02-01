import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';

interface PaymentErrorScreenProps {
  errorMessage?: string;
  onRetry: () => void;
  onCancel: () => void;
}

export function PaymentErrorScreen({ 
  errorMessage = 'Ödeme işlemi sırasında bir hata oluştu.',
  onRetry,
  onCancel 
}: PaymentErrorScreenProps) {
  useEffect(() => {
    // Hata haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRetry();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  return (
    <View className="flex-1 bg-background items-center justify-center p-6">
      {/* Error Icon */}
      <View className="w-24 h-24 rounded-full bg-error/20 items-center justify-center mb-6">
        <Text className="text-6xl">✕</Text>
      </View>

      {/* Title */}
      <Text className="text-3xl font-bold text-foreground mb-3 text-center">
        İşlem Başarısız
      </Text>

      {/* Error Message */}
      <Text className="text-base text-muted text-center mb-8 px-4">
        {errorMessage}
      </Text>

      {/* Common Reasons */}
      <View className="w-full max-w-sm bg-surface rounded-2xl p-4 mb-8">
        <Text className="text-sm font-semibold text-foreground mb-3">
          Olası Nedenler:
        </Text>
        {[
          'Kart bilgileriniz hatalı olabilir',
          'Kartınızda yeterli bakiye bulunmuyor olabilir',
          'Bankanız işlemi reddetmiş olabilir',
          'İnternet bağlantınız kesilmiş olabilir',
        ].map((reason, index) => (
          <View key={index} className="flex-row items-start mb-2">
            <Text className="text-muted mr-2">•</Text>
            <Text className="text-sm text-muted flex-1">{reason}</Text>
          </View>
        ))}
      </View>

      {/* Action Buttons */}
      <View className="w-full max-w-sm gap-3">
        <TouchableOpacity
          onPress={handleRetry}
          className="bg-primary rounded-full py-4"
          activeOpacity={0.8}
        >
          <Text className="text-background font-bold text-center text-lg">
            Tekrar Dene
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleCancel}
          className="bg-surface border border-border rounded-full py-4"
          activeOpacity={0.7}
        >
          <Text className="text-foreground font-semibold text-center">
            İptal Et
          </Text>
        </TouchableOpacity>
      </View>

      {/* Support Text */}
      <Text className="text-xs text-muted text-center mt-6 px-4">
        Sorun devam ederse lütfen bankanızla iletişime geçin veya farklı bir kart deneyin.
      </Text>
    </View>
  );
}
