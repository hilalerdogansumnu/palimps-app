# Okuma Hafızası MVP - Mobil Uygulama Arayüz Tasarımı

**Tasarım Tarihi:** 31 Ocak 2026
**Platform:** iOS ve Android (Expo React Native)
**Tasarım Felsefesi:** Apple Human Interface Guidelines (HIG) uyumlu, tek elle kullanım, portre yönelim (9:16)

---

## 1. Tasarım İlkeleri

Bu uygulama, basılı kitap okuma deneyimini dijital bir hafıza katmanıyla zenginleştirmek için tasarlanmıştır. Tasarım kararları şu ilkeler etrafında şekillenmiştir:

**Sadelik ve Odaklanma:** Kullanıcı, kitap okurken hızlıca fotoğraf çekip notunu kaydedebilmelidir. Karmaşık formlar veya çok adımlı işlemler yoktur. Her ekran tek bir amaca hizmet eder.

**Kitap Merkezli Mimari:** Tüm veriler kitap etrafında organize edilir. Kullanıcı, kitaplarını görür, bir kitabı seçer ve o kitaba ait tüm okuma anlarını zaman çizgisinde inceler.

**Zaman ve Hafıza:** Her okuma anı bir zaman damgası taşır. Kullanıcı, geçmişe dönüp "bu kitabı nasıl okudum?" sorusuna cevap bulabilir.

**Bağlılık Odaklı:** Kullanıcı, uygulamada ne kadar çok okuma anı biriktirirse, uygulamadan vazgeçmesi o kadar zorlaşır. Bu, organik bir bağlılık yaratır.

---

## 2. Renk Paleti

Uygulama, sakin ve okumaya uygun bir renk paleti kullanır. Tema, hem açık hem de koyu modda kullanıcıya rahat bir deneyim sunar.

| Renk Adı | Açık Mod | Koyu Mod | Kullanım Alanı |
|----------|----------|----------|----------------|
| **Primary** | `#0a7ea4` (Turkuaz Mavi) | `#0a7ea4` | Ana vurgu rengi, butonlar, aktif durumlar |
| **Background** | `#ffffff` (Beyaz) | `#151718` (Koyu Gri) | Ekran arka planı |
| **Surface** | `#f5f5f5` (Açık Gri) | `#1e2022` (Daha Koyu Gri) | Kartlar, yükseltilmiş yüzeyler |
| **Foreground** | `#11181C` (Neredeyse Siyah) | `#ECEDEE` (Açık Gri) | Ana metin rengi |
| **Muted** | `#687076` (Orta Gri) | `#9BA1A6` (Açık Gri) | İkincil metin, alt yazılar |
| **Border** | `#E5E7EB` (Açık Gri) | `#334155` (Koyu Gri) | Kenarlıklar, ayırıcılar |

---

## 3. Ekran Listesi ve İçerikleri

### 3.1. Ana Ekran (Home / Kitaplarım)

**Amaç:** Kullanıcının eklediği tüm kitapları görüntülemesi ve yeni kitap eklemesi.

**İçerik:**
- **Başlık:** "Kitaplarım" (üst kısımda, büyük ve kalın)
- **Kitap Listesi:** Her kitap, bir kart olarak gösterilir. Kart üzerinde:
  - Kitap kapağı (kullanıcı tarafından yüklenen fotoğraf)
  - Kitap adı
  - Yazar adı
  - Okuma anı sayısı (örneğin: "12 okuma anı")
- **Yeni Kitap Ekle Butonu:** Ekranın sağ üst köşesinde "+" ikonu. Tıklandığında "Yeni Kitap Ekle" ekranına gider.
- **Boş Durum:** Eğer hiç kitap yoksa, ekranın ortasında "Henüz kitap eklemediniz. İlk kitabınızı ekleyin!" mesajı ve "Kitap Ekle" butonu.

**Kullanıcı Akışı:**
1. Kullanıcı uygulamayı açar.
2. Kitaplarını görür.
3. Bir kitaba tıkladığında, o kitabın detay ekranına gider.
4. "+" butonuna tıkladığında, yeni kitap ekleme ekranına gider.

---

### 3.2. Yeni Kitap Ekle Ekranı

**Amaç:** Kullanıcının manuel olarak kitap bilgilerini girmesi ve kapak fotoğrafı yüklemesi.

**İçerik:**
- **Başlık:** "Yeni Kitap Ekle"
- **Kapak Fotoğrafı Alanı:** Büyük bir kare alan. Tıklandığında fotoğraf seçme veya çekme seçenekleri açılır.
- **Kitap Adı:** Metin girişi (placeholder: "Kitap adını girin")
- **Yazar Adı:** Metin girişi (placeholder: "Yazar adını girin")
- **Kaydet Butonu:** Ekranın alt kısmında, tam genişlikte, primary renkte buton. Tıklandığında kitap kaydedilir ve ana ekrana dönülür.
- **İptal Butonu:** Üst sol köşede "< Geri" butonu.

