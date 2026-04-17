# PALIMPS — App Store Connect Metadata

Kopyala/yapıştır için hazır. App Store Connect → My Apps → PALIMPS → App Information + Version 1.0.

---

## 1. App Information (tek seferlik, versiyondan bağımsız)

**Name**
```
PALIMPS
```

**Bundle ID**
```
space.manus.okuma.hafizasi.mvp.t20260130232125
```

**Primary Language**
```
Turkish
```

**Category**
- Primary: **Books**
- Secondary: **Productivity**

**Content Rights**
- "Does your app contain, display, or access third-party content?" → **No**

**Age Rating**
- Tüm kategoriler "None" → **4+**

---

## 2. Pricing and Availability

- **Price**: Free (premium RevenueCat üzerinden in-app)
- **Availability**: All countries (veya sadece Turkey + US ile başla, sonra genişlet)

---

## 3. Localizations — Turkish (Turkey)

**Subtitle** (max 30 karakter)
```
Kitap okuma hafızan
```

**Promotional Text** (max 170 karakter — submit sonrası update edilebilir)
```
Yeni: Sayfa fotoğrafından doğrudan alıntı yakala. Okuduğun her satır, sakin bir kütüphanede seni beklesin.
```

**Description** (max 4000 karakter)
```
Okuduğun her kitap, tek yerde.

PALIMPS; kitaplarını, notlarını ve alıntılarını sakin bir kütüphanede toplar. Her kitabın kendi sayfası, kendi hafızası var.

— Kitap ekle, sayfa fotoğrafı çek, not düş.
— Alıntılarını tek dokunuşla yakala.
— Okuduklarını yıllar sonra bile arayıp bul.

Reklam yok, takip yok. Verin senin kalır.

Premium ile sınırsız kitap, yedekleme ve AI destekli refleksiyonlar.
```

**Keywords** (max 100 karakter, virgülle ayır, boşluk koyma)
```
kitap,okuma,not,alıntı,kütüphane,okuma günlüğü,kitap notu,reading,book journal,highlight
```

**Support URL**
```
https://palimps.app
```

**Marketing URL** (opsiyonel)
```
https://palimps.app
```

---

## 4. Localizations — English (U.S.)

**Subtitle**
```
Your reading memory
```

**Promotional Text**
```
New: Capture quotes straight from a page photo. Every line you read, waiting in a quiet library.
```

**Description**
```
Every book you read, in one quiet library.

PALIMPS gathers your books, notes and highlights in a single place. Each book has its own page, its own memory.

— Add a book, snap a page, write a note.
— Capture highlights with a tap.
— Find what you read, years later.

No ads, no tracking. Your reading stays yours.

Premium unlocks unlimited books, backups and AI-assisted reflections.
```

**Keywords**
```
books,reading,notes,quotes,journal,library,highlights,book tracker,reflection,reading log
```

**Support URL**
```
https://palimps.app
```

---

## 5. App Privacy (App Store Connect → App Privacy)

**Data Collection**: Yes

**Collected Data Types** (hepsi "Linked to You", hiçbiri "Used for Tracking"):
- **Contact Info → Email Address** → App Functionality
- **Contact Info → Name** → App Functionality
- **User Content → Photos or Videos** → App Functionality
- **User Content → Other User Content** (notes, quotes) → App Functionality
- **Identifiers → User ID** → App Functionality

**Tracking**: No

**Privacy Policy URL**
```
https://palimps.app/privacy
```
(⚠️ Bu link canlı ve güncel olmalı — submission öncesi güncellememiz gereken şey.)

---

## 6. Version 1.0 — What's New

İlk versiyon için:
```
İlk sürüm.
```
EN:
```
Initial release.
```

---

## 7. Screenshots

`assets/appstore-screenshots/` klasöründe 5 adet hazır. App Store Connect 6.7" (iPhone 15 Pro Max) ve 6.5" (iPhone 11 Pro Max) istiyor — aynı görselleri ikisine de yükleyebilirsin.

---

## 8. Review Information

**Contact Information**
- First Name: Hilal
- Last Name: Erdoğan Şumnu
- Phone Number: (senin numaran)
- Email: hilalsumnu@gmail.com

**Demo Account**
Apple Sign In kullandığımız için reviewer kendi Apple ID'siyle girer. "Sign-in required" → Yes, ama "Demo account" boş bırakılabilir (reviewer'ın Apple ID'si yeterli). Sadece notes alanına şunu yaz:

```
This app uses "Sign in with Apple" as the sole authentication method (Apple HIG compliant).
The reviewer may sign in with any Apple ID — no demo account is required.

After signing in, the reviewer can:
1. Add a book (title + author, cover optional)
2. Take a photo of a page (camera permission)
3. Add notes or quotes to any book
4. View all books in the library

Premium features (unlimited books, AI reflections) require a RevenueCat subscription.
Sandbox test accounts can be used for purchase testing.

Thank you for reviewing PALIMPS.
```

---

## 9. Build Selection

Build tamamlandığında (EAS Build bitince) TestFlight'a otomatik yüklenecek. App Store Connect → Version → Build bölümünden build 1.0 (50311) seçilecek.

---

## 10. Kontrol Listesi (submit öncesi)

- [ ] 5 screenshot yüklendi (6.7" + 6.5")
- [ ] Description TR + EN yapıştırıldı
- [ ] Keywords TR + EN yapıştırıldı
- [ ] Subtitle TR + EN yapıştırıldı
- [ ] Privacy Policy URL (palimps.app/privacy) CANLI ve güncel
- [ ] App Privacy data types tanımlandı (5 tip)
- [ ] Category: Books (primary), Productivity (secondary)
- [ ] Age rating: 4+
- [ ] Review notes yazıldı
- [ ] Build 1.0 (50311) TestFlight'a yüklendi ve Version'a bağlandı
