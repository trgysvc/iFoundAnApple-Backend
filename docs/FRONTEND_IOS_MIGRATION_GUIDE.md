# Frontend/iOS Migration Guide - Veritabanı Yazma İşlemlerinin Backend'e Taşınması

Bu doküman, backend'de yapılan mimari değişikliklerin frontend ve iOS projelerine nasıl yansıtılacağını açıklar.

## 📋 Özet

**Ana Değişiklik:** Tüm ödeme ile ilgili veritabanı yazma işlemleri artık backend tarafından yapılıyor. Frontend/iOS sadece backend'den sonuç alıp kullanıcıya gösteriyor.

## ❌ Kaldırılması Gereken Kodlar

### 1. Ödeme Süreci - Veritabanı Yazma İşlemleri

#### Kaldırılacak Kodlar:
```typescript
// ❌ KALDIRILACAK - Payment kaydı oluşturma
await supabase.from('payments').insert({...});

// ❌ KALDIRILACAK - Escrow kaydı oluşturma  
await supabase.from('escrow_accounts').insert({...});

// ❌ KALDIRILACAK - Device status güncelleme (ödeme sonrası)
await supabase.from('devices').update({status: 'payment_completed'}).eq('id', deviceId);

// ❌ KALDIRILACAK - Audit log oluşturma (ödeme ile ilgili)
await supabase.from('audit_logs').insert({...});

// ❌ KALDIRILACAK - Notification oluşturma (ödeme ile ilgili)
await supabase.from('notifications').insert({...});
```

### 2. Webhook Data Çekme ve İşleme

#### Kaldırılacak Kodlar:
```typescript
// ❌ KALDIRILACAK - Webhook data'yı çekip veritabanına yazma
const webhookData = await fetch(`/v1/payments/${paymentId}/webhook-data`);
const data = await webhookData.json();

// Artık buna gerek yok - Backend zaten tüm kayıtları oluşturdu
await supabase.from('payments').update({...});
await supabase.from('escrow_accounts').insert({...});
```

## ✅ Yapılması Gereken Değişiklikler

### 1. Ödeme Başlatma (`POST /v1/payments/process`)

#### Öncesi:
```typescript
// Frontend/iOS önce payment kaydı oluşturuyordu
const payment = await supabase.from('payments').insert({...});

// Sonra backend'e istek gönderiyordu
const response = await fetch('/v1/payments/process', {...});
```

#### Sonrası:
```typescript
// ✅ Sadece backend'e istek gönder
const response = await fetch('/v1/payments/process', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    deviceId: deviceId,
    totalAmount: totalAmount,
    feeBreakdown: feeBreakdown, // Frontend/iOS hesaplar, backend validate eder
  }),
});

const paymentData = await response.json();
// paymentData.id artık backend'den gelen payment ID
// Backend zaten veritabanına yazdı (status='pending')
```

**Önemli:** 
- `deviceId` ve `feeBreakdown`'ı localStorage/UserDefaults'a kaydetmeye devam edebilirsiniz (kullanıcı deneyimi için)
- Ama artık veritabanına yazma ihtiyacı yok

### 2. 3D Secure Tamamlama (`POST /v1/payments/complete-3d`)

#### Öncesi:
```typescript
// Frontend/iOS payment kaydını güncelliyordu
await supabase.from('payments').update({...}).eq('id', paymentId);
```

#### Sonrası:
```typescript
// ✅ Sadece backend'e 3D Secure sonucunu gönder
const response = await fetch('/v1/payments/complete-3d', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    paymentId: paymentId,
    sessionId: sessionId,
    tokenId: tokenId,
  }),
});

// Backend Paynet API'ye gönderir, veritabanına yazmaz (webhook bekler)
```

### 3. Payment Status Kontrolü (`GET /v1/payments/{paymentId}/status`)

