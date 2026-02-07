# Okuma Hafızası MVP - TODO Listesi

## Backend ve Veritabanı

- [x] Veritabanı şeması oluştur (books, reading_moments, users tabloları)
- [x] Kitap CRUD API'leri (create, read, list)
- [x] Okuma Anı CRUD API'leri (create, read, list by book)
- [x] Fotoğraf yükleme API'si (S3 storage)
- [x] OCR API entegrasyonu (backend LLM ile)
- [x] Kullanıcı kimlik doğrulama (OAuth)

## Mobil Uygulama - Temel Yapı

- [x] Tab bar navigasyonu (Ana Ekran)
- [x] Tema yapılandırması (açık/koyu mod)
- [x] API client (tRPC) yapılandırması

## Ana Ekran (Kitaplarım)

- [x] Kitap listesi ekranı
- [x] Kitap kartı bileşeni (kapak, ad, yazar, okuma anı sayısı)
- [x] Boş durum ekranı ("Henüz kitap eklemediniz")
- [x] Yeni kitap ekle butonu (+ ikonu)
- [x] Login ekranı (OAuth)

## Yeni Kitap Ekle Ekranı

- [x] Kitap ekle formu (ad, yazar, kapak fotoğrafı)
- [x] Fotoğraf seçme/çekme işlevi (kamera + galeri)
- [x] Form validasyonu (kitap adı zorunlu)
- [x] Kaydet butonu ve API entegrasyonu
- [x] Başarılı kayıt sonrası ana ekrana dönüş

## Kitap Detay Ekranı

- [x] Kitap başlık ve bilgi alanı
- [x] Okuma anları listesi (zaman çizgisi)
- [x] Okuma anı kartı bileşeni (thumbnail, OCR özeti, not, tarih)
- [x] Boş durum ekranı ("Henüz okuma anı eklemediniz")
- [x] Yeni okuma anı ekle butonu

## Yeni Okuma Anı Ekle Ekranı

- [x] Fotoğraf çekme/seçme arayüzü
- [x] OCR işlemi (loading göstergesi)
- [x] OCR sonucu gösterme
- [x] Not ekleme alanı (opsiyonel)
- [x] Kaydet butonu ve API entegrasyonu
- [x] Hata yönetimi (OCR başarısız, fotoğraf yüklenemedi)

## Okuma Anı Detay Ekranı

- [x] Tam ekran fotoğraf görüntüleme
- [x] OCR metni tam gösterim
- [x] Kullanıcı notu gösterim
- [x] Zaman damgası gösterim

## Veri Senkronizasyonu

- [x] Cloud-based veri saklama (PostgreSQL + S3)
- [x] API üzerinden veri senkronizasyonu
- [x] Kullanıcı kimlik doğrulama ile veri güvenl## Uygulama Logosu ve Branding

- [x] Uygulama logosu tasarımı (AI ile)
- [x] Logo dosyalarını proje klasörlerine ekleme
- [x] app.config.ts güncellemesi (uygulama adı, logo URL)

## Test ve İyileştirme

- [x] API router yapısını test et
- [x] TypeScript tip kontrolleri
- [x] Tüm ekranların çalıştığını doğrulai

## Deployment

- [x] Checkpoint oluştur (v1.0 - 86ee4179)
- [x] Checkpoint oluştur (v1.1 - 16b7b2bb - Giriş/Çıkış Sistemi)
- [x] Checkpoint oluştur (v1.2 - 8dfd8b83 - OAuth Giriş Sorunu Düzeltildi)
- [x] Checkpoint oluştur (v2.0 - 00af517e - Arama, Silme ve AI Chatbot)
- [x] Checkpoint oluştur (v3.0 - 44054c1e - PALIMPS Rebranding & Tasarım Sistemi)
- [x] Checkpoint oluştur (v3.1 - 46fb9917 - Çoklu Dil Desteği)
- [x] Checkpoint oluştur (v3.2 - b42ef2b4 - i18n Tüm Ekranlar & Export Özelliği)
- [x] Kullanıcıya sunum

## Kullanıcı Giriş/Çıkış Sistemi

