/**
 * Asistan mesajı router'ı — content'i parse'lar, kart tipine göre uygun
 * component'i seçer. chat.tsx'in renderMessage'ındaki assistant message
 * branch'i artık bu component'e devrediyor.
 *
 * Tasarım: "Yön B refined" — asistan balon kullanmaz, kısa cevap = prose,
 * yapısal cevap = full-width kart. (Hilal onayı 26 Nis 2026)
 */
import { View } from "react-native";

import { BookListCard } from "./book-list-card";
import { HighlightsCard } from "./highlights-card";
import { parseAssistantContent } from "./parse";
import { AssistantProse } from "./prose";
import { RecommendationCard } from "./recommendation-card";
import { TagCloudCard } from "./tag-cloud-card";

export type AssistantMessageProps = {
  content: string;
};

export function AssistantMessage({ content }: AssistantMessageProps) {
  const parsed = parseAssistantContent(content);

  return (
    <View style={{ width: "100%" }}>
      {parsed.kind === "prose" && <AssistantProse text={parsed.payload.text} />}
      {parsed.kind === "book-list" && <BookListCard payload={parsed.payload} />}
      {parsed.kind === "tag-cloud" && <TagCloudCard payload={parsed.payload} />}
      {parsed.kind === "highlights" && <HighlightsCard payload={parsed.payload} />}
      {parsed.kind === "recommendations" && <RecommendationCard payload={parsed.payload} />}
    </View>
  );
}

export { parseAssistantContent } from "./parse";
export type { ParsedAssistantContent, AssistantKind } from "./parse";
