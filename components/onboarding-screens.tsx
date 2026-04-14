import { View, Text, TouchableOpacity, Dimensions, Pressable } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useColors } from '@/hooks/use-colors';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface OnboardingScreensProps {
  onComplete: () => void;
}

// Screens reference i18n keys under `onboarding.*` — copy lives in the locale
// files, not here, so both languages stay in sync.
const SCREEN_KEYS = [
  { id: 1, icon: '📚', titleKey: 'onboarding.welcome.title', descKey: 'onboarding.welcome.description' },
  { id: 2, icon: '📸', titleKey: 'onboarding.howItWorks.title', descKey: 'onboarding.howItWorks.description' },
  { id: 3, icon: '✨', titleKey: 'onboarding.aiPowered.title', descKey: 'onboarding.aiPowered.description' },
] as const;

export function OnboardingScreens({ onComplete }: OnboardingScreensProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentScreen = SCREEN_KEYS[currentIndex];
  const isLastScreen = currentIndex === SCREEN_KEYS.length - 1;

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLastScreen) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.skip')}
          >
            <Text className="text-muted font-semibold">{t('onboarding.skip')}</Text>
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
            {t(currentScreen.titleKey)}
          </Text>

          {/* Description */}
          <Text className="text-base text-muted text-center leading-relaxed max-w-sm">
            {t(currentScreen.descKey)}
          </Text>
        </Animated.View>
      </View>

      {/* Bottom Section */}
      <View className="px-8 pb-12">
        {/* Pagination Dots */}
        <View
          className="flex-row items-center justify-center mb-8 gap-2"
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('onboarding.a11y.paginationDot', {
            current: currentIndex + 1,
            total: SCREEN_KEYS.length,
          })}
        >
          {SCREEN_KEYS.map((_, index) => (
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
          accessible
          accessibilityRole="button"
          accessibilityLabel={isLastScreen ? t('onboarding.getStarted') : t('onboarding.next')}
          style={({ pressed }) => [
            {
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ]}
        >
          <Text className="text-background font-bold text-center text-lg">
            {isLastScreen ? t('onboarding.getStarted') : t('onboarding.next')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
