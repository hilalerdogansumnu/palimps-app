/**
 * Vurgulamalar kartı — her kitap kendi alt-bölümünde, alıntılar quote stilinde
 * (sol mor şerit + serif italic), kullanıcı notları farklı stilde (mor 50
 * arka plan + "SENİN NOTUN" badge).
 *
 * Tasarım kararları (Hilal onayı 26 Nis):
 * - Alıntı = sol mor şerit + serif italik (Storytel warmth, kitap-içi-sözler)
 * - Kullanıcı notu = mor 50 arka plan blok + caps badge (alıntıdan ayrı)
 * - Sıralama: en son kaydedilen kitap üstte (server tarafında çözülmesi gerek;
 *   prompt kuralı bunu LLM'e dayatıyor, client default order'a güveniyor)
 */
import { useTranslation } from "react-i18next";
import { Platform, View, Text } from "react-native";

import { useColors } from "@/hooks/use-colors";

import type { HighlightsPayload } from "./parse";

export type HighlightsCardProps = {
  payload: HighlightsPayload;
};

export function HighlightsCard({ payload }: HighlightsCardProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const { books } = payload;

  const totalQuotes = books.reduce((acc, b) => acc + b.items.length, 0);

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
            }}
          >
            {t("chat.cards.highlights")}
          </Text>
          <Text style={{ fontSize: 11, color: colors.muted }}>
            {t("chat.cards.highlightCount", { books: books.length, quotes: totalQuotes })}
          </Text>
        </View>

        {books.length === 0 ? (
          <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, color: colors.muted, fontStyle: "italic" }}>
              {t("chat.cards.emptyHighlights")}
            </Text>
          </View>
        ) : (
          books.map((book, bookIdx) => (
            <View
              key={`${book.title}-${bookIdx}`}
              style={{
                paddingHorizontal: 14,
                paddingTop: 12,
                paddingBottom: 10,
                borderBottomWidth: bookIdx === books.length - 1 ? 0 : 0.5,
                borderBottomColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "500",
                  color: colors.foreground,
                  lineHeight: 21,
                  marginBottom: book.author ? 2 : 8,
                }}
              >
                {book.title}
              </Text>
              {book.author && (
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.muted,
                    marginBottom: 10,
                  }}
                >
                  {book.author} · {t("chat.cards.quoteCount", { count: book.items.length })}
                </Text>
              )}

              {book.items.map((item, idx) => {
                if (item.kind === "note") {
                  return (
                    <View
                      key={idx}
                      style={{
                        backgroundColor: colors.primary + "15",
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        marginBottom: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "500",
                          color: colors.primary,
                          letterSpacing: 0.6,
                          marginBottom: 3,
                        }}
                      >
                        {t("chat.cards.userNote")}
                      </Text>
                      <Text
                        style={{
                          fontSize: 14,
                          color: colors.foreground,
                          lineHeight: 19,
                        }}
                      >
                        {item.text}
                      </Text>
                    </View>
                  );
                }
                return (
                  <View
                    key={idx}
                    style={{
                      borderLeftWidth: 2,
                      borderLeftColor: colors.primary,
                      paddingLeft: 10,
                      paddingVertical: 2,
                      marginBottom: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily:
                          Platform.OS === "ios" ? "Charter" : Platform.OS === "android" ? "serif" : undefined,
                        fontStyle: "italic",
                        fontSize: 14,
                        color: colors.foreground,
                        lineHeight: 21,
                      }}
                    >
                      {item.text}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </View>
    </View>
  );
}
