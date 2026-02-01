# PALIMPS - Ödeme Entegrasyonu Rehberi

Bu dokümantasyon, PALIMPS uygulamasına ödeme sistemi entegre etmek için gereken adımları açıklar.

## Mevcut Altyapı

PALIMPS uygulaması premium abonelik sistemi için gerekli backend altyapısına sahiptir:

### Veritabanı Şeması
- **users** tablosu: `isPremium` alanı (0: free, 1: premium)
- **subscriptions** tablosu: Abonelik detayları (userId, plan, status, startDate, endDate, externalId)

### Backend API'ler
- `POST /api/subscriptions/create` - Yeni abonelik oluştur
- `POST /api/subscriptions/update` - Abonelik durumunu güncelle
- `POST /api/subscriptions/cancel` - Aboneliği iptal et
- `POST /api/subscriptions/webhook` - Ödeme sağlayıcısından webhook'ları dinle

### Frontend Hazırlığı
- `useSubscription` hook: Premium durumunu kontrol eder
- `PremiumGate` component: Premium özellikleri korur
- `/premium` ekranı: Upgrade sayfası

---

## Önerilen Ödeme Sağlayıcıları

### 1. RevenueCat (Önerilen - Mobil Odaklı)

**Neden RevenueCat?**
- iOS App Store ve Google Play Store ile doğrudan entegrasyon
- Cross-platform abonelik yönetimi (iOS, Android, Web)
- Webhook desteği ile backend senkronizasyonu
- Ücretsiz 10K aylık aktif kullanıcıya kadar

**Kurulum Adımları:**

1. **RevenueCat Hesabı Oluştur**
   - https://app.revenuecat.com/signup adresinden kayıt ol
   - Yeni proje oluştur: "PALIMPS"

2. **Ürün Tanımla**
   - App Store Connect ve Google Play Console'da in-app purchase oluştur
   - Ürün ID: `palimps_premium_monthly` (örnek: $4.99/ay)
   - RevenueCat dashboard'da ürünü tanımla

3. **SDK Kurulumu**
   ```bash
   cd /home/ubuntu/okuma-hafizasi-mvp
   pnpm add react-native-purchases
   ```

4. **Frontend Entegrasyonu**
   
   `lib/revenue-cat.ts` dosyası oluştur:
   ```typescript
   import Purchases from 'react-native-purchases';
   
   export async function initRevenueCat() {
     if (Platform.OS === 'ios') {
       await Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY! });
     } else if (Platform.OS === 'android') {
       await Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY! });
     }
   }
   
   export async function purchasePremium() {
     try {
       const offerings = await Purchases.getOfferings();
       const monthlyPackage = offerings.current?.monthly;
       if (monthlyPackage) {
         const { customerInfo } = await Purchases.purchasePackage(monthlyPackage);
         return customerInfo.entitlements.active['premium'] !== undefined;
       }
     } catch (error) {
       console.error('Purchase error:', error);
       return false;
     }
   }
   
   export async function restorePurchases() {
     try {
       const customerInfo = await Purchases.restorePurchases();
       return customerInfo.entitlements.active['premium'] !== undefined;
     } catch (error) {
       console.error('Restore error:', error);
       return false;
     }
   }
   ```

5. **Premium Ekranını Güncelle**
   
   `app/premium.tsx` dosyasında:
   ```typescript
   import { purchasePremium } from '@/lib/revenue-cat';
   
   const handleUpgrade = async () => {
     setIsProcessing(true);
     const success = await purchasePremium();
     if (success) {
       Alert.alert('Success', 'Welcome to Premium!');
       router.back();
     } else {
       Alert.alert('Error', 'Purchase failed. Please try again.');
     }
     setIsProcessing(false);
   };
   ```

6. **Backend Webhook Kurulumu**
   
   RevenueCat dashboard'da webhook URL'i ayarla:
   ```
   https://3000-xxx.manus.computer/api/subscriptions/webhook
   ```
   
   Backend'de webhook handler zaten mevcut (`server/routers.ts`):
   ```typescript
   webhook: publicProcedure
     .input(z.object({ event: z.any() }))
     .mutation(async ({ input }) => {
       // RevenueCat event'ini işle
       const { event_type, app_user_id, entitlements } = input.event;
       
       if (event_type === 'INITIAL_PURCHASE' || event_type === 'RENEWAL') {
         // Kullanıcıyı premium yap
         await db.updateUserPremiumStatus(app_user_id, true);
       } else if (event_type === 'CANCELLATION' || event_type === 'EXPIRATION') {
         // Premium'u kaldır
         await db.updateUserPremiumStatus(app_user_id, false);
       }
       
       return { success: true };
     }),
   ```

7. **Environment Variables**
   
   `.env` dosyasına ekle:
   ```
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=your_ios_api_key
   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=your_android_api_key
   ```

---

### 2. Stripe (Web Odaklı Alternatif)

**Neden Stripe?**
- Web tabanlı ödeme akışları için ideal
- Güçlü API ve webhook desteği
- Türkiye'de kullanılabilir

**Kurulum Adımları:**

1. **Stripe Hesabı Oluştur**
   - https://dashboard.stripe.com/register adresinden kayıt ol

2. **Ürün ve Fiyat Oluştur**
   - Dashboard > Products > Add Product
   - Name: "PALIMPS Premium"
   - Price: $4.99/month (recurring)
   - Price ID'yi kaydet (örn: `price_xxx`)

3. **SDK Kurulumu**
   ```bash
   pnpm add @stripe/stripe-react-native
   ```

