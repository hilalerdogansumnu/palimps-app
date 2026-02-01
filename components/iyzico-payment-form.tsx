import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { trpc } from '@/lib/trpc';
import * as Haptics from 'expo-haptics';
import { PaymentSuccessScreen } from './payment-success-screen';
import { PaymentErrorScreen } from './payment-error-screen';

interface IyzicoPaymentFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function IyzicoPaymentForm({ onSuccess, onCancel }: IyzicoPaymentFormProps) {
  const colors = useColors();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'form' | 'success' | 'error'>('form');
  const [errorMessage, setErrorMessage] = useState('');

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
      setIsProcessing(false);
      setPaymentStatus('success');
    },
    onError: (error: any) => {
      setIsProcessing(false);
      setErrorMessage(error.message || 'Ödeme işlemi başarısız oldu. Lütfen kart bilgilerinizi kontrol edin.');
      setPaymentStatus('error');
    },
  });

  const handleSubmit = async () => {
    // Validasyon
    if (!cardNumber || !cardHolderName || !expireMonth || !expireYear || !cvc) {
      setErrorMessage('Lütfen tüm kart bilgilerini doldurun.');
      setPaymentStatus('error');
      return;
    }

    if (!phone || !address || !city) {
      setErrorMessage('Lütfen iletişim bilgilerini doldurun.');
      setPaymentStatus('error');
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

  // Başarı ekranı göster
  if (paymentStatus === 'success') {
    return <PaymentSuccessScreen onClose={onSuccess} />;
  }

  // Hata ekranı göster
  if (paymentStatus === 'error') {
    return (
      <PaymentErrorScreen
        errorMessage={errorMessage}
        onRetry={() => {
          setPaymentStatus('form');
          setErrorMessage('');
        }}
        onCancel={onCancel}
      />
    );
  }

  // Form ekranı
  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
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
      </ScrollView>
    </View>
  );
}
