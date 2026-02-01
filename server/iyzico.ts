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
}): Promise<any> {
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
    (iyzico.subscription as any).create(request, (err: any, result: any) => {
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
export async function cancelSubscription(subscriptionReferenceCode: string): Promise<any> {
  const request = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: `cancel_${Date.now()}`,
    subscriptionReferenceCode,
  };

  return new Promise((resolve, reject) => {
    (iyzico.subscription as any).cancel(request, (err: any, result: any) => {
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
export async function getSubscription(subscriptionReferenceCode: string): Promise<any> {
  const request = {
    locale: Iyzipay.LOCALE.TR,
    conversationId: `query_${Date.now()}`,
    subscriptionReferenceCode,
  };

  return new Promise((resolve, reject) => {
    (iyzico.subscription as any).retrieve(request, (err: any, result: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}
