# PALIMPS — Brand & Icon Brief

> **Bu dosyanın amacı:** Cowork, Claude Code veya başka bir AI agent'e PALIMPS'in görsel kimliğini hızla anlatmak. Bir agent bu dosyayı okuyup ikon veya marka kararları verebilmeli.

---

## 1. Ürün özeti (bir paragraf)

PALIMPS, iOS için bir okuma hafızası uygulamasıdır. Kullanıcı okuduğu kitapların sayfalarını fotoğraflayıp cümle seçerek "an" olarak kaydeder, her kitap kendi içinde yaşayan bir kütüphane olur. Aesthetic ruhu üç referansın kesişimidir: **Linear** (hız ve kısıtlama), **Storytel** (sıcaklık ve kitap sevgisi), **Supercell / Clash Royale** (doğru anlarda cila). Codebase React Native + Expo.

---

## 2. Renk paleti (kesin hex değerler)

Bu paleti ekran görüntülerinden okundu, uygulamada kullanılan gerçek değerler:

| Rol | Hex | Kullanım |
|---|---|---|
| **Primary violet** | `#6B4CDB` | FAB, aktif tab, primary butonlar |
| **Deep violet** | `#4A2C9E` | "PALIMPS" wordmark koyu kısmı, ikon içindeki P harfi |
| **Light lavender** | `#B39DDD` | Wordmark açık kısmı, ikon fold corner, vurgular |
| **App background** | `#EDE6F5` | Uygulama zemini |
| **Pale lavender** | `#D9CCF0` | Surface / kart arka planı |
| **Foreground** | `#1F1530` | Koyu metin |
| **Muted** | `#7A6E90` | İkincil metin |

**Kağıt tonları** (ikon içinde kullanılır):
- `#FBF3DF` — en üst sayfa (kapak)
- `#F0E7D1` — orta sayfa
- `#E4D9BF` — arka sayfa