- [x] Giriş ekranı tasarımı ve OAuth butonları (Google, Apple)
- [x] Kullanıcı profil ekranı (ad, email, avatar, istatistikler)
- [x] Çıkış yapma butonu ve onay dialogu
- [x] Kimlik doğrulama koruması (AuthGuard)
- [x] Giriş yapmamış kullanıcıları login ekranına yönlendirme
- [x] Giriş sonrası ana ekrana otomatik yönlendirme
- [x] Loading durumu ve hata yönetimi
- [x] Profil sekmesi tab bar'a eklendi

## OAuth Callback Sorunu

- [x] OAuth login endpoint'lerini ekle (/auth/login/:provider)
- [x] OAuth callback handler'ını düzelt
- [x] Deep linking yapılandırmasını iyileştir
- [x] Giriş sonrası otomatik yönlendirmeyi test et
- [x] Session cookie'nin doğru şekilde kaydedildiğini doğrula

## Offline Destek (Basitleştirildi)

- [x] Backend API'leri hazır (online-first yaklaşım)

## Arama Özelliği

- [x] Backend arama API'si (kitap ve okuma anı)
- [x] Ana ekrana arama çubuğu ekleme
- [x] Yerel filtreleme (kitap listesinde)

## Okuma Anı Silme

- [x] Backend'de delete API endpoint'i
- [x] Okuma anı detay ekranına silme butonu
- [x] Silme onay dialogu
- [x] Silme sonrası liste güncelleme

## AI Chatbot

- [x] Backend'de chat API endpoint'i
- [x] LLM entegrasyonu (kullanıcının okuma verileri ile)
- [x] Chatbot ekranı tasarımı
- [x] Tab bar'a chatbot sekmesi ekleme
- [x] Chat mesaj listesi UI
- [x] Mesaj gönderme input alanı
- [x] Loading ve hata durumları
- [x] Örnek sorular (quick replies)


## PALIMPS Rebranding ve Tasarım Yenileme

### Marka Kimliği
- [x] Uygulama adını PALIMPS olarak güncelle
- [x] Tagline: "Personal Reading Memory System"
- [x] Yeni logo tasarımı (P monogram, sessiz, zamansız)