4. **Frontend Entegrasyonu**
   
   `lib/stripe.ts`:
   ```typescript
   import { useStripe } from '@stripe/stripe-react-native';
   import { trpc } from './trpc';
   
   export function useStripePurchase() {
     const { initPaymentSheet, presentPaymentSheet } = useStripe();
     const createPaymentIntent = trpc.subscriptions.createPaymentIntent.useMutation();
     
     const purchasePremium = async () => {
       // 1. Backend'den payment intent al
       const { clientSecret } = await createPaymentIntent.mutateAsync();
       
       // 2. Payment sheet'i başlat
       await initPaymentSheet({
         paymentIntentClientSecret: clientSecret,
         merchantDisplayName: 'PALIMPS',
       });
       
       // 3. Payment sheet'i göster
       const { error } = await presentPaymentSheet();
       
       if (error) {
         throw new Error(error.message);
       }
       
       return true;
     };
     
     return { purchasePremium };
   }
   ```

5. **Backend API Ekle**
   
   `server/routers.ts`:
   ```typescript
   import Stripe from 'stripe';
   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
   
   subscriptions: router({
     createPaymentIntent: protectedProcedure.mutation(async ({ ctx }) => {
       const paymentIntent = await stripe.paymentIntents.create({
         amount: 499, // $4.99
         currency: 'usd',
         customer: ctx.user.stripeCustomerId, // Kullanıcının Stripe customer ID'si
         metadata: { userId: ctx.user.id },
       });
       
       return { clientSecret: paymentIntent.client_secret };
     }),
     
     webhook: publicProcedure
       .input(z.object({ rawBody: z.string() }))
       .mutation(async ({ input, ctx }) => {
         const sig = ctx.req.headers['stripe-signature'];
         const event = stripe.webhooks.constructEvent(
           input.rawBody,
           sig,
           process.env.STRIPE_WEBHOOK_SECRET!
         );
         
         if (event.type === 'payment_intent.succeeded') {
           const userId = event.data.object.metadata.userId;
           await db.updateUserPremiumStatus(parseInt(userId), true);
         }
         
         return { success: true };
       }),
   }),
   ```

6. **Environment Variables**
   ```
   STRIPE_SECRET_KEY=sk_test_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
   ```

---

## Gerekli Backend Fonksiyonları

Aşağıdaki fonksiyonlar `server/db.ts` dosyasına eklenmelidir:

```typescript
/**
 * Kullanıcının premium durumunu güncelle
 */
export async function updateUserPremiumStatus(userId: number, isPremium: boolean) {
  await db
    .update(users)
    .set({ isPremium: isPremium ? 1 : 0 })
    .where(eq(users.id, userId));
}

/**
 * Abonelik oluştur
 */
export async function createSubscription(data: {
  userId: number;
  plan: string;
  status: string;
  externalId: string;
  startDate: Date;
  endDate: Date;
}) {
  const [subscription] = await db.insert(subscriptions).values(data).returning();
  return subscription;
}

/**
 * Abonelik durumunu güncelle
 */
export async function updateSubscription(externalId: string, updates: {
  status?: string;
  endDate?: Date;
}) {
  await db
    .update(subscriptions)
    .set(updates)
    .where(eq(subscriptions.externalId, externalId));
}
```

---

## Test Etme

### 1. Test Kartları (Stripe)
- Başarılı: `4242 4242 4242 4242`
- Başarısız: `4000 0000 0000 0002`

### 2. Sandbox Modu (RevenueCat)
- iOS: Sandbox App Store hesabı kullan
- Android: Test lisansı ekle

### 3. Manuel Premium Aktifleştirme (Geliştirme)
```sql
-- Veritabanında manuel olarak premium yap
UPDATE users SET isPremium = 1 WHERE id = 1;
```

---

## Checklist

### Ödeme Entegrasyonu Öncesi
- [ ] Ödeme sağlayıcısı seç (RevenueCat veya Stripe)
- [ ] Hesap oluştur ve API anahtarlarını al
- [ ] Ürün/fiyat tanımla
- [ ] Environment variables ayarla

### Geliştirme
- [ ] SDK kur ve yapılandır
- [ ] Frontend ödeme akışını uygula
- [ ] Backend webhook handler'ı test et
- [ ] Hata durumlarını yönet (ödeme başarısız, iptal, vb.)

### Test
- [ ] Test kartları/sandbox ile ödeme akışını test et
- [ ] Webhook'ların doğru çalıştığını doğrula
- [ ] Premium özelliklerin kilitleri test et
- [ ] Abonelik iptali akışını test et

### Yayınlama
- [ ] Production API anahtarlarına geç
- [ ] App Store / Play Store in-app purchase ayarlarını tamamla
- [ ] Webhook URL'lerini production'a ayarla
- [ ] Gizlilik politikası ve kullanım şartlarını güncelle

---

## Destek ve Kaynaklar

### RevenueCat
- Dokümantasyon: https://docs.revenuecat.com
- React Native SDK: https://docs.revenuecat.com/docs/reactnative
- Dashboard: https://app.revenuecat.com

### Stripe
- Dokümantasyon: https://stripe.com/docs
- React Native SDK: https://stripe.dev/stripe-react-native
- Dashboard: https://dashboard.stripe.com

---

## Notlar

1. **App Store Review**: Apple, in-app purchase kullanmayan abonelik sistemlerini reddedebilir. RevenueCat kullanımı önerilir.

2. **Vergi ve Komisyon**: 
   - Apple/Google %30 komisyon alır
   - Stripe %2.9 + $0.30 işlem ücreti alır

3. **Abonelik İptali**: Kullanıcılar aboneliklerini App Store/Play Store üzerinden iptal edebilir. Webhook'lar ile backend'i senkronize tutun.

4. **Restore Purchases**: iOS'ta "Restore Purchases" butonu eklemek zorunludur (App Store Review Guidelines).

5. **Test Modu**: Canlıya geçmeden önce mutlaka sandbox/test modunda kapsamlı test yapın.
