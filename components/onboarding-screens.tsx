import { View, Text, TouchableOpacity, Dimensions, Pressable } from 'react-native';
import { useState } from 'react';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface OnboardingScreensProps {
  onComplete: () => void;
}

const screens = [
  {
    id: 1,
    icon: '📚',
    title: 'PALIMPS\'e Hoş Geldiniz',
    description: 'Okuduğunuz her sayfayı, her anı dijital hafızanızda saklayın. Kitaplarınızla daha derin bir bağ kurun.',
  },
  {
    id: 2,
    icon: '📸',
    title: 'Nasıl Çalışır?',
    description: 'Kitap ekleyin, sayfa fotoğrafı çekin, notlarınızı alın. OCR teknolojisi ile metinler otomatik olarak tanınır.',
  },
  {
    id: 3,
    icon: '✨',
    title: 'AI ile Güçlendirin',
    description: 'Premium ile AI destekli otomatik not oluşturma, özet çıkarma ve tematik analiz özelliklerini sınırsız kullanın.',
  },
];

export function OnboardingScreens({ onComplete }: OnboardingScreensProps) {
  const colors = useColors();
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentScreen = screens[currentIndex];
  const isLastScreen = currentIndex === screens.length - 1;

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLastScreen) {
      onComplete();
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onComplete();
  };

  return (
    <View className="flex-1 bg-background">
      {/* Skip Button */}
      {!isLastScreen && (
        <View className="absolute top-12 right-6 z-10">
          <TouchableOpacity
            onPress={handleSkip}
            className="px-4 py-2"
            activeOpacity={0.7}
          >
            <Text className="text-muted font-semibold">Atla</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      <View className="flex-1 items-center justify-center px-8">
        <Animated.View
          key={currentScreen.id}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          className="items-center"
        >
          {/* Icon */}
          <Text className="text-8xl mb-8">{currentScreen.icon}</Text>

          {/* Title */}
          <Text className="text-3xl font-bold text-foreground text-center mb-4">
            {currentScreen.title}
          </Text>

          {/* Description */}
          <Text className="text-base text-muted text-center leading-relaxed max-w-sm">
            {currentScreen.description}
          </Text>
        </Animated.View>
      </View>

      {/* Bottom Section */}
      <View className="px-8 pb-12">
        {/* Pagination Dots */}
        <View className="flex-row items-center justify-center mb-8 gap-2">
          {screens.map((_, index) => (
            <View
              key={index}
              className="rounded-full"
              style={{
                width: currentIndex === index ? 24 : 8,
                height: 8,
                backgroundColor: currentIndex === index ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>

        {/* Next/Get Started Button */}
        <Pressable
          onPress={handleNext}
          className="bg-primary rounded-full py-4"
          style={({ pressed }) => [
            {
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text className="text-background font-bold text-center text-lg">
            {isLastScreen ? 'Başlayalım' : 'Devam'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