#### Öncesi:
```typescript
// Frontend/iOS webhook gelip gelmediğini kontrol ediyordu
const status = await fetch(`/v1/payments/${paymentId}/status`);
const data = await status.json();

if (data.webhookReceived) {
  // Webhook data'yı çekiyordu
  const webhookData = await fetch(`/v1/payments/${paymentId}/webhook-data`);
  
  // Sonra veritabanına yazıyordu
  await supabase.from('payments').update({...});
  await supabase.from('escrow_accounts').insert({...});
  // ...
}
```

#### Sonrası:
```typescript
// ✅ Sadece status kontrolü yap
const statusResponse = await fetch(`/v1/payments/${paymentId}/status`, {
  headers: {
    'Authorization': `Bearer ${token}`,
  },
});

const statusData = await statusResponse.json();

// Backend artık veritabanından okuyor, tüm bilgiler burada
if (statusData.paymentStatus === 'completed') {
  // ✅ Sadece kullanıcıya göster, veritabanına yazma!
  navigate('/payment-success');
}

// Polling yaparken:
// - paymentStatus: 'pending' | 'completed' | 'failed'
// - escrowStatus: 'pending' | 'held' | 'released'
// - webhookReceived: true/false (artık sadece bilgilendirme amaçlı)
// - deviceId, totalAmount artık response'ta geliyor
```

### 4. Webhook Data Çekme (`GET /v1/payments/{paymentId}/webhook-data`)

#### Öncesi:
```typescript
// Webhook data'yı çekip veritabanına yazıyordu
const webhookData = await fetch(`/v1/payments/${paymentId}/webhook-data`);
const data = await webhookData.json();

// Veritabanı kayıtlarını oluşturuyordu
await supabase.from('payments').update({...});
await supabase.from('escrow_accounts').insert({...});
```

#### Sonrası:
```typescript
// ✅ Bu endpoint artık OPSIYONEL
// Backend zaten tüm kayıtları oluşturdu
// Sadece webhook detaylarını görüntülemek için kullanılabilir

// Veya hiç kullanmayın - status endpoint'i yeterli
const statusData = await fetch(`/v1/payments/${paymentId}/status`);
// Tüm bilgiler burada
```

### 5. Escrow Serbest Bırakma (`POST /v1/payments/release-escrow`)

#### Öncesi:
```typescript
// Frontend/iOS escrow release sonrası veritabanını güncelliyordu
const releaseResponse = await fetch('/v1/payments/release-escrow', {...});

if (releaseResponse.success) {
  await supabase.from('escrow_accounts').update({status: 'released'}).eq('payment_id', paymentId);
  await supabase.from('devices').update({status: 'completed'}).eq('id', deviceId);
  // ...
}
```

#### Sonrası:
```typescript
// ✅ Sadece backend'e istek gönder
const releaseResponse = await fetch('/v1/payments/release-escrow', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    paymentId: paymentId,
    deviceId: deviceId,
    releaseReason: 'Device received and confirmed by owner',
  }),
});

if (releaseResponse.success) {
  // ✅ Backend zaten tüm veritabanı güncellemelerini yaptı
  // Sadece kullanıcıya göster
  showSuccessMessage('Escrow released successfully');
}
```

## 📊 Veritabanı Okuma İşlemleri

**ÖNEMLİ:** Frontend/iOS hala veritabanından **OKUMA** yapabilir. Sadece **YAZMA** işlemleri kaldırıldı.

### Devam Eden Okuma İşlemleri:
```typescript
// ✅ OK - Device bilgilerini okuma
const { data: device } = await supabase
  .from('devices')
  .select('*')
  .eq('id', deviceId)
  .single();

// ✅ OK - Payment bilgilerini okuma
const { data: payment } = await supabase
  .from('payments')
  .select('*')
  .eq('id', paymentId)
  .single();

// ✅ OK - Escrow bilgilerini okuma
const { data: escrow } = await supabase
  .from('escrow_accounts')
  .select('*')
  .eq('payment_id', paymentId)
  .single();
```

## 🔄 Polling Mekanizması

### Öncesi:
```typescript
// WebhookReceived kontrolü yapıyordu
if (status.webhookReceived) {
  // Webhook data çekip veritabanına yazıyordu
}
```

