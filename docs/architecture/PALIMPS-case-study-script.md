# PALIMPS — Vaka Çalışması · Konuşma Notları

> **Format:** 9 slayt, 20–30 dakika derin dalış + Q&A
> **Hedef kitle:** Deneyimli iş insanları ve yönetim — geliştirici değil
> **Açı:** Solo developer + yapay zeka ile bir uygulamanın inşası
> **Eşlik eden materyaller:** `PALIMPS-case-study.pptx`, `PALIMPS-case-study-handout.pdf`

---

## Sunum öncesi son kontroller

- Slaytlar PowerPoint veya Keynote'ta açılmış mı? (Cambria + Calibri fontları yüklü olmalı — her ikisi de Mac'te varsayılan)
- Ekran 16:9 mi? (Slaytlar 13.33×7.5 inch widescreen)
- Handout'lar basılmış mı? (A3 yatay, sunum sonunda dağıtılacak)
- Telefon yanında — gerçek uygulamayı göstermek istersen
- Su, sessiz mod

---

## Açılış cümlesi (slaytlardan önce, ~30 saniye)

> *"Size bir vaka çalışması anlatacağım. Bir kişinin, yapay zekayla birlikte, altı ayda App Store'a kadar getirdiği bir uygulamanın hikâyesi. Ürün önemli değil — yaklaşımı önemli. Çünkü bu yaklaşım büyük olasılıkla yakında pek çok küçük ekibin standart işleyişi olacak."*

---

## Slayt 1 — PALIMPS · Açılış · ~1 dakika

**Görsel:** Koyu mürekkep zemin üzerinde "PALIMPS" başlığı, alt başlık *"bir vaka çalışması"*, alt-alt-başlığı *"Solo developer · AI ortağı · App Store yolculuğu"*.

**Söyle:**

> *"PALIMPS — fiziksel kitaplar için bir okuma hafızası uygulaması. Şu anda TestFlight aşamasında, iOS'ta. Türkçe ve İngilizce yayınlandı."*
>
> *"Adı 'palimpsest'ten geliyor — orta çağda kazınıp tekrar yazılan parşömen. Üstündeki yazı silinse de altında öncekinin izi kalır. Kitap okumak da öyle: kitabı geçtikten sonra ondan size kalan, alt katmandaki o silinmiş izlerdir. Uygulama da bunu yapıyor — okurken bıraktığınız izleri tekrar görünür kılıyor."*

**Geçiş:** *"Önce ne olduğunu, sonra nasıl yapıldığını anlatacağım."*

---

## Slayt 2 — Bir bakışta · ~1.5 dakika

**Görsel:** Üç büyük rakam — `1` (geliştirici), `iOS`, `TR · EN`.

**Söyle:**

> *"Üç sayı — uygulamanın bütün çerçevesini özetliyor."*
>
> *"Bir geliştirici. Ben. Tam zamanlı, yalnız. Klasik bir startup ekibim yok — tasarımcı yok, backend takımı yok, DevOps mühendisi yok. Bir kişi, bir laptop."*
>
> *"iOS — sadece iPhone. Android'i sonraya bıraktım, web'i belki hiç yapmayacağım. Ürün dar olunca her karar daha hızlı, kalite daha yüksek."*
>
> *"İki dil — Türkçe ve İngilizce. Türkçe birinci sınıf vatandaş, İngilizce eşit ağırlıkta. DE / ES gibi diller şu an roadmap'te değil. Az dil, çok özen."*

**Anahtar mesaj:** *"Küçük başlamak strateji, doğru parametre."*

---

## Slayt 3 — Ürün nedir? · ~2 dakika

**Görsel:** Dört adımlı yatay akış — *Sayfayı çek → Metin çıkar → Anı kaydet → Geri dön*.

**Söyle:**

> *"Kitap okurken bir cümleye takılırsınız, ya da bir paragrafta düşünürsünüz. Sayfa kapanınca o an genelde kayboluyor. PALIMPS'in tek işi bu kayboluşu durdurmak."*
>
> *"Adımlar şunlar: Bir, sayfayı çekiyorsunuz — telefonla bir fotoğraf, o kadar. İki, yapay zeka sayfayı okuyor; saniyeler içinde metni çıkarıyor. Üç, bu bir 'an' olarak kaydediliyor — tarih, kitap, sayfa numarası, vurguladığınız satırlar, kenar notlarınız. Dört: aylar sonra dönüyorsunuz — 'bu kitabı nasıl okudum?' sorusunun cevabı orada."*
>
> *"Ürün karmaşık değil. Karmaşık olan, dört adımı bu kadar saniyeye indirmek. Bunun için arkada tasarlanması gereken şey, ikinci yarıda anlatacağım mimari."*

