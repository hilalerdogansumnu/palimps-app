import { View, Text, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/use-colors";
import { a11y } from "@/lib/accessibility";

interface NavigationBarProps {
  /** Screen title shown in the center */
  title?: string;
  /** Whether to show the back button (default: true) */
  showBack?: boolean;
  /** Custom back label — iOS convention is previous screen title or "Geri" */
  backLabel?: string;
  /** Called when back is pressed; defaults to router.back() */
  onBack?: () => void;
  /** Right side: text label */
  rightLabel?: string;
  /** Right side: whether right action is disabled */
  rightDisabled?: boolean;
  /** Right side: callback */
  onRight?: () => void;
  /** Right side: custom node (overrides rightLabel) */
  rightNode?: React.ReactNode;
}

/**
 * iOS-style navigation bar.
 *
 * Layout mirrors Apple Human Interface Guidelines:
 *   [ ‹ Back ]   [ Title ]   [ Action ]
 *
 * - Back chevron + label on the left (tappable area 44pt minimum)
 * - Title centered, truncated with ellipsis
 * - Optional right action (text button or custom node)
 * - 44pt tall content area + platform-appropriate bottom border
 */
export function NavigationBar({
  title,
  showBack = true,
  backLabel,
  onBack,
  rightLabel,
  rightDisabled = false,
  onRight,
  rightNode,
}: NavigationBarProps) {
  const colors = useColors();

  const handleBack = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleRight = () => {
    if (rightDisabled) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onRight?.();
  };

  return (
    <View
      style={{
        height: 44,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 8,
        borderBottomWidth: 0.33,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
      }}
    >
      {/* Left: back button */}
      <View style={{ flex: 1, alignItems: "flex-start" }}>
        {showBack && (
          <Pressable
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 16 }}
            style={({ pressed }) => [
              {
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 8,
                paddingVertical: 6,
                opacity: pressed ? 0.4 : 1,
              },
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={a11y.backButton.label}
            accessibilityHint={a11y.backButton.hint}
          >
            {/* SF Symbols chevron.left equivalent */}
            <Text
              style={{
                fontSize: 17,
                color: colors.primary,
                marginRight: backLabel ? 2 : 0,
                // Use a proper chevron character — clean, no emoji
                fontWeight: "400",
              }}
            >
              ‹
            </Text>
            {backLabel && (
              <Text
                style={{
                  fontSize: 17,
                  color: colors.primary,
                  fontWeight: "400",
                }}
                numberOfLines={1}
              >
                {backLabel}
              </Text>
            )}
          </Pressable>
        )}
      </View>

      {/* Center: title */}
      <View style={{ flex: 2, alignItems: "center" }}>
        {title ? (
          <Text
            style={{
              fontSize: 17,
              fontWeight: "600",
              color: colors.foreground,
              letterSpacing: -0.3,
            }}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
      </View>

      {/* Right: action */}
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        {rightNode ? (
          rightNode
        ) : rightLabel ? (
          <Pressable
            onPress={handleRight}
            disabled={rightDisabled}
            hitSlop={{ top: 10, bottom: 10, left: 16, right: 8 }}
            style={({ pressed }) => [
              {
                paddingHorizontal: 8,
                paddingVertical: 6,
                opacity: rightDisabled ? 0.35 : pressed ? 0.4 : 1,
              },
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={rightLabel || "Action"}
            accessibilityState={{ disabled: rightDisabled }}
          >
            <Text
              style={{
                fontSize: 17,
                fontWeight: "600",
                color: rightDisabled ? colors.muted : colors.primary,
              }}
            >
              {rightLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