**Kullanıcı Akışı:**
1. Kullanıcı "+" butonuna tıklar.
2. Kapak fotoğrafı yükler (galeriden veya kameradan).
3. Kitap adı ve yazar adı girer.
4. "Kaydet" butonuna tıklar.
5. Kitap ana ekranda görünür.

**Hata Yönetimi:**
- Eğer kitap adı boşsa, "Kaydet" butonu pasif olur (opacity: 0.5).
- Kapak fotoğrafı opsiyoneldir. Eğer yüklenmezse, varsayılan bir kitap ikonu gösterilir.

---

### 3.3. Kitap Detay Ekranı

**Amaç:** Kullanıcının bir kitaba ait tüm okuma anlarını zaman çizgisinde görmesi ve yeni okuma anı eklemesi.

**İçerik:**
- **Üst Kısım (Header):**
  - Kitap kapağı (küçük, sol üstte)
  - Kitap adı (büyük, kalın)
  - Yazar adı (küçük, muted renkte)
  - Okuma anı sayısı (örneğin: "12 okuma anı")
- **Yeni Okuma Anı Ekle Butonu:** Ekranın sağ üst köşesinde "+" ikonu veya "Yeni Okuma Anı" butonu. Tıklandığında "Yeni Okuma Anı Ekle" ekranına gider.
- **Okuma Anları Listesi (Zaman Çizgisi):** Her okuma anı, bir kart olarak gösterilir. Kart üzerinde:
  - Sayfa fotoğrafı (küçültülmüş, thumbnail)
  - OCR ile çıkarılmış metin (ilk 2-3 satır, devamı "..." ile kesilir)
  - Kullanıcının notu (varsa, ilk 2 satır)
  - Zaman damgası (örneğin: "2 gün önce", "15 Ocak 2026")
- **Boş Durum:** Eğer hiç okuma anı yoksa, "Henüz okuma anı eklemediniz. İlk okuma anınızı ekleyin!" mesajı ve "Okuma Anı Ekle" butonu.

**Kullanıcı Akışı:**
1. Kullanıcı ana ekranda bir kitaba tıklar.
2. Kitap detay ekranını görür.
3. Tüm okuma anlarını zaman çizgisinde inceler.
4. Bir okuma anına tıkladığında, o okuma anının detay ekranına gider.
5. "+" butonuna tıkladığında, yeni okuma anı ekleme ekranına gider.

---

### 3.4. Yeni Okuma Anı Ekle Ekranı

**Amaç:** Kullanıcının kitap sayfasının fotoğrafını çekmesi, OCR ile metni çıkarması ve opsiyonel olarak not eklemesi.

**İçerik:**
- **Başlık:** "Yeni Okuma Anı"
- **Fotoğraf Çekme Alanı:** Ekranın üst yarısında büyük bir alan. Tıklandığında kamera açılır veya galeriden fotoğraf seçilir.
- **OCR Sonucu:** Fotoğraf çekildikten sonra, OCR ile çıkarılan metin otomatik olarak gösterilir. Kullanıcı bu metni düzenleyebilir.
- **Not Alanı:** Metin girişi (placeholder: "Notunuzu ekleyin (opsiyonel)")
- **Kaydet Butonu:** Ekranın alt kısmında, tam genişlikte, primary renkte buton. Tıklandığında okuma anı kaydedilir ve kitap detay ekranına dönülür.
- **İptal Butonu:** Üst sol köşede "< Geri" butonu.

**Kullanıcı Akışı:**
1. Kullanıcı kitap detay ekranında "+" butonuna tıklar.
2. Kamera açılır veya galeriden fotoğraf seçilir.
3. Fotoğraf çekildikten sonra, OCR işlemi başlar (loading göstergesi).
4. OCR sonucu gösterilir. Kullanıcı metni düzenleyebilir.
5. Kullanıcı opsiyonel olarak not ekler.
6. "Kaydet" butonuna tıklar.
7. Okuma anı kitap detay ekranında görünür.

**Hata Yönetimi:**
- Eğer fotoğraf çekilmezse, "Kaydet" butonu pasif olur.
- OCR başarısız olursa, "OCR işlemi başarısız oldu. Metni manuel olarak girebilirsiniz." mesajı gösterilir ve kullanıcı metni manuel olarak girebilir.
- Fotoğraf kalitesi düşükse, "Fotoğraf kalitesi düşük. Daha net bir fotoğraf çekin." uyarısı gösterilir (opsiyonel).

---

### 3.5. Okuma Anı Detay Ekranı

**Amaç:** Kullanıcının bir okuma anını tam ekranda görmesi, fotoğrafı büyütmesi ve notunu okuması.

**İçerik:**
- **Sayfa Fotoğrafı:** Ekranın üst kısmında, tam genişlikte. Tıklandığında tam ekran modda açılır (zoom yapılabilir).
- **OCR Metni:** Fotoğrafın altında, tam metin gösterilir.
- **Kullanıcı Notu:** OCR metninin altında, eğer varsa kullanıcının notu gösterilir.
- **Zaman Damgası:** Ekranın en altında, küçük ve muted renkte (örneğin: "15 Ocak 2026, 14:30").
- **Geri Butonu:** Üst sol köşede "< Geri" butonu.