**Geçiş:** *"Şimdi perde arkasına geçiyorum."*

---

## Slayt 4 — Mimarinin haritası · ~3 dakika

**Görsel:** Üç yatay katman — *Yüzey · Aracı · Temel*.

**Söyle:**

> *"Mimariyi üç katmanda tasarladım. Bu, modern uygulamaların büyük çoğunluğunun haritasıdır — değişen, her katmandaki seçimler."*
>
> *"Birinci katman — Yüzey. Kullanıcının dokunduğu her şey: ekranlar, etkileşim, yerel dil. Telefonun kendisi. Apple'ın Human Interface Guidelines'ı bu katmanda yaşar — biz buraya 'ne dokunulursa o' diyoruz."*
>
> *"İkinci katman — Aracı. Beyin. Sunucu. Kullanıcı bir istek attığında bu katman karşılıyor: kim bu kullanıcı, premium mi, hız limitini aştı mı, doğru servise nasıl iletilecek? Burada kurallar yaşar. Çoğu şirkette burası kalabalıklaşır — biz tek dosyada tuttuk."*
>
> *"Üçüncü katman — Temel. Arka plan servisleri. Veritabanı, depolama, yapay zeka, kimlik doğrulama, ödeme. Beş tane parça. Her biri tek bir işin tek doğrusu."*
>
> *"Bütün hikâye bu — bir kişilik bir takımın akıl tutabileceği bir sistem. Mikroservis yok. Kuyruk yok. Karmaşıklığın yerine yazılı kurallar koyduk."*

**Anahtar mesaj:** *"Az parça, çok disiplin. Mikroservis sayısı, takım büyüklüğüyle orantılı olmalı."*

---

## Slayt 5 — Bir fotoğraf, beş adım · ~3 dakika

**Görsel:** Numaralı liste — Telefon · Depolama · Sunucu · Yapay zeka · Veritabanı; sağda saniyeler.

**Söyle:**

> *"Şimdi somutlaştıralım. Kullanıcı bir sayfa fotoğrafı çektiğinde — beş saniye içinde bir 'an' olarak veritabanına düşene kadar — ne oluyor?"*
>
> *"Bir: Telefon fotoğrafı çekiyor, sıkıştırıyor. Yaklaşık bir saniye."*
>
> *"İki: Bu fotoğraf doğrudan buluta yükleniyor — Cloudflare R2'ye. Burada önemli bir karar var: **fotoğraf hiçbir zaman bizim sunucumuzdan geçmiyor**. Telefondan doğrudan depoya. Bu hem performans hem KVKK için kritik. Sunucu görmediği veriden sorumlu değil."*
>
> *"Üç: Sunucu kullanıcıyı doğruluyor, yapay zekaya yönlendiriyor. Bir saniyenin altında."*
>
> *"Dört: Yapay zeka — burada Google'ın Gemini modelini kullanıyoruz — sayfanın metnini çıkarıyor. İki saniye civarı. Bu en ağır adım."*
>
> *"Beş: Metin veritabanına yazılıyor, telefona dönüş bilgisi gidiyor. An kaydedildi."*
>
> *"Toplam: 4-5 saniye. Bu, 'çekmek' düğmesine basıp 'bittim' duygusuna kadar geçen süre."*

**Anahtar mesaj:** *"Her adımın bir sahibi var. Hiçbir parça başkasının işini yapmıyor."*

---

## Slayt 6 — Yapay zekanın rolü · ~3 dakika

**Görsel:** İki kart yan yana — *Okuma* (arka plan) ve *Sohbet* (kullanıcı önü).

**Söyle:**

