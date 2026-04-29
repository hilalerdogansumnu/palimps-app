/**
 * Kitap listesi kartı — asistan "Okuduğum kitapları listele" sorusuna cevaben
 * full-width kart olarak render eder. Başlık + her kitap kendi satırında.
 *
 * Eski balon-içi davranıştaki harf-harf wrap problemi (Hilal 26 Nis dogfood,
 * Ekran 4-5) burada yok — kart genişliği balon değil, list-item width
 * intrinsik metin uzunluğunu serbest bırakıyor.
 */
import { useTranslation } from "react-i18next";
import { View, Text } from "react-native";

import { useColors } from "@/hooks/use-colors";

import type { BookListPayload } from "./parse";

export type BookListCardProps = {
  payload: BookListPayload;
};

export function BookListCard({ payload }: BookListCardProps) {
  const colors = useColors();
  const { t } = useTranslation();

  const { count, items } = payload;

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
            {t("chat.cards.bookCount", { count })}
          </Text>
        </View>

        {items.length === 0 ? (
          <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, color: colors.muted, fontStyle: "italic" }}>
              {t("chat.cards.empty")}
            </Text>
          </View>
        ) : (
          items.map((item, index) => (
            <View
              key={`${item.title}-${index}`}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderBottomWidth: index === items.length - 1 ? 0 : 0.5,
                borderBottomColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "500",
                  color: colors.foreground,
                  lineHeight: 21,
                  marginBottom: item.author ? 2 : 0,
                }}
              >
                {item.title}
              </Text>
              {item.author && (
                <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
                  {item.author}
                </Text>
              )}
            </View>
          ))
        )}
      </View>
    </View>
  );
}
