# PALIMPS - iyzico Ödeme Entegrasyonu Rehberi

Bu dokümantasyon, PALIMPS uygulamasına **iyzico** ödeme sistemi entegre etmek için gereken tüm adımları detaylı olarak açıklar.

---

## İçindekiler

1. [iyzico Nedir?](#iyzico-nedir)
2. [Hesap Açma ve Onay Süreci](#hesap-açma-ve-onay-süreci)
3. [Backend Entegrasyonu](#backend-entegrasyonu)
4. [Frontend Entegrasyonu](#frontend-entegrasyonu)
5. [Abonelik Yönetimi](#abonelik-yönetimi)
6. [Webhook Kurulumu](#webhook-kurulumu)
7. [Test Etme](#test-etme)
8. [Canlıya Alma](#canlıya-alma)
9. [SSS ve Sorun Giderme](#sss-ve-sorun-giderme)

---

## iyzico Nedir?

**iyzico**, Türkiye'nin en büyük ödeme altyapı sağlayıcısıdır. Stripe'ın Türkiye versiyonu olarak düşünebilirsiniz.

### Özellikler:
- ✅ Türk bankaları ile tam entegrasyon
- ✅ Tüm kredi/banka kartları (Visa, Mastercard, Troy)
- ✅ 3D Secure zorunlu (PCI-DSS uyumlu)
- ✅ Abonelik (recurring payment) desteği
- ✅ Tek çekim ve taksitli ödeme
- ✅ Otomatik fatura kesimi
- ✅ Mobil SDK (iOS/Android)
- ✅ Sandbox test ortamı

### Komisyon Oranları:
| Paket | Komisyon | Aylık Ücret |
|-------|----------|-------------|
| Başlangıç | %2.99 + ₺0.25 | Yok |
| Profesyonel | %2.49 + ₺0.25 | ₺99 |
| Kurumsal | Özel fiyat | Özel |

**PALIMPS için öneri**: Başlangıç paketi (komisyon bazlı, sabit ücret yok)

---

## Hesap Açma ve Onay Süreci

### Gerekli Belgeler

1. **Şirket Belgeleri**:
   - Vergi levhası (güncel)
   - Ticaret sicil gazetesi veya faaliyet belgesi
   - İmza sirküleri
   - Şirket kuruluş sözleşmesi (limited/anonim şirketler için)

2. **Banka Bilgileri**:
   - Şirket banka hesabı IBAN
   - Banka hesap cüzdanı (ilk sayfa)

3. **Yetkili Kişi**:
   - TC kimlik fotokopisi (ön/arka)
   - İkametgah belgesi (3 aydan eski olmamalı)

4. **Ek Belgeler** (e-ticaret için):
   - Web sitesi adresi (PALIMPS landing page)
   - Mesafeli satış sözleşmesi
   - Gizlilik politikası ve kullanım şartları

### Başvuru Adımları

**1. iyzico Hesabı Oluşturma**

https://merchant.iyzipay.com/register adresine gidin:

```
1. E-posta ve şifre belirleyin
2. Şirket bilgilerini girin:
   - Şirket ünvanı
   - Vergi numarası
   - Vergi dairesi
   - Şirket adresi
   - Telefon numarası
3. Yetkili kişi bilgilerini girin
4. Banka hesabı bilgilerini ekleyin (para transferi için)
```

**2. Belge Yükleme**

Merchant panel'den **Ayarlar** > **Belgeler** bölümüne gidin ve tüm belgeleri yükleyin.

**3. Onay Süreci**

- iyzico ekibi belgeleri inceler (1-3 iş günü)
- Eksik belge varsa e-posta ile bildirilir
- Onay sonrası API anahtarları aktif olur

**4. API Anahtarlarını Alma**

Onay sonrası **Ayarlar** > **API & Güvenlik** bölümünden:
- **API Key** (public key)
- **Secret Key** (private key)
- **Sandbox** ve **Production** anahtarları ayrı ayrı verilir

---

## Backend Entegrasyonu

### 1. SDK Kurulumu

```bash
cd /home/ubuntu/okuma-hafizasi-mvp
pnpm add iyzipay
```

### 2. Environment Variables

`.env` dosyasına ekleyin:

```env
# iyzico Sandbox (Test)
IYZICO_API_KEY=sandbox-xxx
IYZICO_SECRET_KEY=sandbox-yyy
IYZICO_BASE_URL=https://sandbox-api.iyzipay.com

# iyzico Production (Canlı)
# IYZICO_API_KEY=your-production-api-key
# IYZICO_SECRET_KEY=your-production-secret-key
# IYZICO_BASE_URL=https://api.iyzipay.com
```

### 3. iyzico Client Oluşturma

`server/iyzico.ts` dosyası oluşturun:

```typescript
import Iyzipay from 'iyzipay';

export const iyzico = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY!,
  secretKey: process.env.IYZICO_SECRET_KEY!,
  uri: process.env.IYZICO_BASE_URL!,
});

/**
 * Abonelik başlatma (Subscription Initialize)
 */
export async function createSubscription(params: {
  userId: number;
  userEmail: string;
  userName: string;
  userPhone: string;
  userAddress: string;
  userCity: string;
  userCountry: string;
  cardHolderName: string;
  cardNumber: string;
  expireMonth: string;
  expireYear: string;
  cvc: string;
}) {
  const request = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: `user_${params.userId}_${Date.now()}`,
    
    // Fiyat bilgileri
    pricingPlanReferenceCode: 'PALIMPS_PREMIUM_MONTHLY', // iyzico panelinden oluşturacağınız plan kodu
    subscriptionInitialStatus: 'ACTIVE',
    
    // Müşteri bilgileri
    customer: {
      name: params.userName.split(' ')[0],
      surname: params.userName.split(' ')[1] || '',
      email: params.userEmail,
      gsmNumber: params.userPhone,
      identityNumber: '11111111111', // Test için sabit, canlıda gerçek TC no
      billingAddress: {
        contactName: params.userName,
        city: params.userCity,
        country: params.userCountry,
        address: params.userAddress,
      },
      shippingAddress: {
        contactName: params.userName,
        city: params.userCity,
        country: params.userCountry,
        address: params.userAddress,
      },
    },
    
    // Kart bilgileri
    paymentCard: {
      cardHolderName: params.cardHolderName,
      cardNumber: params.cardNumber,
      expireMonth: params.expireMonth,
      expireYear: params.expireYear,
      cvc: params.cvc,
      registerCard: '1', // Kartı kaydet (abonelik için gerekli)
    },
  };

  return new Promise((resolve, reject) => {
    iyzico.subscription.create(request, (err: any, result: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Abonelik iptal etme
 */
export async function cancelSubscription(subscriptionReferenceCode: string) {
  const request = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: `cancel_${Date.now()}`,
    subscriptionReferenceCode,
  };

  return new Promise((resolve, reject) => {
    iyzico.subscription.cancel(request, (err: any, result: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Abonelik sorgulama
 */
export async function getSubscription(subscriptionReferenceCode: string) {
  const request = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: `query_${Date.now()}`,
    subscriptionReferenceCode,
  };

  return new Promise((resolve, reject) => {
    iyzico.subscription.retrieve(request, (err: any, result: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}
```

### 4. Database Schema Güncelleme

`drizzle/schema.ts` dosyasına ekleyin:

```typescript
export const users = mysqlTable("users", {
  // ... mevcut alanlar ...
  iyzicoCustomerId: varchar("iyzico_customer_id", { length: 255 }),
  iyzicoSubscriptionRef: varchar("iyzico_subscription_ref", { length: 255 }),
});
```

Migration çalıştırın:

```bash
pnpm db:push
```

### 5. Backend API Router'ı Güncelleme

`server/routers.ts` dosyasındaki `subscriptions` router'ına ekleyin:

```typescript
import { createSubscription, cancelSubscription, getSubscription } from './iyzico';

subscriptions: router({
  /**
   * iyzico abonelik başlatma
   */
  createIyzicoSubscription: protectedProcedure
    .input(z.object({
      cardHolderName: z.string(),
      cardNumber: z.string(),
      expireMonth: z.string(),
      expireYear: z.string(),
      cvc: z.string(),
      userPhone: z.string(),
      userAddress: z.string(),
      userCity: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await createSubscription({
          userId: ctx.user.id,
          userEmail: ctx.user.email || '',
          userName: ctx.user.name || 'User',
          userPhone: input.userPhone,
          userAddress: input.userAddress,
          userCity: input.userCity,
          userCountry: 'Turkey',
          cardHolderName: input.cardHolderName,
          cardNumber: input.cardNumber,
          expireMonth: input.expireMonth,
          expireYear: input.expireYear,
          cvc: input.cvc,
        });

        if (result.status === 'success') {
          // Premium aktif et
          await db.updateUserPremiumStatus(ctx.user.id, true);
          
          // iyzico subscription ref'i kaydet
          await db.updateUser(ctx.user.id, {
            iyzicoSubscriptionRef: result.subscriptionReferenceCode,
          });

          return { success: true, subscriptionRef: result.subscriptionReferenceCode };
        } else {
          throw new Error(result.errorMessage || 'Ödeme başarısız');
        }
      } catch (error: any) {
        console.error('[iyzico] Subscription error:', error);
        throw new Error(error.message || 'Ödeme işlemi başarısız oldu');
      }
    }),

  /**
   * iyzico abonelik iptal etme
   */
  cancelIyzicoSubscription: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        const user = await db.getUserById(ctx.user.id);
        if (!user?.iyzicoSubscriptionRef) {
          throw new Error('Aktif abonelik bulunamadı');
        }

        const result = await cancelSubscription(user.iyzicoSubscriptionRef);

        if (result.status === 'success') {
          // Premium iptal et
          await db.updateUserPremiumStatus(ctx.user.id, false);
          
          return { success: true };
        } else {
          throw new Error(result.errorMessage || 'İptal işlemi başarısız');
        }
      } catch (error: any) {
        console.error('[iyzico] Cancel error:', error);
        throw new Error(error.message || 'İptal işlemi başarısız oldu');
      }
    }),

  /**
   * iyzico webhook handler
   */
  iyzicoWebhook: publicProcedure
    .input(z.object({ 
      token: z.string(),
      subscriptionReferenceCode: z.string(),
      status: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        // Webhook güvenlik kontrolü (iyzico token doğrulama)
        // TODO: Token doğrulama ekleyin
        
        const { subscriptionReferenceCode, status } = input;
        
        // Kullanıcıyı bul
        const user = await db.getUserByIyzicoSubscriptionRef(subscriptionReferenceCode);
        if (!user) {
          console.error('[iyzico] User not found for subscription:', subscriptionReferenceCode);
          return { success: false };
        }

        // Status'e göre premium durumunu güncelle
        if (status === 'ACTIVE') {
          await db.updateUserPremiumStatus(user.id, true);
          console.log(`[iyzico] User ${user.id} premium activated`);
        } else if (status === 'CANCELED' || status === 'EXPIRED') {
          await db.updateUserPremiumStatus(user.id, false);
          console.log(`[iyzico] User ${user.id} premium cancelled`);
        }

        return { success: true };
      } catch (error) {
        console.error('[iyzico] Webhook error:', error);
        return { success: false };
      }
    }),
}),
```

### 6. Database Helper Fonksiyonları

`server/db.ts` dosyasına ekleyin:

```typescript
export async function getUserByIyzicoSubscriptionRef(subscriptionRef: string) {
  const db = await getDb();
  if (!db) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.iyzicoSubscriptionRef, subscriptionRef))
    .limit(1);

  return user || null;
}

export async function updateUser(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(users)
    .set(data)
    .where(eq(users.id, userId));
}
```

---

## Frontend Entegrasyonu

### 1. Ödeme Formu Bileşeni

`components/iyzico-payment-form.tsx` dosyası oluşturun:

```typescript
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import * as Haptics from 'expo-haptics';

interface IyzicoPaymentFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function IyzicoPaymentForm({ onSuccess, onCancel }: IyzicoPaymentFormProps) {
  const colors = useColors();
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolderName, setCardHolderName] = useState('');
  const [expireMonth, setExpireMonth] = useState('');
  const [expireYear, setExpireYear] = useState('');
  const [cvc, setCvc] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  const createSubscriptionMutation = trpc.subscriptions.createIyzicoSubscription.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Başarılı!', 'Premium üyeliğiniz aktif edildi.');
      onSuccess();
    },
    onError: (error) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Hata', error.message || 'Ödeme işlemi başarısız oldu.');
      setIsProcessing(false);
    },
  });

  const handleSubmit = async () => {
    // Validasyon
    if (!cardNumber || !cardHolderName || !expireMonth || !expireYear || !cvc) {
      Alert.alert('Uyarı', 'Lütfen tüm kart bilgilerini doldurun.');
      return;
    }

    if (!phone || !address || !city) {
      Alert.alert('Uyarı', 'Lütfen iletişim bilgilerini doldurun.');
      return;
    }

    setIsProcessing(true);

    try {
      await createSubscriptionMutation.mutateAsync({
        cardNumber: cardNumber.replace(/\s/g, ''), // Boşlukları kaldır
        cardHolderName,
        expireMonth,
        expireYear,
        cvc,
        userPhone: phone,
        userAddress: address,
        userCity: city,
      });
    } catch (error) {
      // Error handled in onError
    }
  };

  // Kart numarası formatla (4'lü gruplar)
  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    setCardNumber(formatted);
  };

  return (
    <View className="flex-1 p-6">
      <Text className="text-2xl font-bold text-foreground mb-6">Ödeme Bilgileri</Text>

      {/* Kart Numarası */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-foreground mb-2">Kart Numarası</Text>
        <TextInput
          value={cardNumber}
          onChangeText={formatCardNumber}
          placeholder="1234 5678 9012 3456"
          placeholderTextColor={colors.muted}
          className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
          keyboardType="number-pad"
          maxLength={19} // 16 digits + 3 spaces
          editable={!isProcessing}
        />
      </View>

      {/* Kart Sahibi */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-foreground mb-2">Kart Üzerindeki İsim</Text>
        <TextInput
          value={cardHolderName}
          onChangeText={setCardHolderName}
          placeholder="AHMET YILMAZ"
          placeholderTextColor={colors.muted}
          className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
          autoCapitalize="characters"
          editable={!isProcessing}
        />
      </View>

      {/* Son Kullanma Tarihi ve CVC */}
      <View className="flex-row gap-4 mb-4">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground mb-2">Ay</Text>
          <TextInput
            value={expireMonth}
            onChangeText={setExpireMonth}
            placeholder="MM"
            placeholderTextColor={colors.muted}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
            keyboardType="number-pad"
            maxLength={2}
            editable={!isProcessing}
          />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground mb-2">Yıl</Text>
          <TextInput
            value={expireYear}
            onChangeText={setExpireYear}
            placeholder="YY"
            placeholderTextColor={colors.muted}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
            keyboardType="number-pad"
            maxLength={2}
            editable={!isProcessing}
          />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground mb-2">CVC</Text>
          <TextInput
            value={cvc}
            onChangeText={setCvc}
            placeholder="123"
            placeholderTextColor={colors.muted}
            className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
            keyboardType="number-pad"
            maxLength={3}
            secureTextEntry
            editable={!isProcessing}
          />
        </View>
      </View>

      {/* Telefon */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-foreground mb-2">Telefon</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="+90 555 123 4567"
          placeholderTextColor={colors.muted}
          className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
          keyboardType="phone-pad"
          editable={!isProcessing}
        />
      </View>

      {/* Adres */}
      <View className="mb-4">
        <Text className="text-sm font-semibold text-foreground mb-2">Adres</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Mahalle, Sokak, No"
          placeholderTextColor={colors.muted}
          className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
          multiline
          numberOfLines={2}
          editable={!isProcessing}
        />
      </View>

      {/* Şehir */}
      <View className="mb-6">
        <Text className="text-sm font-semibold text-foreground mb-2">Şehir</Text>
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="İstanbul"
          placeholderTextColor={colors.muted}
          className="bg-surface border border-border rounded-xl px-4 py-3 text-foreground text-base"
          editable={!isProcessing}
        />
      </View>

      {/* Güvenlik Notu */}
      <View className="bg-primary/10 rounded-xl p-4 mb-6">
        <Text className="text-xs text-primary text-center">
          🔒 Ödemeniz iyzico güvenli ödeme altyapısı ile 3D Secure ile korunmaktadır.
        </Text>
      </View>

      {/* Butonlar */}
      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={onCancel}
          disabled={isProcessing}
          className="flex-1 bg-surface border border-border rounded-full py-4"
          activeOpacity={0.7}
        >
          <Text className="text-foreground font-semibold text-center">İptal</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isProcessing}
          className="flex-1 bg-primary rounded-full py-4"
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <View className="flex-row items-center justify-center">
              <ActivityIndicator color={colors.background} size="small" />
              <Text className="text-background font-semibold ml-2">İşleniyor...</Text>
            </View>
          ) : (
            <Text className="text-background font-semibold text-center">₺149.99 Öde</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

### 2. Premium Ekranını Güncelleme

`app/premium.tsx` dosyasını güncelleyin:

```typescript
import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { router } from 'expo-router';
import { useSubscription } from '@/hooks/use-subscription';
import { IyzicoPaymentForm } from '@/components/iyzico-payment-form';

export default function PremiumScreen() {
  const { isPremium } = useSubscription();
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // ... mevcut features kodu ...

  const handleUpgrade = () => {
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    router.back();
  };

  return (
    <ScreenContainer className="p-6">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* ... mevcut içerik ... */}

        {/* CTA Button */}
        {!isPremium && (
          <TouchableOpacity
            onPress={handleUpgrade}
            className="bg-primary rounded-full py-4 mb-4"
            activeOpacity={0.8}
          >
            <Text className="text-background font-bold text-center text-lg">
              Premium'a Geç - ₺149.99/ay
            </Text>
          </TouchableOpacity>
        )}

        {/* ... mevcut terms ... */}
      </ScrollView>

      {/* Ödeme Modal */}
      <Modal
        visible={showPaymentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <IyzicoPaymentForm
          onSuccess={handlePaymentSuccess}
          onCancel={() => setShowPaymentModal(false)}
        />
      </Modal>
    </ScreenContainer>
  );
}
```

---

## Abonelik Yönetimi

### iyzico Merchant Panel'de Abonelik Planı Oluşturma

1. **Merchant Panel** > **Abonelik** > **Fiyatlandırma Planları** > **Yeni Plan Oluştur**

2. Plan bilgilerini girin:
   ```
   Plan Adı: PALIMPS Premium
   Plan Kodu: PALIMPS_PREMIUM_MONTHLY
   Fiyat: ₺149.99
   Periyot: Aylık
   Deneme Süresi: 0 gün (veya 7 gün ücretsiz deneme)
   ```

3. Plan kodunu (`PALIMPS_PREMIUM_MONTHLY`) backend kodunda kullanın

---

## Webhook Kurulumu

### 1. Webhook URL'i Belirleme

Backend'inizin webhook endpoint'i:
```
https://3000-xxx.manus.computer/api/trpc/subscriptions.iyzicoWebhook
```

### 2. iyzico Merchant Panel'de Webhook Ayarlama

1. **Ayarlar** > **Webhook Ayarları**
2. **Webhook URL**: Yukarıdaki URL'i girin
3. **Webhook Olayları**: Şunları seçin:
   - Abonelik Başlatıldı
   - Abonelik Yenilendi
   - Abonelik İptal Edildi
   - Abonelik Süresi Doldu
4. **Kaydet**

### 3. Webhook Test Etme

Merchant panel'den **Test Webhook** butonuna tıklayarak test edin.

---

## Test Etme

### Test Kartları (Sandbox)

| Kart Numarası | Son Kullanma | CVC | Sonuç |
|---------------|--------------|-----|-------|
| 5528 7900 0000 0001 | 12/30 | 123 | Başarılı |
| 5528 7900 0000 0019 | 12/30 | 123 | Başarısız |
| 4603 4504 5000 0005 | 12/30 | 123 | 3D Secure |

### Test Adımları

1. **Sandbox Mode Aktif**: `.env` dosyasında sandbox URL'i kullanın
2. **Test Kartı ile Ödeme**: Yukarıdaki test kartlarından birini kullanın
3. **3D Secure**: Test 3D Secure şifresi genelde `123456`
4. **Webhook Kontrolü**: iyzico merchant panel'den webhook loglarını kontrol edin
5. **Premium Aktif mi?**: Uygulamada premium özelliklerin açıldığını kontrol edin

### Test Checklist

- [ ] Test kartı ile başarılı ödeme
- [ ] 3D Secure akışı çalışıyor
- [ ] Webhook geldi ve premium aktif oldu
- [ ] Premium badge görünüyor
- [ ] AI not oluşturma çalışıyor
- [ ] Abonelik iptal ediliyor
- [ ] İptal sonrası premium kapanıyor

---

## Canlıya Alma

### 1. Production API Anahtarları

iyzico hesabınız onaylandıktan sonra:

1. **Ayarlar** > **API & Güvenlik**
2. **Production** sekmesine geçin
3. API Key ve Secret Key'i kopyalayın

### 2. Environment Variables Güncelleme

`.env` dosyasını güncelleyin:

```env
# Production
IYZICO_API_KEY=your-production-api-key
IYZICO_SECRET_KEY=your-production-secret-key
IYZICO_BASE_URL=https://api.iyzipay.com
```

### 3. Webhook URL Güncelleme

Production domain'inizi iyzico merchant panel'de güncelleyin:
```
https://your-production-domain.com/api/trpc/subscriptions.iyzicoWebhook
```

### 4. Yasal Gereklilikler

- [ ] **Mesafeli Satış Sözleşmesi**: Hazırlayın ve uygulamaya ekleyin
- [ ] **Gizlilik Politikası**: KVKK uyumlu hazırlayın
- [ ] **Kullanım Şartları**: Abonelik iptal koşullarını belirtin
- [ ] **Cayma Hakkı**: 14 gün içinde cayma hakkı tanıyın
- [ ] **E-Fatura**: iyzico otomatik e-fatura keser, kontrol edin

### 5. App Store / Play Store

Uygulama açıklamasına ekleyin:
```
Ödeme: iyzico güvenli ödeme altyapısı ile 3D Secure
Abonelik: Aylık ₺149.99, istediğiniz zaman iptal edebilirsiniz
```

---

## SSS ve Sorun Giderme

### S: iyzico hesabım neden onaylanmadı?
**C**: Eksik belge olabilir. Merchant panel'den "Belgeler" bölümünü kontrol edin ve eksik belgeleri yükleyin.

### S: Test kartı ile ödeme başarısız oluyor
**C**: Sandbox mode aktif mi kontrol edin. `.env` dosyasında `IYZICO_BASE_URL=https://sandbox-api.iyzipay.com` olmalı.

### S: 3D Secure ekranı açılmıyor
**C**: iyzico test ortamında 3D Secure bazen atlanır. Production'da her zaman çalışır.

### S: Webhook gelmiyor
**C**: 
1. Webhook URL'i doğru mu kontrol edin
2. Backend sunucunuz erişilebilir mi test edin
3. iyzico merchant panel'den webhook loglarını kontrol edin

### S: Abonelik iptal edilmiyor
**C**: `iyzicoSubscriptionRef` doğru kaydedilmiş mi kontrol edin. Database'de kullanıcının subscription ref'i olmalı.

### S: Komisyon oranları yüksek geldi
**C**: iyzico ile görüşerek özel fiyatlandırma talep edebilirsiniz (işlem hacmi yüksekse).

---

## Destek ve Kaynaklar

### iyzico
- **Dokümantasyon**: https://dev.iyzipay.com
- **Merchant Panel**: https://merchant.iyzipay.com
- **Destek**: destek@iyzico.com
- **Telefon**: 0850 222 0 999

### PALIMPS
- Backend kodu: `server/iyzico.ts` ve `server/routers.ts`
- Frontend kodu: `components/iyzico-payment-form.tsx` ve `app/premium.tsx`

---

## Özet

✅ **Tamamlanması Gerekenler**:
1. iyzico hesabı aç ve onay al (1-3 gün)
2. Backend'e iyzico SDK kur ve entegre et
3. Frontend'e ödeme formu ekle
4. iyzico merchant panel'de abonelik planı oluştur
5. Webhook kurulumu yap
6. Test kartları ile test et
7. Production'a geç ve canlıya al

**Tahmini Süre**: 2-3 gün (iyzico onayı dahil)

**Maliyet**: Komisyon bazlı, sabit ücret yok (başlangıç paketi)

İyi şanslar! 🚀