> *"Yapay zeka tek bir 'AI servisi' olarak düşünülmemeli. PALIMPS'te iki ayrı görev için iki ayrı model kullanıyoruz. Bu kararı en başta verdik ve hiç pişman olmadık."*
>
> *"Sol taraf — Okuma. OCR yapıyor. Sayfa metnini çıkarıyor. Burada önemli olan ne? Hız ve maliyet. Kalite önemli ama 'edebi tonu yakalama' gibi bir derdi yok. Burada Gemini'nin **flash-lite** modelini kullanıyoruz — küçük, hızlı, ucuz. Yüksek hacme dayanıklı."*
>
> *"Sağ taraf — Sohbet. Kullanıcıyla doğrudan konuşan kısım. Reading assistant. Burada önemli olan ne? Kalite. Nüans. Marka sesi. Burada **flash** modelini kullanıyoruz — daha pahalı, daha yetenekli."*
>
> *"İkisi arasındaki en kritik fark teknik değil — markada. Sohbet katmanının bir tonu var: 'sade kütüphaneci'. Sakin, doğru, ne 'startup heyecanı' ne robotik. Bu ton ürünün kendisi. Kullanıcının uygulamayı sevme nedeni: arkadaşı gibi konuşan ama bilgili bir kütüphaneci hissi."*
>
> *"Bu tonu nasıl korudum? Tüm prompt'lar — yani yapay zekaya verilen tüm talimatlar — tek bir dosyada. Bir başka geliştirici, bir başka feature, bir başka ekran ton bozamasın. Ton, mimari kararıdır."*

**Anahtar mesaj:** *"Ucuz olanı ucuza, pahalı olanı hak ettiği yere. Her iş için doğru model."*

---

## Slayt 7 — Üç ilke · ~3 dakika

**Görsel:** Üç prensip kart — *Az parça, çok disiplin · Veriyi sahibinde tut · Yapay zekaya marka sesi öğret*.

**Söyle:**

> *"Bu mimarinin neden bu şekilde olduğunu üç prensipte topluyorum. Bunlar sadece teknik kararlar değil — yönetimsel."*
>
> *"Bir: Az parça, çok disiplin. Bir geliştiricinin akıl tutabileceği sistem ne kadar büyük olabilir? Cevap: küçük. Mikroservis kurmadık. Kuyruk yok. Yerine **invariant'lar** koyduk — yazılı kurallar. 'Fotoğraf API'den geçmez', 'isPremium tek yerde yaşar', 'tüm prompt'lar tek dosyada' gibi 9 madde. Bunları kırmadan sistem ayakta kalıyor."*
>
> *"İki: Veriyi sahibinde tut. Yani: kullanıcının verisi mümkün olan en az yere değsin. KVKK silmesi tek bir prefix temizliği. Sunucu görmediği veriden sorumlu değil. Bu sadece compliance değil — **risk azaltma**."*
>
> *"Üç: Yapay zekaya marka sesi öğret. Bunu daha önce konuştuk ama şu açıdan tekrar edeyim: prompt mimaridir. Yapay zekaya verdiğin talimat, ürünün üzerine inşa edildiği temeldir. Onu bir 'config' gibi düşünmek hatadır — kod gibi yazılı tutulmalı, sürümlenmeli, test edilmeli."*

**Anahtar mesaj:** *"Kararı yazılı tutmak, kararı tekrar tekrar vermekten ucuzdur."*

---

## Slayt 8 — Tek kişilik takım, AI ortağı · ~4 dakika

**Görsel:** Dört numaralı blok — *Skill'ler · Prompt'lar · Retrospektifler · Handoff'lar*.

**Söyle:**

> *"Şimdi sunumun en önemli parçasına geliyorum. Bir kişilik takımla bu kadar şey nasıl yapılır? Cevap: yapay zekayla. Ama 'yapay zeka kod yazıyor' anlamında değil — 'yapay zeka takımın eksik üyelerinin yerine geçiyor' anlamında."*
>
> *"Anthropic'in Claude modelini bir asistan olarak değil, bir takım olarak kullanıyorum. Bunu mümkün kılan dört yapı var:"*
>
> *"Bir: Skill'ler. 18 ayrı uzmanlık dosyası yazdım: backend mühendisi, iOS geliştiricisi, veritabanı yöneticisi, LLM mühendisi, ürün tasarımcısı, KVKK uzmanı, release manager... Her karar doğru 'uzmana' gidiyor. Bir backend sorusu sorduğumda Claude bana backend mühendisi gibi cevap veriyor — bu rol için yazılmış kurallarla."*
>
> *"İki: Prompt'lar. Tüm yapay zeka talimatları — kullanıcıya yansıyan AI çıktılarının arkasındaki prompt'lar — tek bir kaynakta. Test edilebilir, sürümlenebilir, değiştirilebilir. Marka sesi, JSON şeması, davranış."*
>
> *"Üç: Retrospektifler. Her release'den sonra yazılı bir geri bakış: ne işe yaradı, ne kırıldı, neyi tekrar yapma. Solo geliştiricinin eksik olan ekibinin yerine geçiyor — çünkü tek başınayken kimse 'aynı hatayı tekrar yapma' demiyor. Yazılı hafıza, kişisel hafızanın yerine geçiyor."*
>
> *"Dört: Handoff'lar. Her oturum sonu yazılı bir state. Yarın işime devam ettiğimde 'nereden kalmıştık?' sorusunun cevabı orada. Yapay zekayla çalışmak oturum bazlı — geçen seferki bağlam unutulur. Handoff bu unutuşu çözüyor."*
>
> *"Bu dört yapı bir araya geldiğinde solo developer'ın hiç yalnız hissetmediği bir takım çıkıyor ortaya. Yapay zeka 'asistan' değil — yapay olarak büyütülmüş bir takımın hafızası."*

