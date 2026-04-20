import { Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useColors } from "@/hooks/use-colors";
import { Fonts } from "@/constants/theme";

/**
 * Hangi cap yüzeyi vurulduğunda açılacağını belirleyen discriminator.
 *
 * Free tier (görünür, kullanıcıyı upgrade'e davet eder):
 *   - "bookLimit"       → 5 aktif kitap dolu
 *   - "momentLimit"     → bir kitap 10 an dolu
 *   - "assistantQuota"  → 10 lifetime Hafıza sorusu bitmiş
 *
 * Pro tier (gizli sanity cap — nadiren tetiklenir, copy sakin olmalı):
 *   - "bookMonthlyLimit" → 30-day rolling 100 kitap
 *   - "momentSanityCap"  → tek kitapta 500 an
 */
export type UpsellKind =
  | "bookLimit"
  | "momentLimit"
  | "assistantQuota"
  | "bookMonthlyLimit"
  | "momentSanityCap";

interface UpsellSheetProps {
  visible: boolean;
  kind: UpsellKind;
  onClose: () => void;
}

const KIND_ICON: Record<UpsellKind, keyof typeof MaterialIcons.glyphMap> = {
  bookLimit: "auto-stories",
  momentLimit: "photo-library",
  assistantQuota: "auto-awesome",
  bookMonthlyLimit: "schedule",
  momentSanityCap: "menu-book",
};

// Free tier cap'leri upgrade CTA'sı gösterir; Pro sanity cap'leri sadece
// nazik bir uyarı — satmaya çalışmak kötü hissettirir, kullanıcı ZATEN Pro.
const KIND_SHOWS_UPGRADE: Record<UpsellKind, boolean> = {
  bookLimit: true,
  momentLimit: true,
  assistantQuota: true,
  bookMonthlyLimit: false,
  momentSanityCap: false,
};

/**
 * Paywall değil — davetkar bir upsell sheet. Linear hızında, Storytel sıcaklığında,
 * Supercell'in "your reward" hissiyle. Kullanıcı cap'e takılınca görünür, amaç:
 * 1. Ne olduğunu kısa sürede anlatmak,
 * 2. Yolu açmayı (upgrade) doğal bir seçenek olarak sunmak,
 * 3. İstenmediğinde çekilmek.
 *
 * Free cap'lerinde upgrade CTA + "Şimdi değil"; Pro sanity cap'lerinde sadece
 * "Tamam" — çünkü zaten Pro kullanıcıya sat yapmak kaba.
 */
export function UpsellSheet({ visible, kind, onClose }: UpsellSheetProps) {
  const { t } = useTranslation();
  const colors = useColors();

  const showsUpgrade = KIND_SHOWS_UPGRADE[kind];

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    // Modal close animation ile push arasında küçük bir kare; Expo Router
    // zaten stack push'u sıraya koyduğu için blocking beklemeye gerek yok.
    router.push("/premium");
  };

  const handleClose = () => {
    Haptics.selectionAsync();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        accessible
        accessibilityLabel={t("common.cancel")}
        accessibilityRole="button"
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        }}
      >
        {/* Sheet gövdesi — dışa tıklama kapatır, içine tıklama değil */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: 40,
          }}
        >
          {/* Grabber — iOS sheet metaforu */}
          <View
            style={{
              alignSelf: "center",
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: 20,
            }}
          />

          <View
            style={{
              alignSelf: "center",
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: colors.accent + "33", // 20% opacity ring
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <MaterialIcons
              name={KIND_ICON[kind]}
              size={28}
              color={colors.primary}
            />
          </View>

          <Text
            style={{
              fontFamily: Fonts?.rounded,
              fontSize: 22,
              fontWeight: "700",
              color: colors.foreground,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            {t(`freemium.${kind}.title`)}
          </Text>

          <Text
            style={{
              fontSize: 15,
              lineHeight: 22,
              color: colors.muted,
              textAlign: "center",
              marginBottom: kind === "bookLimit" ? 12 : 24,
            }}
          >
            {t(`freemium.${kind}.body`)}
          </Text>

          {kind === "bookLimit" ? (
            <Text
              style={{
                fontSize: 13,
                lineHeight: 18,
                color: colors.muted,
                textAlign: "center",
                marginBottom: 24,
                fontStyle: "italic",
              }}
            >
              {t("freemium.bookLimit.archiveHint")}
            </Text>
          ) : null}

          {showsUpgrade ? (
            <Pressable
              onPress={handleUpgrade}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("freemium.upgradeCta")}
              style={({ pressed }) => ({
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                marginBottom: 8,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontWeight: "600",
                  fontSize: 16,
                }}
              >
                {t("freemium.upgradeCta")}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleClose}
            accessible
            accessibilityRole="button"
            accessibilityLabel={
              showsUpgrade ? t("freemium.laterCta") : t("common.done")
            }
            style={{
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.muted,
                fontSize: 15,
                fontWeight: "500",
              }}
            >
              {showsUpgrade ? t("freemium.laterCta") : t("common.done")}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
