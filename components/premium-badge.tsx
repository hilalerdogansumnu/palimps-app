import { View, Text } from "react-native";

interface PremiumBadgeProps {
  size?: "small" | "medium" | "large";
}

/**
 * Premium Badge Component
 * Shows a premium indicator badge for premium users
 */
export function PremiumBadge({ size = "medium" }: PremiumBadgeProps) {
  const sizeClasses = {
    small: "px-2 py-0.5",
    medium: "px-3 py-1",
    large: "px-4 py-2",
  };

  const textSizeClasses = {
    small: "text-xs",
    medium: "text-sm",
    large: "text-base",
  };

  return (
    <View
      className={`bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full flex-row items-center ${sizeClasses[size]}`}
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <Text className={`font-bold text-white ${textSizeClasses[size]}`}>
        👑 Premium
      </Text>
    </View>
  );
}
