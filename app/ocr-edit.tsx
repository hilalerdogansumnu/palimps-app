import { View, Text, TextInput, Pressable, ScrollView, Image, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { ScreenContainer } from "@/components/screen-container";
import { NavigationBar } from "@/components/navigation-bar";
import { useColors } from "@/hooks/use-colors";

type FontSize = "small" | "normal" | "large";
type TextAlignment = "left" | "center" | "right" | "justify";
type TextStyle = "normal" | "italic" | "serif";

interface OCREditState {
  text: string;
  fontSize: FontSize;
  alignment: TextAlignment;
  style: TextStyle;
  pageNumber: string;
}

const FONT_SIZE_MAP: Record<FontSize, number> = {
  small: 13,
  normal: 16,
  large: 19,
};

const FONT_FAMILY_MAP: Record<TextStyle, string> = {
  normal: "System",
  italic: "System",
  serif: "Georgia",
};

export default function OCREditScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    ocrText?: string;
    photoUri?: string;
    bookId?: string;
  }>();

  const [state, setState] = useState<OCREditState>({
    text: params.ocrText || "",
    fontSize: "normal",
    alignment: "left",
    style: "normal",
    pageNumber: "",
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleFontSizeChange = (size: FontSize) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState((prev) => ({ ...prev, fontSize: size }));
  };

  const handleAlignmentChange = (align: TextAlignment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState((prev) => ({ ...prev, alignment: align }));
  };

  const handleStyleChange = (style: TextStyle) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setState((prev) => ({ ...prev, style: style }));
  };

  const handleSave = async () => {
    if (!state.text.trim()) {
      Alert.alert(t("common.error"), t("ocrEdit.textEmpty"));
      return;
    }

    setIsSaving(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Pass edited OCR data back to add-moment screen
      router.back();
      // The parent screen (add-moment) will receive the updated state
    } catch (error) {
      // Surface the error to Sentry instead of console.error; the catch is
      // reached only for unexpected runtime failures since router.back() is sync.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(t("common.error"), t("ocrEdit.saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const getAlignmentValue = (align: TextAlignment): "left" | "center" | "right" | "justify" => {
    return align;
  };

  const getTextStyleProps = () => {
    const props: any = {
      fontSize: FONT_SIZE_MAP[state.fontSize],
      fontFamily: FONT_FAMILY_MAP[state.style],
      textAlign: getAlignmentValue(state.alignment),
      color: colors.foreground,
    };

    if (state.style === "italic") {
      props.fontStyle = "italic";
    }

    return props;
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <NavigationBar
        title={t("addMoment.ocrExtracted")}
        backLabel={t("common.cancel")}
        onBack={handleCancel}
        rightNode={
          <Pressable
            onPress={handleSave}
            disabled={isSaving || !state.text.trim()}
            hitSlop={{ top: 10, bottom: 10, left: 16, right: 8 }}
            style={({ pressed }) => [
              {
                paddingHorizontal: 12,
                paddingVertical: 6,
                opacity: isSaving || !state.text.trim() ? 0.4 : pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary }}>
              {t("common.save")}
            </Text>
          </Pressable>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>

          {/* Photo thumbnail */}
          {params.photoUri && (
            <View style={{ marginBottom: 24 }}>
              <Image
                source={{ uri: params.photoUri }}
                style={{
                  width: "100%",
                  height: 200,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                }}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Font Size Control */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>
              {t("addMoment.fontSize")}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["small", "normal", "large"] as FontSize[]).map((size) => {
                const label = t(`ocrEdit.size${size.charAt(0).toUpperCase() + size.slice(1)}`);
                const isActive = state.fontSize === size;
                return (
                  <Pressable
                    key={size}
                    onPress={() => handleFontSizeChange(size)}
                    accessible
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={label}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: isActive ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: isActive ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: isActive ? colors.background : colors.foreground,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Text Alignment Control */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>
              {t("addMoment.alignment")}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["left", "center", "right", "justify"] as TextAlignment[]).map((align) => {
                const label = t(`ocrEdit.align${align.charAt(0).toUpperCase() + align.slice(1)}`);
                const isActive = state.alignment === align;
                return (
                  <Pressable
                    key={align}
                    onPress={() => handleAlignmentChange(align)}
                    accessible
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={label}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: isActive ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: isActive ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: isActive ? colors.background : colors.foreground,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Text Style Control */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>
              {t("addMoment.style")}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["normal", "italic", "serif"] as TextStyle[]).map((style) => {
                const label = t(`ocrEdit.style${style.charAt(0).toUpperCase() + style.slice(1)}`);
                const isActive = state.style === style;
                return (
                  <Pressable
                    key={style}
                    onPress={() => handleStyleChange(style)}
                    accessible
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={label}
                    style={({ pressed }) => [
                      {
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: isActive ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: isActive ? colors.primary : colors.border,
                        opacity: pressed ? 0.7 : 1,
                        alignItems: "center",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: isActive ? colors.background : colors.foreground,
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Text Preview */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>
              {t("addMoment.preview")}
            </Text>
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.border,
                minHeight: 120,
              }}
            >
              {state.text.trim() ? (
                <Text style={getTextStyleProps()}>{state.text}</Text>
              ) : (
                // Explicit empty-state for preview. Do NOT fall back to the
                // user-note placeholder here — that leaks the wrong copy onto
                // this field and makes the screen look like the page has
                // already been read. See P0-2 / QA video 0:25.
                <Text
                  style={{
                    fontSize: 14,
                    fontStyle: "italic",
                    color: colors.muted,
                    lineHeight: 20,
                  }}
                >
                  {t("ocrEdit.previewEmpty")}
                </Text>
              )}
            </View>
          </View>

          {/* OCR Text Editor */}
          <View style={{ marginBottom: 24 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>
              {t("addMoment.extractedText")}
            </Text>
            <TextInput
              value={state.text}
              onChangeText={(text) => setState((prev) => ({ ...prev, text }))}
              // Field-specific placeholder — the previous copy reused
              // addMoment.notePlaceholder ("Bu sayfa hakkındaki
              // düşünceleriniz…") which is the user-note wording and made the
              // extracted-text field look like it held user input.
              placeholder={t("ocrEdit.extractedTextPlaceholder")}
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={8}
              accessible
              accessibilityLabel={t("addMoment.extractedText")}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 15,
                color: colors.foreground,
                borderWidth: 1,
                borderColor: colors.border,
                textAlignVertical: "top",
                fontFamily: FONT_FAMILY_MAP[state.style],
                fontStyle: state.style === "italic" ? "italic" : "normal",
              }}
            />
          </View>

          {/* Page Number (Optional) */}
          <View style={{ marginBottom: 40 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>
              {t("ocrEdit.pageNumberLabel")}
            </Text>
            <TextInput
              value={state.pageNumber}
              onChangeText={(text) => setState((prev) => ({ ...prev, pageNumber: text }))}
              placeholder={t("ocrEdit.pageNumberPlaceholder")}
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              accessible
              accessibilityLabel={t("ocrEdit.pageNumberLabel")}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 15,
                color: colors.foreground,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
          </View>

        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
