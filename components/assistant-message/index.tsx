/**
 * Asistan mesajı router'ı — server'dan gelen structured AssistantResponse'a
 * göre uygun kart component'ini seçer.
 *
 * Plan C (27 Nis 2026): client-side parsing kalktı. Server Gemini JSON mode
 * ile schema'ya uyan yapılandırılmış payload döndürüyor (shared/chatSchema.ts);
 * burada doğrudan kind switch'i yapıyoruz. Bug A intermittent kapandı —
 * format kayma olasılığı sıfır.
 *
 * Tasarım: "Yön B refined" — asistan balon kullanmaz, kısa cevap = prose,
 * yapısal cevap = full-width kart. (Hilal onayı 26 Nis 2026)
 */
import { View } from "react-native";

import type { AssistantResponse } from "../../shared/chatSchema";

import { BookListCard } from "./book-list-card";
import { HighlightsCard } from "./highlights-card";
import { AssistantProse } from "./prose";
import { RecommendationCard } from "./recommendation-card";
import { TagCloudCard } from "./tag-cloud-card";

export type AssistantMessageProps = {
  payload: AssistantResponse;
};

export function AssistantMessage({ payload }: AssistantMessageProps) {
  return (
    <View style={{ width: "100%" }}>
      {payload.kind === "prose" && <AssistantProse text={payload.text} />}
      {payload.kind === "book-list" && <BookListCard payload={payload} />}
      {payload.kind === "tag-cloud" && <TagCloudCard payload={payload} />}
      {payload.kind === "highlights" && <HighlightsCard payload={payload} />}
      {payload.kind === "recommendations" && <RecommendationCard payload={payload} />}
    </View>
  );
}

export type { AssistantResponse, AssistantKind } from "../../shared/chatSchema";
