/**
 * Asistan'ın konuşma cevabı — balonsuz, sola yaslı, tam genişlik prose.
 * Kısa cevaplar (Sen kimsin?, kısa açıklama) için kullanılır. Markdown
 * destekli (bold, italic, link) ama kart-iskeleti yok.
 *
 * Tasarım kararı (26 Nis 2026, Hilal onayı): asistan balon kullanmaz.
 * Yön B refined — Claude.ai chat akışı pattern'i.
 */
import { Platform, View } from "react-native";
import Markdown from "react-native-markdown-display";

import { useColors } from "@/hooks/use-colors";

export type AssistantProseProps = {
  text: string;
};

export function AssistantProse({ text }: AssistantProseProps) {
  const colors = useColors();

  const styles = {
    body: { fontSize: 16, lineHeight: 24, color: colors.foreground, margin: 0 },
    strong: { fontWeight: "500" as const, color: colors.foreground },
    em: { fontStyle: "italic" as const },
    paragraph: { marginTop: 0, marginBottom: 8 },
    bullet_list: { marginVertical: 4 },
    ordered_list: { marginVertical: 4 },
    list_item: { marginBottom: 4 },
    code_inline: {
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      fontSize: 14,
      backgroundColor: colors.surface,
      paddingHorizontal: 4,
      borderRadius: 4,
    },
    link: { color: colors.primary, textDecorationLine: "underline" as const },
  };

  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 4 }}>
      <Markdown style={styles}>{text}</Markdown>
    </View>
  );
}