### Sonrası:
```typescript
// ✅ Sadece paymentStatus kontrolü yap
const checkStatus = async () => {
  const response = await fetch(`/v1/payments/${paymentId}/status`);
  const data = await response.json();
  
  if (data.paymentStatus === 'completed') {
    // ✅ Ödeme başarılı - Backend zaten tüm kayıtları oluşturdu
    navigate('/payment-success');
  } else if (data.paymentStatus === 'failed') {
    // ✅ Ödeme başarısız
    showError('Payment failed');
  } else {
    // Polling devam et
    setTimeout(checkStatus, 10000);
  }
};
```

## 📝 Önemli Notlar

### 1. localStorage/UserDefaults Kullanımı
- `deviceId` ve `feeBreakdown`'ı kaydetmeye devam edebilirsiniz
- Ama artık veritabanı yazma ihtiyacı yok
- Sadece kullanıcı deneyimi için (sayfa yenilemesinde bilgi kaybını önlemek)

### 2. Supabase Realtime
- Hala kullanabilirsiniz - veritabanı değişikliklerini dinlemek için
- Backend veritabanına yazdığında Realtime ile bildirim alırsınız
- Örnek: Payment status değiştiğinde anında güncelleme

### 3. Hata Yönetimi
```typescript
// ✅ Backend'den gelen hata mesajlarını kullan
if (!response.ok) {
  const error = await response.json();
  showError(error.message); // Backend'den gelen hata mesajı
}
```

## 🎯 Checklist

Frontend/iOS revizyonu için kontrol listesi:

- [ ] `POST /v1/payments/process` - Payment kaydı oluşturma kodu kaldırıldı
- [ ] `POST /v1/payments/complete-3d` - Payment güncelleme kodu kaldırıldı
- [ ] `GET /v1/payments/{paymentId}/status` - Artık veritabanından okuyor, doğru kullanılıyor
- [ ] `GET /v1/payments/{paymentId}/webhook-data` - Kullanılmıyor veya sadece görüntüleme amaçlı
- [ ] Webhook geldiğinde veritabanına yazma kodu kaldırıldı
- [ ] Escrow release sonrası veritabanı güncelleme kodu kaldırıldı
- [ ] Device status güncelleme (ödeme sonrası) kodu kaldırıldı
- [ ] Audit log oluşturma (ödeme ile ilgili) kodu kaldırıldı
- [ ] Notification oluşturma (ödeme ile ilgili) kodu kaldırıldı
- [ ] Polling mekanizması güncellendi (paymentStatus kontrolü)
- [ ] Hata yönetimi backend hata mesajlarını kullanıyor
- [ ] localStorage/UserDefaults sadece UX için kullanılıyor (veritabanı değil)

## 📚 Referans Dokümanlar

1. **BACKEND_INTEGRATION.md** - API endpoint'lerinin detaylı açıklamaları
2. **PROCESS_FLOW.md** - Tam süreç akışı ve veritabanı işlemleri
3. **PAYNET_INTEGRATION.md** - Paynet entegrasyonu detayları
4. **PROJECT_DESIGN_DOCUMENTATION.md** - Mimari prensipler

## 🆘 Sorun Giderme

### Problem: "Payment not found" hatası
**Çözüm:** Backend artık payment kaydını başlatma sırasında oluşturuyor. Payment ID'yi backend'den aldığınızdan emin olun.

### Problem: Status güncellenmiyor
**Çözüm:** Backend webhook geldiğinde tüm güncellemeleri yapıyor. Supabase Realtime ile dinleyebilir veya polling yapabilirsiniz.

### Problem: Escrow kaydı oluşmuyor
**Çözüm:** Backend webhook geldiğinde escrow kaydını oluşturuyor. Frontend/iOS'ta escrow oluşturma kodu kaldırılmış olmalı.

## 📞 Destek

Sorularınız için:
- Docs klasöründeki dokümanları inceleyin
- BACKEND_INTEGRATION.md'deki API endpoint açıklamalarına bakın
- PROCESS_FLOW.md'deki süreç akışını kontrol edin