**Anahtar mesaj:** *"Tek başına çalışmak, yalnız çalışmak zorunda değil."*

---

## Slayt 9 — Çıkarımlar · ~2 dakika

**Görsel:** Koyu zemin, üç ders, kapanış sözü.

**Söyle:**

> *"Üç tekrarlanabilir ders bırakıyorum size."*
>
> *"Bir: Küçük takım, dar mimari. Mikroservis sayısı, takım büyüklüğüyle orantılı olmalı. Tek kişi mikroservis kuramaz, kurmamalı. Ekip büyüdükçe parça sayısı artabilir — küçükken disiplin kurar."*
>
> *"İki: Yapay zeka bir araç değil, bir disiplin. Yapay zekadan iyi sonuç, iyi yapıdan çıkar. Skill'ler, prompt'lar, retrospektifler — bunlar 'verimlilik hilesi' değil, **çalışma metodu**. Bu metodu kuran küçük ekipler, kurmayan büyük ekiplerden hızlı."*
>
> *"Üç: Marka sesi mimari kararıdır. Ürünün tonu, yapay zekanın tonudur. Bunu 'pazarlama brief'i gibi sözlü tutmak çalışmıyor. Yazılı, sürümlü, test edilebilir bir invariant olarak yaşamak zorunda."*

**Kapanış:**

> *"Sloganı şu: 'her kitap, başka bir kitabın altında yazılır.' PALIMPS'in adı buradan geliyor — ama mimari de aynı şey. Her sistem, daha öncekilerin üzerine, izlerini görerek inşa edilir. Ben de bu sistemi kurdum, sizinle paylaştım — umarım sizin sistemleriniz buna bir cevap üretir."*

**Q&A açılışı:** *"Sorularınızı bekliyorum."*

---

## Q&A için hazırlık — sıkça gelebilecek sorular

| Soru | Cevap özü |
| --- | --- |
| **"Bir kişi gerçekten bunu yapabilir mi?"** | Evet — ama "bir kişi + iyi araçlar + iyi disiplin". 5 yıl önce mümkün değildi. Bugün 18 skill + 1 ürün. |
| **"Yapay zeka hata yapmaz mı?"** | Yapar. O yüzden invariant'lar var, retro'lar var, manuel QA var. AI'a güvenmiyoruz — AI'ın çıktısını kontrol eden bir yapı kuruyoruz. |
| **"Maliyet nedir?"** | Sunucu (Railway) aylık ~$20, R2 storage marjinal, Gemini kullanım bazlı (~$0.001/OCR çağrısı). RevenueCat free tier'da. Ölçeklenince Gemini en büyük kalem olur. |
| **"Neden iOS-only?"** | Kalite. iki platforma yetişen bir kişi, hiçbirinde mükemmel olamıyor. Türk ve global "premium kitap okuyucusu" segmentinde iOS yoğunluğu yüksek. |
| **"Yapay zeka kod yazıyor mu?"** | Çoğunlukla evet, ama yapay zekanın kodunu insan denetliyor. Kod review'u disipline ettik — `palimps-code-reviewer` skill'i bu işi yapıyor. |
| **"Apple onayladı mı?"** | TestFlight'tayız — beta. App Store submission yakın. KVKK + GDPR uyumu hazır, privacy manifest tamam. |
| **"Bu nasıl ölçeklenir?"** | İlk 10K kullanıcıya kadar bu mimari yeter. Sonrası: read replica, Gemini quota artırımı, belki cache layer. Her büyüme adımı için yazılı bir plan var. |

---

## Sunum sonrası

- Handout'ları masaya bırak veya el ile dağıt
- Hilalsumnu@gmail.com adresine geri bildirim isteyebileceğini belirt
- Beta'ya katılmak isteyenlere TestFlight linki gönder

---

> *her kitap, başka bir kitabın altında yazılır.*