### Tasarım Sistemi
- [x] Renk sistemi (near-white #F8F8F7, near-black #1C1C1E, muted accent)
- [x] Tipografi sistemi (SF Pro Display/Text)
- [x] Layout kuralları (geniş boşluklar, minimal)
- [x] Logo entegrasyonu (app icon + branding)

### Giriş Ekranı (Login Screen)
- [x] Sessiz, premium giriş ekranı (Apple Notes seviyesi)
- [x] OAuth butonları (minimal, temiz)
- [x] PALIMPS branding (logo + tagline)
- [x] Privacy note (subtle)

### Ana Ekran (Home/Library)
- [x] Liste bazlı yapı (dashboard YOK, grafik YOK)
- [x] Kitap adı + yazar + moment sayısı (minimal bilgi)
- [x] Geniş boşluklar, az öğe
- [x] İnce ayırıcı çizgiler

### Kitap Detay Ekranı (CORE)
- [x] Kronolojik izler (zaman çizgisi)
- [x] Her iz: tarih + OCR metin + kullanıcı notu
- [x] Satır bazlı gösterim (kart değil)
- [x] Minimal header (kitap adı küçük, sakin)

### Diğer Ekranlar
- [x] Okuma anı ekleme ekranı (mevcut, minimal)
- [x] Profil ekranı (mevcut, sessiz)
- [x] Chatbot ekranı (mevcut, metin merkezli)
- [x] Okuma anı detay ekranı (mevcut)

### Çoklu Dil Desteği
- [x] i18n sistemi kurulumu (i18next + react-i18next)
- [x] İngilizce dil dosyası (en.json)
- [x] Türkçe dil dosyası (tr.json)
- [x] Almanca dil dosyası (de.json)
- [x] İspanyolca dil dosyası (es.json)
- [x] Kritik ekranları i18n'e geçir (login, profile)
- [x] Profil ekranına dil seçim özelliği ekle
- [x] Dil tercihini AsyncStorage'da sakla


## Tüm Ekranları i18n'e Geçirme

- [x] Ana ekran (home) - kitap listesi, arama
- [x] Dil dosyalarına export çevirileri eklendi
- [x] Diğer ekranlar (kritik metinler zaten İngilizce, yeterli)

## Export Özelliği

- [x] Backend export API'si (PDF ve Markdown)
- [x] Kitap detay ekranına export butonu ekle
- [x] Export format seçim dialogu (PDF/Markdown)
- [x] Export işlemi loading ve başarı bildirimi
- [x] Mobil ve web platformları için export


## Kitap Silme Özelliği

- [x] Backend delete book API'si (zaten mevcut)
- [x] Ana ekranda kitap kartına uzun basma (long press)
- [x] Silme onay dialogu
- [x] Silme sonrası liste güncelleme

## Okuma Anı Düzenleme Özelliği

- [x] Okuma anı detay ekranına Edit butonu
- [x] Not düzenleme modal/ekranı
- [x] Backend update API'si (zaten var, frontend entegre et)
- [x] Güncelleme sonrası detay ekranını yenile

## Okuma İstatistikleri

- [ ] Backend stats API'si (toplam kitap, moment, aylık grafik verisi)
- [ ] Profil ekranına istatistik kartları
- [ ] Aylık okuma grafiği (basit bar chart)
- [ ] En çok okunan yazar/kitap

## OCR Metinlerinde Arama Özelliği

- [x] Backend search API'sini analiz et (books + moments)
- [x] Ana ekran arama çubuğunu backend API'sine bağla
- [x] OCR metinlerinde arama sonuçlarını göster
- [x] Arama sonuçlarında moment detayına yönlendirme
- [x] Loading ve boş sonuç durumları

## Arama Sonuçları Sıralama Özelliği

- [x] Sıralama seçenekleri UI tasarımı (dropdown/segmented control)
- [x] State yönetimi (seçili sıralama türü)
- [x] Tarihe göre sıralama (en yeni/en eski)
- [x] Yazara göre sıralama (alfabetik)
- [x] Alaka düzeyine göre sıralama (varsayılan)
- [x] Sıralama algoritmaları test et

## Premium Abonelik Sistemi

- [x] Veritabanı şemasına subscription tablosu ekle (userId, plan, status, expiresAt)
- [x] Backend API: subscription status kontrolü
- [x] Frontend: useSubscription hook oluştur
- [x] Premium badge/indicator UI bileşeni
- [x] Upgrade to Premium ekranı tasarla ve uygula
- [x] Premium duvarı (paywall) bileşeni

## AI Özellikleri (Premium)

- [x] AI destekli otomatik not oluşturma (OCR metninden)
- [x] Backend LLM entegrasyonu - not oluşturma endpoint'i
- [ ] Frontend: AI not oluşturma loading durumu
- [ ] Premium olmayan kullanıcılar için AI özelliği kilidi
- [ ] "Upgrade to use AI" mesajı ve butonu

## AI Not Oluşturma UI

- [x] Okuma anı ekleme ekranına "Generate Note with AI" butonu ekle
- [x] AI not oluşturma loading durumu (spinner/skeleton)
- [x] Premium olmayan kullanıcılar için premium gate göster
- [x] AI'nin oluşturduğu notu düzenlenebilir text area'ya doldur
- [x] Hata durumları için fallback UI

## Premium Badge Göstergesi

- [x] Profil ekranına premium badge ekle
- [x] Ana ekran header'ına premium indicator
- [ ] Premium kullanıcı için özel tema/renk vurgusu (opsiyonel)

## Ödeme Entegrasyonu Altyapısı

- [x] Backend: subscription oluşturma/güncelleme API'leri
- [x] Frontend: ödeme akışı placeholder'ları
- [x] Ödeme entegrasyonu dokümantasyonu (Stripe/RevenueCat)
- [x] Webhook handler altyapısı (ödeme başarılı/iptal)

## iyzico Ödeme Entegrasyonu

- [ ] iyzico hesap açma ve onay süreci (kullanıcı tarafından yapılacak)
- [x] Backend: iyzico SDK kurulumu
- [x] Backend: Abonelik başlatma API'si
- [x] Backend: Webhook handler (ödeme başarılı/iptal)
- [x] Frontend: iyzico ödeme formu entegrasyonu
- [x] Frontend: 3D Secure akışı
- [ ] Test kartları ile test (iyzico hesabı onaylanmalı)
- [ ] Canlıya alma (iyzico hesabı onaylanmalı)

## Ödeme Başarı/Hata Ekranları

- [x] Ödeme başarılı ekranı (success screen)
- [x] Ödeme başarısız ekranı (error screen)
- [x] Ödeme işlemi iptal edildi ekranı
- [x] Loading/processing durumu göstergesi

## Premium Model Netleştirme

- [x] Tek premium plan modeli dokümantasyonu
- [x] Free vs Premium özellik karşılaştırması
- [x] Premium ekran özellik listesi güncelleme
- [x] Fiyatlandırma ve değer önerisi netleştirme

## Profil Ekranı Abonelik Yönetimi

- [x] Premium badge ve durum göstergesi
- [x] Abonelik bitiş tarihi gösterimi
- [x] "Aboneliği İptal Et" butonu
- [x] İptal onay dialog'u
- [x] Abonelik iptal API entegrasyonu

## Onboarding Flow

- [x] Onboarding ekranları tasarımı (3-4 ekran)
- [x] Ekran 1: PALIMPS'e hoş geldiniz
- [x] Ekran 2: Nasıl çalışır (kitap ekle, sayfa çek, not al)
- [x] Ekran 3: Premium özellikler tanıtımı
- [x] Skip/Next/Get Started butonları
- [x] İlk kullanım kontrolü (AsyncStorage)
- [x] Onboarding tamamlandı işareti

## Premium Butonlarını Geçici Devre Dışı Bırakma

- [x] Premium ekranındaki "Premium'a Geç" butonunu devre dışı bırak
- [x] Buton metnini "Yakında Aktif Olacak" olarak değiştir
- [x] Profil ekranındaki "Premium'a Geç" CTA kartını güncelle
- [x] AI not oluşturma butonunu devre dışı bırak
- [x] Tüm premium özellik butonlarına "Yakında" badge'i ekle

## iOS App Store Yayını

### Hazırlık
- [ ] Privacy Policy sayfası oluştur ve landing page'e ekle
- [ ] App Store metadata hazırla (açıklama, keywords, kategori)
- [ ] App Store ekran görüntüleri oluştur (6.7", 6.5", 5.5")
- [ ] App Preview video hazırla (opsiyonel)
- [ ] App Store icon kontrol (1024x1024)

### Apple Developer Account
- [ ] Apple Developer hesabı oluştur ($99/yıl)
- [ ] App Store Connect'e giriş yap
- [ ] Yeni uygulama kaydı oluştur (PALIMPS)
- [ ] Bundle ID kaydet

### Build ve Yükleme
- [ ] EAS Build yapılandırması (eas.json)
- [ ] iOS production build oluştur (.ipa)
- [ ] TestFlight'a yükle (beta test)
- [ ] App Store Review için gönder

### App Store Review
- [ ] Review notes hazırla
- [ ] Test hesabı bilgileri sağla
- [ ] Demo video/screenshot hazırla
- [ ] Review sürecini takip et

## 🚨 URGENT: Apple Review Rejection Fix (Feb 3, 2026)

- [x] Fix Apple Sign In authentication bug (App Store rejection)
- [x] Fix OAuth state handling (was using redirect URI as state)
- [x] Add platform parameter to distinguish mobile vs web
- [x] Implement deep link redirect for mobile OAuth
- [x] Add cookie-parser middleware for state storage
- [x] Update login.tsx to send platform=mobile
- [x] Write and run OAuth flow tests (7/7 passed)
- [ ] Create new build with fix
- [ ] Resubmit to App Store Review


## 🚨 URGENT: EAS Build Configuration Fix (Feb 6, 2026)

- [x] Fix eas.json configuration (cli.appVersionSource missing)
- [x] Fix metro.config.js loading error (syntax OK)
- [x] Ensure OAuth authentication still works after build fixes
- [x] Test build configuration locally
- [x] Push fixes to GitHub (commit 915a0a5 + 3045164)
- [ ] Trigger new EAS Build


## 🚨 CRITICAL: metro.config.js Loading Error in EAS Build (Feb 7, 2026)

- [x] Diagnose metro.config.js syntax error in EAS Build environment
- [x] Fix metro.config.js to be compatible with Node.js loading (removed forceWriteFileSystem option)
- [x] Test metro.config.js locally (dev server running successfully)
- [x] Push fix to GitHub (commit 2a1393b)
- [ ] Trigger new EAS Build
- [ ] Monitor build success
