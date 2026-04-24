import React from "react";
import { Text, View, Pressable, ScrollView, ActivityIndicator, Alert, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import Svg, { Path } from "react-native-svg";
import i18n from "@/lib/i18n";

import { ScreenContainer } from "@/components/screen-container";
import { NavigationBar } from "@/components/navigation-bar";
import { trpc } from "@/lib/trpc";
import { useColors } from "@/hooks/use-colors";
import { tagDisplay } from "@/lib/tag";

// v6 palette — AN detay semantic tints.
// Amber family = kitaptan gelen (highlights, OCR, marginalia).
// Purple family = AI / dijital (summary, user note).
// Light-mode tuned; dark mode variants eklenene kadar normal app
// varsayımı (light) geçerli. Token'a taşıma: theme.config.js'e
// v6 alanı açıldığında buradan kaldır.
const V6 = {
  summaryBg: "#EEEAFF",
  summaryText: "#2A1F5A",
  highlightsBg: "#FDF4E3",
  ocrBg: "#FBF3E0",
  ocrBorder: "#F5D98A",
  ocrText: "#3B2A08",
  marginBg: "#FBF3E0",
  marginText: "#3B2A08",
  noteBg: "#EEEAFF",
  noteText: "#2A1F5A",
} as const;

// Tek yerden değişsin diye helper — section başlıkları için
// küçük uppercase label.
const sectionLabelStyle = (mutedColor: string) =>
  ({
    fontSize: 11,
    color: mutedColor,
    fontWeight: "500" as const,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  });

export default function MomentDetailScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const momentId = parseInt(id, 10);

  const [isEditModalVisible, setIsEditModalVisible] = React.useState(false);
  const [editedNote, setEditedNote] = React.useState("");
  // SAYFA METNİ uzun ise ilk ~500 karakter göster, "Devamını gör" ile aç.
  // Reading-app: ortalama kitap sayfası OCR'i ~1500-2500 char → 500 fold
  // kısa özet hissi verir, sayfa tıkanmaz.
  const [ocrExpanded, setOcrExpanded] = React.useState(false);
  // VURGULADIKLARINIZ içinde tek tek highlight için expand state. Index
  // bazlı Set: sayfa açıldığında hiçbiri expanded değil; tap ile eklenir/
  // çıkarılır. Uzun highlight'lar (>140 char) sayfa akışını yeme riskini
  // öneriyordu — truncation konseptini Hilal onayladı, 140 char sınır.
  const [expandedHighlights, setExpandedHighlights] = React.useState<Set<number>>(
    () => new Set(),
  );
  const toggleHighlight = React.useCallback((idx: number) => {
    setExpandedHighlights((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const { data: moment, isLoading, refetch } = trpc.readingMoments.getById.useQuery({ id: momentId });
  const deleteMutation = trpc.readingMoments.delete.useMutation();
  const updateMutation = trpc.readingMoments.update.useMutation({
    onSuccess: () => {
      refetch();
      setIsEditModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("common.error"), error.message || t("common.updateFailed"));
    },
  });

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t("momentDetail.deleteTitle"),
      t("momentDetail.deleteConfirm"),
      [
        {
          text: t("common.cancel"),
          style: "cancel",
        },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id: momentId });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert(t("common.error"), t("momentDetail.deleteError"));
            }
          },
        },
      ]
    );
  };

  const handleMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      t("common.options"),
      "",
      [
        {
          text: t("momentDetail.editNote"),
          onPress: () => {
            setEditedNote(moment?.userNote || "");
            setIsEditModalVisible(true);
          },
        },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: handleDelete,
        },
        {
          text: t("common.cancel"),
          style: "cancel",
        },
      ]
    );
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({
      id: momentId,
      userNote: editedNote.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <ScreenContainer className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!moment) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text className="text-xl font-semibold text-foreground mb-3">{t("momentDetail.notFound")}</Text>
        <Pressable
          onPress={() => router.back()}
          className="bg-primary px-6 py-3 rounded-full"
          style={({ pressed }) => [
            { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text className="text-background font-semibold">{t("momentDetail.goBack")}</Text>
        </Pressable>
      </ScreenContainer>
    );
  }

  const createdDate = new Date(moment.createdAt);
  const localeMap: Record<string, string> = { en: "en-US", tr: "tr-TR", de: "de-DE", es: "es-ES" };
  const locale = localeMap[i18n.language] || "en-US";
  const formattedDate = createdDate.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <NavigationBar
        title={formattedDate}
        backLabel={t("bookDetail.title")}
        onBack={() => router.back()}
        rightNode={
          <Pressable
            onPress={handleMenu}
            hitSlop={{ top: 10, bottom: 10, left: 16, right: 8 }}
            style={({ pressed }) => [{ paddingHorizontal: 8, paddingVertical: 6, opacity: pressed ? 0.4 : 1 }]}
          >
            <Text style={{ fontSize: 22, color: colors.primary, lineHeight: 26 }}>···</Text>
          </Pressable>
        }
      />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>

        {/* Page Image — aspectRatio zorunlu: RN Image height'ı remote asset için
            async hesaplar; explicit oran olmadan height=0 ile render oluyordu
            (50328 smoke test: resim hiç görünmüyordu). book/[id].tsx ve
            tag/[name].tsx zaten 3/2 kullanıyor → parite. */}
        {moment.pageImageUrl && (
          <View className="px-6 mb-6">
            <Image
              source={{ uri: moment.pageImageUrl }}
              style={{
                width: "100%",
                aspectRatio: 3 / 2,
                borderRadius: 16,
                backgroundColor: colors.surface,
              }}
              contentFit="cover"
              transition={200}
              accessibilityLabel={t("momentDetail.pageImageAlt")}
            />
          </View>
        )}

        {/* Summary (Phase A enrichment) — AI-generated, purple family
            AI yıldızı sağ üstte: Gemini/Claude/ChatGPT deseni. Metin sola
            yaslı, sparkle text alignment'ını bozmuyor (paddingRight).
            Özet AI tarafından üretildiği için mor aile — user note ile
            aynı kutu rengi, yıldız "kim yazdı" ayrımını yapıyor. */}
        {moment.summary && (
          <View className="px-6 mb-6">
            <Text style={sectionLabelStyle(colors.muted)}>
              {t("momentDetail.summary")}
            </Text>
            <View
              style={{
                backgroundColor: V6.summaryBg,
                borderRadius: 12,
                padding: 14,
                paddingRight: 40,
                position: "relative",
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  lineHeight: 24,
                  color: V6.summaryText,
                  fontStyle: "italic",
                }}
              >
                {moment.summary}
              </Text>
              <Svg
                width={24}
                height={24}
                viewBox="0 0 24 24"
                style={{ position: "absolute", top: 12, right: 12 }}
              >
                <Path
                  d="M12 2 L13.4 10.6 L22 12 L13.4 13.4 L12 22 L10.6 13.4 L2 12 L10.6 10.6 Z"
                  fill={colors.primary}
                />
                <Path
                  d="M19 4 L19.5 6.5 L22 7 L19.5 7.5 L19 10 L18.5 7.5 L16 7 L18.5 6.5 Z"
                  fill={colors.accent}
                  fillOpacity={0.7}
                />
              </Svg>
            </View>
          </View>
        )}

        {/* Highlights (Phase B markings) — vurguladıklarınız
            Tek format: amber stripe + amber-cream bg. Kind ayrımı UI'da
            yok (backend'de saklı, ileride lazım olursa).
            null veya [] → section gizle (kullanıcı için gürültü).
            140 char üstü entry'ler truncate + "Devamını gör" — bazı pasajlar
            3+ cümle; tümü birden açık olursa sayfa akışı tıkanıyor. */}
        {moment.highlights && moment.highlights.length > 0 && (
          <View className="px-6 mb-6">
            <Text style={sectionLabelStyle(colors.muted)}>
              {t("momentDetail.highlights")}
            </Text>
            <View style={{ gap: 8 }}>
              {moment.highlights.map((h, idx) => {
                const HL_TRUNCATE = 140;
                const isLong = h.text.length > HL_TRUNCATE;
                const isExpanded = expandedHighlights.has(idx);
                const displayText = !isLong || isExpanded
                  ? h.text
                  : h.text.slice(0, HL_TRUNCATE).trimEnd() + "…";
                return (
                  <View
                    key={`hl-${idx}`}
                    style={{
                      flexDirection: "row",
                      backgroundColor: V6.highlightsBg,
                      borderRadius: 8,
                      overflow: "hidden",
                    }}
                  >
                    <View style={{ width: 3, backgroundColor: colors.warning }} />
                    <View style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 14 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          lineHeight: 21,
                          // V6.ocrText: V6.highlightsBg (sabit light amber) üstünde
                          // kontrast garantili. colors.foreground dynamic olduğu için
                          // dark mode'da light-on-light kontrast çöker. Diğer V6
                          // section'larıyla tonal hizalı.
                          color: V6.ocrText,
                        }}
                      >
                        {displayText}
                      </Text>
                      {isLong && (
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync();
                            toggleHighlight(idx);
                          }}
                          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                          style={({ pressed }) => [
                            { marginTop: 6, opacity: pressed ? 0.5 : 1 },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "600",
                              color: colors.primary,
                            }}
                          >
                            {isExpanded ? t("common.collapse") : t("common.readMore")}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* OCR Text — sayfa metni (amber family)
            Hairline border "kağıt üstünde metin" hissi veriyor.
            Uzun metin için truncate + "Devamını gör" toggle: OCR çoğu zaman
            1500+ char, ekranı tıkıyordu. 500 char threshold ilk ~6 cümle
            göstermeye yeter; isteyen aşar. */}
        {moment.ocrText && (() => {
          const OCR_TRUNCATE = 500;
          const isLong = moment.ocrText.length > OCR_TRUNCATE;
          const displayText = ocrExpanded || !isLong
            ? moment.ocrText
            : moment.ocrText.slice(0, OCR_TRUNCATE).trimEnd() + "…";
          return (
            <View className="px-6 mb-6">
              <Text style={sectionLabelStyle(colors.muted)}>
                {t("momentDetail.ocrText")}
              </Text>
              <View
                style={{
                  backgroundColor: V6.ocrBg,
                  borderWidth: 0.5,
                  borderColor: V6.ocrBorder,
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    lineHeight: 22,
                    color: V6.ocrText,
                  }}
                >
                  {displayText}
                </Text>
                {isLong && (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setOcrExpanded((v) => !v);
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                    style={({ pressed }) => [
                      { marginTop: 10, opacity: pressed ? 0.5 : 1 },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: colors.primary,
                      }}
                    >
                      {ocrExpanded ? t("common.collapse") : t("common.readMore")}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        })()}

        {/* Notes — birleşik (marginalia + user note)
            İşin özü aynı: kullanıcının fikri. Araç farkı formda:
              marginalia → amber-soft + Georgia italic (kitaba kalemle)
              userNote  → purple-soft + sans regular (dijital)
            Sıra: önce marginalia (prompt reading order), sonra user note. */}
        {((moment.marginalia && moment.marginalia.length > 0) || moment.userNote) && (
          <View className="px-6 mb-8">
            <Text style={sectionLabelStyle(colors.muted)}>
              {t("momentDetail.notes")}
            </Text>
            <View style={{ gap: 8 }}>
              {moment.marginalia?.map((m, idx) => (
                <View
                  key={`mg-${idx}`}
                  style={{
                    backgroundColor: V6.marginBg,
                    borderRadius: 10,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Platform.OS === "ios" ? "Georgia" : "serif",
                      fontStyle: "italic",
                      fontSize: 14,
                      lineHeight: 22,
                      color: V6.marginText,
                    }}
                  >
                    {m.text}
                  </Text>
                </View>
              ))}
              {moment.userNote && (
                <View
                  style={{
                    backgroundColor: V6.noteBg,
                    borderRadius: 10,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      lineHeight: 22,
                      color: V6.noteText,
                    }}
                  >
                    {moment.userNote}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Tags (Phase A enrichment) — sayfanın sonunda hafif bir detay
            Cross-book tema browser: chip'e basınca `/tag/[name]` → aynı
            tema'ya sahip tüm an'lar. Pressable wrap, haptik + router.push.
            AI kaynaklı olduğu için mor aile (accent + primary). >=2 tag
            koşulu prompt çıktısı tekil/boş dönerse UI kirlenmesin diye. */}
        {moment.tags && moment.tags.length >= 2 && (
          <View
            className="px-6 mb-8"
            style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}
          >
            {moment.tags.map((tag, idx) => (
              <Pressable
                key={`${tag}-${idx}`}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/tag/${encodeURIComponent(tag)}` as any);
                }}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.accent + "26",
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 999,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.primary,
                    fontWeight: "500",
                  }}
                >
                  {tagDisplay(tag)}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Spacer for scroll */}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                backgroundColor: colors.background,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                padding: 24,
                minHeight: 300,
              }}
            >
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg text-foreground font-medium">{t("momentDetail.editNote")}</Text>
                <Pressable
                  onPress={() => setIsEditModalVisible(false)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text className="text-base text-muted">{t("common.cancel")}</Text>
                </Pressable>
              </View>

              <TextInput
                value={editedNote}
                onChangeText={setEditedNote}
                placeholder={t("momentDetail.notePlaceholder")}
                placeholderTextColor={colors.muted}
                multiline
                numberOfLines={6}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 12,
                  padding: 16,
                  color: colors.foreground,
                  fontSize: 16,
                  minHeight: 150,
                  textAlignVertical: "top",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />

              <Pressable
                onPress={handleSaveEdit}
                disabled={updateMutation.isPending}
                style={({ pressed }) => [
                  {
                    marginTop: 16,
                    paddingVertical: 14,
                    paddingHorizontal: 24,
                    borderRadius: 12,
                    backgroundColor: colors.primary,
                    opacity: pressed || updateMutation.isPending ? 0.6 : 1,
                  },
                ]}
              >
                <Text className="text-base text-white text-center font-medium">
                  {updateMutation.isPending ? t("momentDetail.saving") : t("common.save")}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}
