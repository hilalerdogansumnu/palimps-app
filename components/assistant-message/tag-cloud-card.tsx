/**
 * Tag bulutu kartı — chip layout, frekans rakamlı, flex-wrap.
 * Eski tek-sütun harf-harf wrap (Hilal 26 Nis Ekran 8) sorunu burada yok:
 * her tag tek satırlık chip, alana sığmayan satıra atılıyor.
 *
 * v1.0: chip'ler tıklanmaz (sadece görsel). v1.1 backlog: tag'e tıkla → o
 * tag'li an'ları getir (Hilal onayı 26 Nis).
 */
import { useTranslation } from "react-i18next";
import { View, Text } from "react-native";

import { useColors } from "@/hooks/use-colors";

import type { TagCloudPayload } from "./parse";

export type TagCloudCardProps = {
  payload: TagCloudPayload;
};

export function TagCloudCard({ payload }: TagCloudCardProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const { bookTitle, tags } = payload;

  const headerLabel = bookTitle
    ? t("chat.cards.tagsForBook", { book: bookTitle })
    : t("chat.cards.allTags");

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
            alignItems: "baseline",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              color: colors.muted,
              letterSpacing: 0.5,
              fontWeight: "500",
              flex: 1,
            }}
            numberOfLines={2}
          >
            {headerLabel}
          </Text>
          <Text style={{ fontSize: 11, color: colors.muted, marginLeft: 8 }}>
            {t("chat.cards.tagCount", { count: tags.length })}
          </Text>
        </View>

        {tags.length === 0 ? (
          <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, color: colors.muted, fontStyle: "italic" }}>
              {t("chat.cards.emptyTags")}
            </Text>
          </View>
        ) : (
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {tags.map((tag, index) => (
              <View
                key={`${tag.name}-${index}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: colors.primary + "15",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.primary,
                    fontWeight: "500",
                    lineHeight: 16,
                  }}
                >
                  {tag.name}
                </Text>
                {tag.count !== null && tag.count >= 2 && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.primary,
                      opacity: 0.6,
                    }}
                  >
                    {tag.count}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
