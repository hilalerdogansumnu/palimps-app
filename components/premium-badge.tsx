import { View, Text } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface PremiumBadgeProps {
  size?: "small" | "medium" | "large";
}

/**
 * Premium Badge Component
 * Theme-aware premium indicator. Uses the `primary` token (deep violet)
 * with white text for WCAG AA legibility in both light and dark modes.
 * The emoji-free label matches Apple's preferred text-based status indicators.
 */
export function PremiumBadge({ size = "medium" }: PremiumBadgeProps) {
  const colors = useColors();

  const padding = {
    small: { paddingHorizontal: 8, paddingVertical: 2 },
    medium: { paddingHorizontal: 12, paddingVertical: 4 },
    large: { paddingHorizontal: 16, paddingVertical: 8 },
  }[size];

  const fontSize = {
    small: 11,
    medium: 13,
    large: 15,
  }[size];

  return (
    <View
      style={{
        ...padding,
        backgroundColor: colors.primary,
        borderRadius: 999,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.22,
        shadowRadius: 6,
        elevation: 3,
      }}
      accessible
      accessibilityRole="text"
      accessibilityLabel="Premium"
    >
      <Text
        style={{
          fontSize,
          fontWeight: "700",
          color: "#FFFFFF",
          letterSpacing: 0.4,
        }}
      >
        Premium
      </Text>
    </View>
  );
}