**Gradient (ikon zemini):** üst `#7A5EE5` → alt `#5C3BCC` (FAB'ın etrafında doğal ışık etkisi).

**Önemli kural:** Saf siyah (`#000`) ve saf beyaz (`#FFF`) kullanılmaz. Foreground `#1F1530`, background `#EDE6F5`. Uygulama tipografisi sans-serif (SF); ikondaki P serif — bu bilinçli bir kontrast.

---

## 3. İkon — ne, neden, nasıl

### Konsept: "katmanlı sayfalar + kapak olarak P"

Üç sayfa üst üste kaydırılmış (−9°, −2°, +5°), en üstteki sayfada kitap kapağı gibi büyük bir serif P harfi. Sağ üst köşede lavanta kıvrılmış köşe ("okunan yer" işareti).

**Kavram:** "Palimpsest" — üst üste yazılmış sayfa. Her okumanın bıraktığı iz. P harfi üst sayfanın içeriği, yani "kapak" gibi okunur — ayrı bir öğe değil.

### Görsel spec

- **Format:** 1024×1024, flat square (iOS squircle maskesini kendisi uygular — SVG'de maske YOK)
- **Tipografi:** Linux Libertine Semibold (New York'a en yakın açık kaynak serif). İkonda **outlined path olarak gömülü**, runtime font bağımlılığı yok.
- **Shadow:** Sayfalar arası yumuşak gölge (blur 4, offset y:3, alpha 0.18)
- **Alpha channel:** App Store 1024 PNG'sinde olmamalı (iOS reddeder)

### Kararların gerekçesi (değiştirmeden önce oku)

1. **Neden üç sayfa?** Palimpsest metaforu literal. Tek sayfa kavramı kaybeder; dört sayfa ise 48×48'de çamurlaşır.
2. **Neden serif P, app sans-serif iken?** İkon bir "nesne" — kitap kapağı. App içindeki sans-serif UI ile kasıtlı kontrast. Kapağı bir kitabın sırtı gibi okutur.
3. **Neden amber değil lavanta?** İlk denemede amber `#E8913A` vardı. App paletinde amber **hiç yok** — morun soğukluğunu dengelese de uygulamaya yabancı düşüyordu. Lavanta `#B39DDD` app paletinden.
4. **Neden `#6B4CDB` zemin, `#4A2C9E` değil?** Zemin FAB'ın kendisi olan rengi. İkon açılıp uygulama yüklenirken FAB aynı tonda — süreksiz geçiş yok, profesyonel his.
5. **Neden gradient `#7A5EE5` → `#5C3BCC`?** Flat `#6B4CDB` donuk duruyor. Üst açık / alt koyu hafif ışık hissi verir; iOS ikon estetiğinde standart pratik (Apple'ın Photos, Maps ikonlarına bak).

### Reddedilen alternatifler

- **V2 Deep (tamamen `#4A2C9E` zemin):** Daha ciddi ama FAB ile tonal kopukluk.
- **V3 Gradient (tam mor spektrumu):** 48×48'de çamurlaşıyor; 2020'ler hissi.
- **V4 Lavanta zemin:** Zarif ama açık iOS duvar kağıtlarında kayboluyor.
- **Amber fold corner:** App paletinde yok, yabancı duruyor.
- **Sans-serif P:** App ile "fazla" tutarlı, ikon kendi kimliğini kurmuyor.

---

## 4. Dosya yerleşimi

```
palimps-app/
├── assets/
│   └── icon.png                      ← Expo'nun kullandığı (1024×1024)
├── design/
│   └── brand/
│       ├── BRAND.md                  ← bu dosya
│       ├── palimps-icon.svg          ← master kaynak
│       └── AppIcon.appiconset/       ← native Xcode için yedek
└── ios/PALIMPS/Images.xcassets/
    └── AppIcon.appiconset/           ← expo prebuild sonrası buraya kopyalanır
```

---

## 5. Agent komutları

### Yeni bir boyut lazımsa

Master SVG'den export:

```bash
python3 -c "
import cairosvg
cairosvg.svg2png(
    url='design/brand/palimps-icon.svg',
    write_to='design/brand/palimps-icon-SIZE.png',
    output_width=SIZE, output_height=SIZE
)
"
```

Ya da ImageMagick:

```bash
magick convert -background none -density 300 \
  design/brand/palimps-icon.svg \
  -resize SIZExSIZE design/brand/palimps-icon-SIZE.png
```

### İkonu uygulamaya uygulamak (Expo)

```bash
cp design/brand/palimps-icon.svg design/brand/palimps-icon.svg  # master dokunulmaz
# 1024 PNG'yi assets/icon.png olarak yerleştir
python3 -c "
import cairosvg
cairosvg.svg2png(
    url='design/brand/palimps-icon.svg',
    write_to='assets/icon.png',
    output_width=1024, output_height=1024
)
"

# app.json'da icon yolu doğru olmalı:
# "icon": "./assets/icon.png"

# Build
npx expo prebuild --clean
# veya production için:
eas build --platform ios
```

### İkonu native Xcode'a uygulamak

`expo prebuild` sonrası `ios/` klasörü oluştuktan sonra:

```bash
rm -rf ios/PALIMPS/Images.xcassets/AppIcon.appiconset
cp -r design/brand/AppIcon.appiconset ios/PALIMPS/Images.xcassets/
```

Sonra Xcode'u aç, clean build (`Cmd+Shift+K`), run (`Cmd+R`).

### App Store Connect'e yükleme

Doğrudan `design/brand/AppIcon.appiconset/icon-1024.png` dosyasını yükle.
- Alpha channel yok ✓
- 1024×1024 ✓
- PNG ✓

---

## 6. Değişiklik yapmaya karar verirken

**Yeşil ışık (yap):**
- Yeni boyut üretmek (master SVG'den export)
- Wordmark için aynı paletten yeni bir varyant çıkarmak (ör. social media kapak görseli)
- Koyu mod varyantı denemek (zaten mor zemin olduğu için çok değişmiyor ama gerekirse)

**Sarı ışık (önce düşün, gerekçesi varsa yap):**
- P'nin tipografik ağırlığını değiştirmek (şu an Semibold — ince çok zayıf, bold çok ağır kalır)
- Sayfa rotasyon açılarını değiştirmek (−9/−2/+5 şu an kompozisyonel denge; değişirse yeniden kalibre lazım)
- Gradient yerine flat zemin (daha iOS native hisseder ama biraz karakter kaybeder)

**Kırmızı ışık (yapma):**
- Amber veya turuncu eklemek → palet dışı
- Emoji veya ikonografi eklemek → kalabalıklaşır, Apple ikonografisi pratiğine aykırı
- Saf beyaz kağıt (`#FFF`) → PALIMPS sıcak off-white kullanır, asla saf beyaz
- P yerine başka harf/şekil koymak → "PALIMPS" wordmark'ı ile bağ kopar
- iOS squircle maskesini SVG'ye gömmek → iOS kendisi uygular, çifte maske bozulma yaratır

---

## 7. Hızlı referans — sık sorulan sorular

**S: Dark mode icon lazım mı?**
C: iOS 18+ ikonlar için üç mod destekliyor (light/dark/tinted). Şu an tek mod yeterli — zemin mor olduğu için dark mode'da da iyi duruyor. Gerekirse sonra eklenebilir; o zaman zemin `#5C3BCC` → `#3A1E7A` daha koyu ton olur.

**S: Apple Watch / iPad boyutları?**
C: Şu an sadece iPhone. Lazım olursa master SVG'den export edilir (Watch: 1024, 216, 172, 108, 87, 80, 58; iPad: 152, 167).

**S: Adaptive icon (Android) için?**
C: PALIMPS iOS-only şu an. Android'e geçerse ayrı bir adaptive icon çıkarılır (foreground + background katmanları); bu master SVG direkt kullanılamaz.

**S: Wordmark nasıl?**
C: Bu paket sadece app icon. Wordmark için palimps.app üzerinde kullanılan tipografi referans alınır (şu an bakılarak doğrulanmadı — gerekirse ayrı bir brief yazılır).

---

**Son not:** Bu brief'i güncellediğinde tarihli versiyonlamak iyi olur. Şu an: **v1.0 — 2026-04-20.**
