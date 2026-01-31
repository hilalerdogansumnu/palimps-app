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
#### Test ve İyileştirme

- [x] API router yapısını test et
- [x] TypeScript tip kontrolleri
- [x] Tüm ekranların çalıştığını doğrulai

## Deployment

- [x] Checkpoint oluştur (v1.0 - 86ee4179)
- [x] Checkpoint oluştur (v1.1 - 16b7b2bb - Giriş/Çıkış Sistemi)
- [x] Checkpoint oluştur (v1.2 - 8dfd8b83 - OAuth Giriş Sorunu Düzeltildi)
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
