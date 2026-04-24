# PALIMPS — App Icon

Final V1 icon, production-ready for iOS.

## Paket içeriği

```
palimps-icons/
├── palimps-icon.svg           ← master kaynak (font bağımlılığı yok)
├── expo/
│   └── icon.png               ← Expo için tek dosya (1024×1024)
└── AppIcon.appiconset/
    ├── Contents.json          ← Xcode asset catalog
    ├── icon-40.png            (20pt @2x — notification)
    ├── icon-58.png            (29pt @2x — settings)
    ├── icon-60.png            (20pt @3x — notification)
    ├── icon-80.png            (40pt @2x — spotlight)
    ├── icon-87.png            (29pt @3x — settings)
    ├── icon-120.png           (40pt @3x + 60pt @2x)
    ├── icon-180.png           (60pt @3x — home screen)
    └── icon-1024.png          (App Store marketing)
```

---

## Kurulum — Expo (önerilen, PALIMPS için)

Expo'da tek bir 1024×1024 PNG yeterli. EAS Build tüm boyutları kendisi üretir.

**1.** `expo/icon.png` dosyasını projenin `assets/` klasörüne kopyala:

```bash
cp expo/icon.png /path/to/palimps-app/assets/icon.png
```

**2.** `app.json` (veya `app.config.js`) içinde icon yolu zaten `./assets/icon.png` ise ekstra bir şey gerekmez. Eğer farklıysa şöyle olmalı:

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "ios": {
      "icon": "./assets/icon.png"
    }
  }
}
```

**3.** Değişikliği görmek için:

```bash
# Development build için
npx expo prebuild --clean

# Production build için
eas build --platform ios
```

**Not:** Expo Go ile çalışan geliştirme modunda icon güncellemesi anlık yansımaz; prebuild veya EAS Build gerekir.

---

## Kurulum — Native Xcode (prebuild sonrası)

Eğer `expo prebuild` yapılmışsa veya native iOS projeden çalışıyorsan:

**1.** Xcode'da projeni aç.

**2.** `ios/PALIMPS/Images.xcassets/` içindeki mevcut `AppIcon.appiconset` klasörünü sil.

**3.** Bu paketteki `AppIcon.appiconset/` klasörünü aynı yere kopyala.

**4.** Xcode'u kapatıp açtığında asset catalog'u okuyacak. Project navigator'da `AppIcon` üzerine tıklayıp tüm boyutların göründüğünü doğrula.

**5.** Clean build: `Cmd+Shift+K`, sonra `Cmd+R`.

---

## App Store Connect için

App Store'a yüklerken doğrudan `AppIcon.appiconset/icon-1024.png` dosyasını kullan.

- **Boyut:** 1024×1024 ✓
- **Alpha channel:** yok ✓
- **Format:** PNG ✓

---

## Boyut ayarı gerekirse

Yeni bir boyut (iPad, watchOS, macOS) lazım olursa `palimps-icon.svg` dosyasından istenen boyuta export edilebilir. SVG'de font bağımlılığı yok — P outlined path olarak gömülü, her platformda aynı render.

ImageMagick ile örnek:

```bash
# Herhangi bir boyut için
magick convert -background none -density 300 palimps-icon.svg \
  -resize 1024x1024 palimps-icon-1024.png
```

Veya `cairosvg` ile:

```python
import cairosvg
cairosvg.svg2png(
    url="palimps-icon.svg",
    write_to="palimps-icon-XXXX.png",
    output_width=XXXX,
    output_height=XXXX,
)
```

---

## Teknik detaylar

- **Renk paleti:** `#6B4CDB` primary (FAB ile aynı), `#4A2C9E` deep (P harfi), `#B39DDD` light (fold corner), krem kağıt tonları.
- **Gradient:** üst `#7A5EE5` → alt `#5C3BCC` (FAB etrafında doğal ışık hissi).
- **Tipografi:** Linux Libertine Semibold — outlined SVG path olarak gömülü. Runtime font bağımlılığı yok.
- **Kompozisyon:** Üç sayfa (−9°, −2°, +5°) üst üste, üst sayfada P kitap kapağı olarak. Palimpsest metaforu.
- **iOS maske:** iOS squircle maskesini kendisi uygular. PNG'ler flat kare, doğru.
