import { useEffect, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  PanResponder,
  type PanResponderInstance,
  Platform,
} from "react-native";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/use-colors";

/**
 * In-app freeform crop step used before OCR.
 *
 * Why: iOS ImagePicker'ın `allowsEditing: true` seçimi 1:1 square'e kilitli;
 * kitap sayfası fotoğrafı için kullanılamaz çünkü kenarlardaki masa/parmak/
 * komşu sayfa gibi alanlar OCR'a sızıp metni bozuyor. Kullanıcı kendi
 * çerçeveleme kararını vermeli.
 *
 * Nasıl: Modal içinde 4 köşe tutamaçlı bir crop rect; PanResponder her köşeyi
 * bağımsız sürükler, clampRect minimum 80pt koruyor ve image box sınırları
 * dışına çıkmayı engelliyor. Onayda display-space koordinatlar natural-image
 * koordinatlarına çevrilir, `ImageManipulator.manipulateAsync` ile kesilir.
 */

interface CropModalProps {
  /** URI of the image to crop. When null, the modal is hidden. */
  uri: string | null;
  /** Called with the cropped image URI (file:// path to a JPEG). */
  onDone: (croppedUri: string) => void;
  /** Called when the user cancels without cropping. */
  onCancel: () => void;
}

type Rect = { x: number; y: number; w: number; h: number };

const MIN_CROP = 80; // display-space points
const HANDLE_VISUAL = 22;
const HANDLE_HIT = 44;