**Kullanıcı Akışı:**
1. Kullanıcı kitap detay ekranında bir okuma anına tıklar.
2. Okuma anı detay ekranını görür.
3. Fotoğrafı büyütebilir, metni okuyabilir.
4. "< Geri" butonuna tıklayarak kitap detay ekranına döner.

---

## 4. Kullanıcı Akışları (User Flows)

### 4.1. İlk Kullanım Akışı (Onboarding)

1. Kullanıcı uygulamayı ilk kez açar.
2. Boş ekran gösterilir: "Henüz kitap eklemediniz. İlk kitabınızı ekleyin!"
3. "Kitap Ekle" butonuna tıklar.
4. Yeni kitap ekle ekranına gider.
5. Kapak fotoğrafı, kitap adı ve yazar adı girer.
6. "Kaydet" butonuna tıklar.
7. Ana ekranda ilk kitabı görünür.

### 4.2. Okuma Anı Ekleme Akışı

1. Kullanıcı ana ekranda bir kitaba tıklar.
2. Kitap detay ekranını görür.
3. "+" butonuna tıklar.
4. Kamera açılır, sayfa fotoğrafı çeker.
5. OCR işlemi başlar (loading).
6. OCR sonucu gösterilir, kullanıcı metni düzenler (opsiyonel).
7. Not ekler (opsiyonel).
8. "Kaydet" butonuna tıklar.
9. Okuma anı kitap detay ekranında zaman çizgisinde görünür.

### 4.3. Okuma Anı İnceleme Akışı

1. Kullanıcı kitap detay ekranında bir okuma anına tıklar.
2. Okuma anı detay ekranını görür.
3. Fotoğrafı büyütür, metni okur.
4. "< Geri" butonuna tıklayarak kitap detay ekranına döner.

---

## 5. Etkileşim ve Geri Bildirim

Kullanıcı etkileşimlerinde anında geri bildirim sağlanmalıdır. Aşağıdaki tablo, etkileşim türlerini ve geri bildirim mekanizmalarını özetler.

| Etkileşim Türü | Geri Bildirim | Uygulama |
|----------------|---------------|----------|
| **Buton Tıklama** | Scale + Haptic | `scale: 0.97` + `Haptics.impactAsync(Light)` |
| **Kart Tıklama** | Opacity | `opacity: 0.7` |
| **Kaydet İşlemi** | Loading + Success Haptic | Loading göstergesi + `Haptics.notificationAsync(Success)` |
| **Hata Durumu** | Error Haptic + Mesaj | `Haptics.notificationAsync(Error)` + Hata mesajı |

---

## 6. Performans ve Optimizasyon

Uygulama, maksimum performans için aşağıdaki stratejileri kullanır:

**Fotoğraf Yükleme:** Kullanıcı fotoğraf çektiğinde, fotoğraf önce yerel olarak kaydedilir, ardından arka planda buluta yüklenir. Kullanıcı bu süreçte engellenmez.

**OCR İşlemi:** OCR işlemi, backend API'ye gönderilir. Kullanıcı, loading göstergesi görür. OCR sonucu geldiğinde, otomatik olarak metin alanına doldurulur.

**Zaman Çizgisi:** Kitap detay ekranındaki okuma anları listesi, `FlatList` ile oluşturulur. Bu, büyük listelerde performans sorunlarını önler.

**Veri Senkronizasyonu:** Tüm veriler, hem yerel veritabanında (AsyncStorage veya SQLite) hem de bulutta (backend API) saklanır. Kullanıcı offline iken de veri kaybı olmaz.

---

## 7. Hata Yönetimi ve Kullanıcı Deneyimi

Hata durumlarında kullanıcı deneyimi bozulmamalıdır. Aşağıdaki tablo, olası hata senaryolarını ve çözümlerini özetler.

| Hata Senaryosu | Kullanıcı Deneyimi | Çözüm |
|----------------|---------------------|--------|
| **OCR Başarısız** | "OCR işlemi başarısız oldu. Metni manuel olarak girebilirsiniz." | Kullanıcı metni manuel olarak girer |
| **Fotoğraf Yüklenemedi** | "Fotoğraf yüklenemedi. Lütfen tekrar deneyin." | Kullanıcı fotoğrafı yeniden yükler |
| **İnternet Bağlantısı Yok** | "İnternet bağlantısı yok. Veriler yerel olarak kaydedildi." | Veriler yerel olarak saklanır, internet bağlantısı geldiğinde senkronize edilir |
| **Kitap Adı Boş** | "Kaydet" butonu pasif olur | Kullanıcı kitap adı girmeden kaydedemez |

---

## 8. Sonuç

Bu tasarım, kullanıcının basılı kitap okuma deneyimini dijital bir hafıza katmanıyla zenginleştirmek için optimize edilmiştir. Sadelik, odaklanma ve bağlılık odaklı yaklaşım, uygulamanın temel taşlarıdır. Her ekran, tek bir amaca hizmet eder ve kullanıcı akışları kesintisizdir. Hata yönetimi ve performans optimizasyonu, kullanıcı deneyimini her koşulda korur.
