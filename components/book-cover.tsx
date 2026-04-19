import { View, Text } from "react-native";
import { Image } from "expo-image";

import { useColors } from "@/hooks/use-colors";

/**
 * Shared book-cover renderer used across home search, home list, and book
 * detail. Before this component the three call sites had:
 *   - inconsistent image vs. placeholder sizes (48×72 image, 60×90 placeholder)
 *   - mismatched border radii on image vs. placeholder (6 vs. 8)
 *   - react-native Image with no cache policy (flickers on list scroll)
 *
 * Using a single component guarantees image and placeholder share dimensions,
 * radius, and background, and pipes through expo-image for disk/memory caching.
 */

export type BookCoverSize = "xs" | "sm" | "md" | "lg";

type SizeSpec = { width: number; height: number; radius: number; initialFontSize: number };

const SIZE_MAP: Record<BookCoverSize, SizeSpec> = {
  xs: { width: 40, height: 60, radius: 5, initialFontSize: 13 },
  sm: { width: 48, height: 72, radius: 6, initialFontSize: 15 },
  md: { width: 60, height: 90, radius: 6, initialFontSize: 18 },
  lg: { width: 90, height: 135, radius: 12, initialFontSize: 28 },
};

function getBookInitials(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return "??";
  const words = trimmed.split(/\s+/);
  if (words.length === 1) return trimmed.substring(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

type Props = {
  uri: string | null | undefined;
  title: string;
  size?: BookCoverSize;
  /** Override the default accessibility label (defaults to "Book: <title>"). */
  accessibilityLabel?: string;
};

export function BookCover({ uri, title, size = "md", accessibilityLabel }: Props) {
  const colors = useColors();
  const spec = SIZE_MAP[size];
  const label = accessibilityLabel ?? `Book: ${title}`;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        accessible
        accessibilityLabel={label}
        style={{
          width: spec.width,
          height: spec.height,
          borderRadius: spec.radius,
          backgroundColor: colors.surface,
        }}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        width: spec.width,
        height: spec.height,
        borderRadius: spec.radius,
        backgroundColor: colors.accent + "20",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: spec.initialFontSize,
          fontWeight: "700",
          color: colors.accent,
        }}
      >
        {getBookInitials(title)}
      </Text>
    </View>
  );
}