export function CropModal({ uri, onDone, onCancel }: CropModalProps) {
  const colors = useColors();
  const { t } = useTranslation();

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [container, setContainer] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [rect, setRect] = useState<Rect | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Keep a ref so PanResponders (created once) can read the latest rect
  // without being re-bound on every update.
  const rectRef = useRef<Rect | null>(null);
  useEffect(() => {
    rectRef.current = rect;
  }, [rect]);

  // Reset state whenever a new uri flows in.
  useEffect(() => {
    if (!uri) {
      setNatural(null);
      setRect(null);
      setLoadError(false);
      setIsProcessing(false);
      return;
    }
    setLoadError(false);
    Image.getSize(
      uri,
      (w, h) => setNatural({ w, h }),
      () => setLoadError(true),
    );
  }, [uri]);

  // Compute the display box (contain-fit) and a default inset rect once we
  // know both the natural dims and the container size.
  const imageBox = (() => {
    if (!natural || !container) return null;
    const scale = Math.min(container.w / natural.w, container.h / natural.h);
    const w = natural.w * scale;
    const h = natural.h * scale;
    const x = (container.w - w) / 2;
    const y = (container.h - h) / 2;
    return { x, y, w, h };
  })();

  // Mirror imageBox into a ref so PanResponder move handlers (created once,
  // see below) can read the latest clamping bounds after natural/container
  // resolve asynchronously.
  const imageBoxRef = useRef<typeof imageBox>(null);
  useEffect(() => {
    imageBoxRef.current = imageBox;
  }, [imageBox]);

  // Initialise the crop rect to ~92% of the image box the first time the box
  // becomes available.
  useEffect(() => {
    if (!imageBox || rect) return;
    const inset = 0.04;
    setRect({
      x: imageBox.x + imageBox.w * inset,
      y: imageBox.y + imageBox.h * inset,
      w: imageBox.w * (1 - inset * 2),
      h: imageBox.h * (1 - inset * 2),
    });
  }, [imageBox, rect]);

  const clampCorner = (
    next: Rect,
    corner: "tl" | "tr" | "bl" | "br",
  ): Rect => {
    const box = imageBoxRef.current;
    if (!box) return next;
    const minX = box.x;
    const minY = box.y;
    const maxX = box.x + box.w;
    const maxY = box.y + box.h;

    let { x, y, w, h } = next;

    // Clamp into image box first, then enforce minimum size by pushing the
    // moving corner back toward the opposite fixed corner.
    if (corner === "tl") {
      const right = x + w;
      const bottom = y + h;
      x = Math.max(minX, Math.min(x, right - MIN_CROP));
      y = Math.max(minY, Math.min(y, bottom - MIN_CROP));
      w = right - x;
      h = bottom - y;
    } else if (corner === "tr") {
      const left = x;
      const bottom = y + h;
      const right = Math.min(maxX, Math.max(x + w, left + MIN_CROP));
      y = Math.max(minY, Math.min(y, bottom - MIN_CROP));
      w = right - left;
      h = bottom - y;
    } else if (corner === "bl") {
      const right = x + w;
      const top = y;
      x = Math.max(minX, Math.min(x, right - MIN_CROP));
      const bottom = Math.min(maxY, Math.max(y + h, top + MIN_CROP));
      w = right - x;
      h = bottom - top;
    } else {
      const left = x;
      const top = y;
      const right = Math.min(maxX, Math.max(x + w, left + MIN_CROP));
      const bottom = Math.min(maxY, Math.max(y + h, top + MIN_CROP));
      w = right - left;
      h = bottom - top;
    }

    return { x, y, w, h };
  };

  // PanResponders — one per corner. `dx`/`dy` from PanResponder are cumulative
  // distances from grant, so we capture the rect at grant time into
  // `startRef` and apply deltas to that snapshot each move. Without this the
  // rect drifts because rectRef.current is continuously updated by setRect.
  const startRef = useRef<Rect | null>(null);
  const makeCornerResponder = (
    corner: "tl" | "tr" | "bl" | "br",
  ): PanResponderInstance =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current = rectRef.current ? { ...rectRef.current } : null;
        if (Platform.OS !== "web") {
          Haptics.selectionAsync().catch(() => {});
        }
      },
      onPanResponderMove: (_e, gesture) => {
        const start = startRef.current;
        if (!start) return;
        const { dx, dy } = gesture;
        let draft: Rect = { ...start };
        if (corner === "tl") {
          draft = { x: start.x + dx, y: start.y + dy, w: start.w - dx, h: start.h - dy };
        } else if (corner === "tr") {
          draft = { x: start.x, y: start.y + dy, w: start.w + dx, h: start.h - dy };
        } else if (corner === "bl") {
          draft = { x: start.x + dx, y: start.y, w: start.w - dx, h: start.h + dy };
        } else {
          draft = { x: start.x, y: start.y, w: start.w + dx, h: start.h + dy };
        }
        setRect(clampCorner(draft, corner));
      },
      onPanResponderRelease: () => {
        startRef.current = null;
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      },
      onPanResponderTerminate: () => {
        startRef.current = null;
      },
    });

  // Use refs so responders stay stable across renders — a fresh responder on
  // every state update would mean PanResponder re-binds mid-drag and the
  // gesture loses its grant. useMemo-free, React Compiler handles it.
  const respondersRef = useRef<{
    tl: PanResponderInstance;
    tr: PanResponderInstance;
    bl: PanResponderInstance;
    br: PanResponderInstance;
  } | null>(null);
  if (!respondersRef.current) {
    respondersRef.current = {
      tl: makeCornerResponder("tl"),
      tr: makeCornerResponder("tr"),
      bl: makeCornerResponder("bl"),
      br: makeCornerResponder("br"),
    };
  }
  const { tl: tlResponder, tr: trResponder, bl: blResponder, br: brResponder } =
    respondersRef.current;

  const handleConfirm = async () => {
    if (!uri || !rect || !imageBox || !natural) return;
    setIsProcessing(true);
    try {
      // Display-space rect → natural-image-space rect.
      const scale = natural.w / imageBox.w; // uniform (contain-fit)
      const cropNat = {
        originX: Math.max(0, Math.round((rect.x - imageBox.x) * scale)),
        originY: Math.max(0, Math.round((rect.y - imageBox.y) * scale)),
        width: Math.min(
          natural.w,
          Math.max(1, Math.round(rect.w * scale)),
        ),
        height: Math.min(
          natural.h,
          Math.max(1, Math.round(rect.h * scale)),
        ),
      };

      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: cropNat }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG },
      );
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {},
        );
      }
      onDone(result.uri);
    } catch {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
          () => {},
        );
      }
      setIsProcessing(false);
    }
  };

  const visible = !!uri;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {/* Top bar */}
        <View
          style={{
            height: 56,
            paddingTop: Platform.OS === "ios" ? 8 : 0,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            marginTop: 44, // rough status-bar inset; backdrop is black anyway
          }}
        >
          <View style={{ flex: 1, alignItems: "flex-start" }}>
            <Pressable
              onPress={onCancel}
              disabled={isProcessing}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("common.cancel")}
              style={({ pressed }) => ({
                paddingHorizontal: 8,
                paddingVertical: 6,
                opacity: isProcessing ? 0.4 : pressed ? 0.5 : 1,
              })}
            >
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "400" }}>
                {t("common.cancel")}
              </Text>
            </Pressable>
          </View>
          <View style={{ flex: 2, alignItems: "center" }}>
            <Text
              style={{ color: "#fff", fontSize: 17, fontWeight: "600", letterSpacing: -0.3 }}
              numberOfLines={1}
            >
              {t("crop.title")}
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Pressable
              onPress={handleConfirm}
              disabled={isProcessing || !rect || loadError}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t("crop.confirm")}
              accessibilityState={{ disabled: isProcessing || !rect || loadError }}
              style={({ pressed }) => ({
                paddingHorizontal: 8,
                paddingVertical: 6,
                opacity: isProcessing || !rect || loadError ? 0.35 : pressed ? 0.5 : 1,
              })}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={{ color: colors.primary, fontSize: 17, fontWeight: "600" }}>
                  {t("crop.confirm")}
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Image + crop rect */}
        <View
          style={{ flex: 1, position: "relative" }}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setContainer({ w: width, h: height });
          }}
        >
          {loadError ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
              <Text style={{ color: "#fff", fontSize: 15, textAlign: "center" }}>
                {t("crop.loadFailed")}
              </Text>
            </View>
          ) : uri && imageBox ? (
            <>
              <Image
                source={{ uri }}
                style={{
                  position: "absolute",
                  left: imageBox.x,
                  top: imageBox.y,
                  width: imageBox.w,
                  height: imageBox.h,
                }}
                resizeMode="contain"
              />

              {rect && (
                <>
                  {/* Dimming masks around crop rect */}
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      right: 0,
                      height: rect.y,
                      backgroundColor: "rgba(0,0,0,0.55)",
                    }}
                  />
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: 0,
                      top: rect.y,
                      width: rect.x,
                      height: rect.h,
                      backgroundColor: "rgba(0,0,0,0.55)",
                    }}
                  />
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: rect.x + rect.w,
                      top: rect.y,
                      right: 0,
                      height: rect.h,
                      backgroundColor: "rgba(0,0,0,0.55)",
                    }}
                  />
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: 0,
                      top: rect.y + rect.h,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.55)",
                    }}
                  />

                  {/* Crop rect border */}
                  <View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      left: rect.x,
                      top: rect.y,
                      width: rect.w,
                      height: rect.h,
                      borderWidth: 1.5,
                      borderColor: "rgba(255,255,255,0.95)",
                    }}
                  />

                  {/* Corner handles — 44pt tappable, 22pt visual */}
                  <CornerHandle
                    style={{
                      left: rect.x - HANDLE_HIT / 2,
                      top: rect.y - HANDLE_HIT / 2,
                    }}
                    responder={tlResponder}
                  />
                  <CornerHandle
                    style={{
                      left: rect.x + rect.w - HANDLE_HIT / 2,
                      top: rect.y - HANDLE_HIT / 2,
                    }}
                    responder={trResponder}
                  />
                  <CornerHandle
                    style={{
                      left: rect.x - HANDLE_HIT / 2,
                      top: rect.y + rect.h - HANDLE_HIT / 2,
                    }}
                    responder={blResponder}
                  />
                  <CornerHandle
                    style={{
                      left: rect.x + rect.w - HANDLE_HIT / 2,
                      top: rect.y + rect.h - HANDLE_HIT / 2,
                    }}
                    responder={brResponder}
                  />
                </>
              )}
            </>
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </View>

        {/* Bottom hint */}
        <View style={{ paddingHorizontal: 24, paddingVertical: 20, paddingBottom: 36 }}>
          <Text
            style={{
              color: "rgba(255,255,255,0.75)",
              fontSize: 13,
              textAlign: "center",
              lineHeight: 18,
            }}
          >
            {t("crop.hint")}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function CornerHandle({
  style,
  responder,
}: {
  style: { left: number; top: number };
  responder: PanResponderInstance;
}) {
  return (
    <View
      {...responder.panHandlers}
      style={{
        position: "absolute",
        left: style.left,
        top: style.top,
        width: HANDLE_HIT,
        height: HANDLE_HIT,
        alignItems: "center",
        justifyContent: "center",
      }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Crop corner"
    >
      <View
        style={{
          width: HANDLE_VISUAL,
          height: HANDLE_VISUAL,
          borderRadius: HANDLE_VISUAL / 2,
          backgroundColor: "#fff",
          // Subtle ring so the handle reads against both dark + light page areas.
          borderWidth: 2,
          borderColor: "rgba(0,0,0,0.25)",
        }}
      />
    </View>
  );
}
