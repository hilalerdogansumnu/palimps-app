/**
 * Kitap öneri kartı — kategorize öneri yapısı, intro paragrafı + her kategoride
 * 1+ öneri (başlık + yazar + neden öneriyor).
 *
 * Tasarım kararları:
 * - "Neden öneriyor" stili: sans, italik DEĞİL, secondary muted (Hilal onayı 26 Nis)
 * - Kategori başlıkları: küçük caps + hairline ayraç
 * - "İNTERNETTEN" badge: v1.0'da hiç gösterme (webGrounded daima false, A kararı)
 *   Server v1.1'de Gemini grounding eklerse webGrounded=true → badge görünür hâle gelir.
 */
import { useTranslation } from "react-i18next";
import { View, Text } from "react-native";

import { useColors } from "@/hooks/use-colors";

import type { RecommendationsPayload } from "./parse";

export type RecommendationCardProps = {
  payload: RecommendationsPayload;
};

export function RecommendationCard({ payload }: RecommendationCardProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const { intro, webGrounded, categories } = payload;

  return (
    <View style={{ paddingHorizontal: 14 }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 0.5,
          borderColor: colors.border,
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 8,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.border,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: colors.muted,
              letterSpacing: 0.5,
              fontWeight: "500",
            }}
          >
            {t("chat.cards.recommendations")}
          </Text>
          {/* webGrounded badge — v1.0'da false, görünmez. v1.1'de Gemini grounding
              eklenince true döner ve badge "İNTERNETTEN" / "FROM WEB" gösterir. */}
          {webGrounded && (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: colors.primary + "15",
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  color: colors.primary,
                  letterSpacing: 0.7,
                  fontWeight: "500",
                }}
              >
                {t("chat.cards.fromWeb")}
              </Text>
            </View>
          )}
        </View>

        {intro.length > 0 && (
          <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 }}>
            <Text style={{ fontSize: 14, color: colors.foreground, lineHeight: 21 }}>
              {intro}
            </Text>
          </View>
        )}

        {categories.length === 0 ? (
          <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, color: colors.muted, fontStyle: "italic" }}>
              {t("chat.cards.emptyRecommendations")}
            </Text>
          </View>
        ) : (
          categories.map((cat, catIdx) => (
            <View
              key={`${cat.name}-${catIdx}`}
              style={{
                paddingHorizontal: 14,
                paddingBottom: catIdx === categories.length - 1 ? 12 : 8,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 12,
                  marginBottom: 10,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    color: colors.muted,
                    letterSpacing: 0.6,
                    fontWeight: "500",
                  }}
                  numberOfLines={1}
                >
                  {cat.name.toLocaleUpperCase("tr-TR")}
                </Text>
                <View style={{ flex: 1, height: 0.5, backgroundColor: colors.border }} />
              </View>

              {cat.items.map((item, idx) => (
                <View
                  key={`${item.title}-${idx}`}
                  style={{ marginBottom: idx === cat.items.length - 1 ? 0 : 14 }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: "500",
                      color: colors.foreground,
                      lineHeight: 21,
                    }}
                  >
                    {item.title}
                  </Text>
                  {item.author && (
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.muted,
                        marginBottom: 4,
                      }}
                    >
                      {item.author}
                    </Text>
                  )}
                  {item.rationale.length > 0 && (
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.muted,
                        lineHeight: 19,
                        marginTop: 2,
                      }}
                    >
                      {item.rationale}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          ))
        )}
      </View>
    </View>
  );
}
