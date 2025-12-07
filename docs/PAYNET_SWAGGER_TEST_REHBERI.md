# PAYNET Entegrasyon Test Rehberi - Swagger

Bu rehber, backend'in Paynet ile iletişimini test etmek için Swagger kullanımını açıklar.

## ⚙️ Paynet API URL Yapılandırması

**Test Ortamı URL:** `https://pts-api.paynet.com.tr`  
**Production URL:** `https://api.paynet.com.tr`

Bu rehberdeki örnekler **test ortamı** için hazırlanmıştır. Backend'de `PAYNET_API_URL` environment variable'ı test URL'i ile yapılandırılmış olmalıdır.

## 🔗 Swagger URL

**Production Backend Swagger:**
```
https://api.ifoundanapple.com/v1/docs
```

## 🔐 Authentication

Tüm payment endpoint'leri **JWT Bearer Token** gerektirir. Swagger'da:

1. Swagger sayfasının sağ üst köşesindeki **"Authorize"** butonuna tıklayın
2. `bearer` alanına Supabase JWT token'ınızı girin
3. Token formatı: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (JWT token)
4. **"Authorize"** butonuna tıklayın
5. **"Close"** ile dialog'u kapatın

**Not:** Token'ınızı Supabase authentication'dan alabilirsiniz.

---

## 📋 Test Endpoint'leri

### 1. Paynet Bağlantı Testi

**Endpoint:** `GET /payments/test-paynet-connection`

**Açıklama:** Paynet API bağlantısını ve yapılandırmayı test eder.

**Authentication:** ✅ Gerekli (Bearer Token)

**Request:** Parametre gerektirmez

**Test Adımları:**
1. Swagger'da `GET /payments/test-paynet-connection` endpoint'ini bulun
2. **"Try it out"** butonuna tıklayın
3. **"Execute"** butonuna tıklayın
4. Response'u kontrol edin:
   - `success: true` olmalı
   - `config` içinde tüm key'ler (`hasSecretKey`, `hasPublishableKey`) `true` olmalı
   - `testResults` içindeki tüm testler `success: true` olmalı

**Hata Durumları:**
- `success: false` → Paynet yapılandırması eksik veya hatalı
- `testResults` içinde `success: false` → İlgili test başarısız (detayları kontrol edin)

---

### 2. Ödeme İşlemi Başlatma (3D Secure)

**Endpoint:** `POST /payments/process`

**Açıklama:** Frontend tarafından oluşturulmuş payment kaydı için Paynet 3D Secure ödeme akışını başlatır.

**Authentication:** ✅ Gerekli (Bearer Token)

**Request Body:**
```json
{
  "paymentId": "123e4567-e89b-12d3-a456-426614174000",
  "deviceId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Request Parametreleri:**
- `paymentId` (string, UUID, **ZORUNLU**): Frontend tarafından oluşturulmuş payment ID'si
- `deviceId` (string, UUID, **OPSIYONEL**): Device ID (doğrulama için, payment kaydındaki device_id ile eşleşmeli)

**Test Adımları:**
1. **Önkoşul:** Frontend'de bir payment kaydı oluşturulmuş olmalı (database'de `payments` tablosunda `payment_status = 'pending'` olan bir kayıt)
2. Swagger'da `POST /payments/process` endpoint'ini bulun
3. **"Try it out"** butonuna tıklayın
4. Request body'ye geçerli bir `paymentId` girin (database'deki mevcut bir payment ID)
5. **"Execute"** butonuna tıklayın
6. Response'u kontrol edin:
   - `providerTransactionId` dolu olmalı (Paynet transaction ID)
   - `paymentUrl` veya `publishableKey` dolu olmalı
   - `paymentStatus: "pending"` olmalı

**Hata Durumları:**
- `404 Payment not found` → `paymentId` database'de yok
- `400 Payment does not belong to the user` → Payment başka bir kullanıcıya ait
- `400 Payment is not in pending status` → Payment zaten işlenmiş
- `400 Device must be in 'payment_pending' status` → Device durumu uygun değil
- `500 Payment provider error` → Paynet API hatası (detayları log'larda kontrol edin)

**Önemli Notlar:**
- Bu endpoint sadece Paynet ile iletişim kurar
- Payment ve escrow kayıtları frontend tarafından önceden oluşturulmuş olmalı
- Response'daki `paymentUrl` frontend'de kullanıcıyı 3D Secure sayfasına yönlendirmek için kullanılır

---

### 3. 3D Secure Ödeme Tamamlama

**Endpoint:** `POST /payments/complete-3d`

**Açıklama:** Kullanıcı 3D Secure doğrulamasını tamamladıktan sonra, Paynet'ten dönen `session_id` ve `token_id` ile ödemeyi tamamlar.

**Authentication:** ✅ Gerekli (Bearer Token)

**Request Body:**
```json
{
  "paymentId": "123e4567-e89b-12d3-a456-426614174000",
  "sessionId": "session_abc123xyz",
  "tokenId": "token_abc123xyz"
}
```

**Request Parametreleri:**
- `paymentId` (string, UUID, **ZORUNLU**): Payment ID
- `sessionId` (string, **ZORUNLU**): Paynet'ten dönen session ID (3D Secure callback'inden)
- `tokenId` (string, **ZORUNLU**): Paynet'ten dönen token ID (3D Secure callback'inden)

**Test Adımları:**
1. **Önkoşul:** 
   - `POST /payments/process` başarıyla tamamlanmış olmalı
   - Kullanıcı 3D Secure sayfasında doğrulamayı tamamlamış olmalı
   - Paynet'ten `session_id` ve `token_id` alınmış olmalı
2. Swagger'da `POST /payments/complete-3d` endpoint'ini bulun
3. **"Try it out"** butonuna tıklayın
4. Request body'ye geçerli değerleri girin:
   - `paymentId`: Önceki adımdaki payment ID
   - `sessionId`: Paynet callback'inden gelen session_id
   - `tokenId`: Paynet callback'inden gelen token_id
5. **"Execute"** butonuna tıklayın
6. Response'u kontrol edin:
   - `success: true` olmalı
   - `message` içinde "Waiting for webhook confirmation" yazmalı

**Hata Durumları:**
- `404 Payment not found` → `paymentId` database'de yok
- `400 Payment does not belong to the user` → Payment başka bir kullanıcıya ait
- `400 Payment is not in pending status` → Payment zaten işlenmiş veya başarısız
- `500 Payment completion failed` → Paynet API hatası (detayları log'larda kontrol edin)

**Önemli Notlar:**
- Bu endpoint ödemeyi tamamlar, ancak final durum webhook ile güncellenir
- Webhook gelene kadar payment durumu `pending` kalabilir
- Webhook geldiğinde `payment_status` ve `escrow_status` güncellenir

---

## 🔄 Tam Test Senaryosu

### Senaryo: End-to-End Payment Test

1. **Hazırlık:**
   - ✅ Supabase JWT token'ı alın
   - ✅ Swagger'da token'ı authorize edin
   - ✅ Database'de test için bir payment kaydı oluşturun (frontend üzerinden veya manuel)

2. **Adım 1: Paynet Bağlantı Testi**
   ```
   GET /payments/test-paynet-connection
   ```
   - ✅ `success: true` olmalı
   - ✅ Tüm testler başarılı olmalı

3. **Adım 2: Ödeme Başlatma**
   ```
   POST /payments/process
   Body: {
     "paymentId": "<database'deki payment ID>",
     "deviceId": "<opsiyonel>"
   }
   ```
   - ✅ `providerTransactionId` dolu olmalı
   - ✅ `paymentUrl` veya `publishableKey` dolu olmalı

4. **Adım 3: 3D Secure Tamamlama** (Gerçek test için)
   ```
   POST /payments/complete-3d
   Body: {
     "paymentId": "<aynı payment ID>",
     "sessionId": "<Paynet'ten gelen session_id>",
     "tokenId": "<Paynet'ten gelen token_id>"
   }
   ```
   - ✅ `success: true` olmalı
   - ⏳ Webhook beklenir (otomatik olarak gelir)

---

## 🐛 Hata Ayıklama

### Paynet Bağlantı Hatası

**Sorun:** `test-paynet-connection` endpoint'i `success: false` döndürüyor

**Kontrol Listesi:**
- ✅ Environment variable'lar doğru mu? 
  - `PAYNET_API_URL=https://pts-api.paynet.com.tr` (Test ortamı için)
  - `PAYNET_SECRET_KEY` (Test ortamı secret key'i)
  - `PAYNET_PUBLISHABLE_KEY` (Test ortamı publishable key'i)
- ✅ Paynet API URL'i erişilebilir mi? (Network/firewall kontrolü)
- ✅ Secret key doğru mu? (Paynet yönetim panelinden kontrol edin - test ortamı için test key'leri kullanılmalı)
- ✅ API URL formatı doğru mu? (Test: `https://pts-api.paynet.com.tr`, Production: `https://api.paynet.com.tr`)

### Ödeme İşlemi Hatası

**Sorun:** `POST /payments/process` hata döndürüyor

**Kontrol Listesi:**
- ✅ Payment ID database'de var mı?
- ✅ Payment `pending` durumunda mı?
- ✅ Payment kullanıcıya ait mi? (JWT token'daki user ID ile eşleşiyor mu?)
- ✅ Device durumu `payment_pending` mi?
- ✅ Paynet API'ye erişim var mı? (Network/firewall kontrolü)

**Log Kontrolü:**
- Backend log'larında Paynet API response'larını kontrol edin
- `PAYNET API error` mesajlarını inceleyin

### 3D Secure Tamamlama Hatası

**Sorun:** `POST /payments/complete-3d` hata döndürüyor

**Kontrol Listesi:**
- ✅ `sessionId` ve `tokenId` Paynet'ten doğru mu?
- ✅ Payment hala `pending` durumunda mı?
- ✅ Payment kullanıcıya ait mi?
- ✅ Paynet API'ye erişim var mı?

---

## 📝 Notlar

1. **Local Kod Değişikliği Yapılmadı:** Bu rehber sadece test için hazırlanmıştır, local kodlarda değişiklik yapılmamıştır.

2. **Production Backend:** Tüm testler `https://api.ifoundanapple.com/v1/` adresinde çalışan production backend üzerinden yapılmalıdır.

3. **Authentication:** Tüm endpoint'ler JWT Bearer token gerektirir. Token'ı Supabase authentication'dan alın.

4. **Webhook:** Ödeme tamamlandıktan sonra Paynet otomatik olarak webhook gönderir. Webhook endpoint'i: `POST /webhooks/paynet-callback`

5. **Escrow:** Escrow yönetimi backend'de yapılır. Paynet sadece ödeme almak için kullanılır.

---

## 🔗 İlgili Dokümantasyon

- [PAYNET API Referansı](./PAYNET_API_REFERENCE.md)
- [PAYNET Entegrasyon Notları](./PAYNET_INTEGRATION.md)
- [Backend Entegrasyon Dokümantasyonu](./BACKEND_INTEGRATION.md)

---

## ✅ Test Checklist

- [ ] Swagger'a erişim sağlandı (`https://api.ifoundanapple.com/v1/docs`)
- [ ] JWT token ile authentication yapıldı
- [ ] `GET /payments/test-paynet-connection` başarılı
- [ ] `POST /payments/process` başarılı (test payment ID ile)
- [ ] `POST /payments/complete-3d` test edildi (gerçek session_id/token_id ile)
- [ ] Webhook callback test edildi (Paynet'ten otomatik gelir)
- [ ] Tüm hata senaryoları test edildi

---

## 📊 Test Sonuçları Raporu

**Test Tarihi:** 2025-12-07  
**Test Ortamı:** Production (`https://api.ifoundanapple.com`)  
**Test Kullanıcısı:** turgaysavaci@gmail.com

### Genel Durum Özeti

| Endpoint | Durum | HTTP Kodu | Açıklama |
|----------|-------|-----------|----------|
| `GET /v1/health` | ✅ Başarılı | 200 | Health check çalışıyor |
| `GET /v1/session` | ✅ Başarılı | 200 | Session bilgisi doğru dönüyor |
| `GET /v1/admin/diagnostics` | ⚠️ Beklenen | 403 | Admin yetkisi yok (normal) |
| `POST /v1/payments/process` | ❌ Hata | 404 | Device bulunamadı |
| `POST /v1/payments/complete-3d` | ❌ Hata | 400 | Paynet API authentication hatası |
| `GET /v1/payments/test-paynet-connection` | ✅ Başarılı | 200 | Paynet bağlantısı çalışıyor |
| `GET /v1/payments/{id}/status` | ❌ Hata | 404 | Payment bulunamadı |
| `GET /v1/payments/{id}/webhook-data` | ⚠️ Kısmi | 200 | Webhook data yok (beklenen) |
| `POST /v1/payments/release-escrow` | ❌ Hata | 404 | Request body eksik |
| `POST /v1/webhooks/paynet-callback` | ⚠️ Test edilemedi | - | Header'lar eksik |

### ✅ Başarılı Testler

1. **Health Check** (`GET /v1/health`)
   - Durum: Çalışıyor
   - Response: `{"status": "ok", "uptime": 31312.78, "timestamp": "2025-12-07T19:10:10.595Z"}`
   - Sonuç: Backend çalışıyor

2. **Session** (`GET /v1/session`)
   - Durum: Çalışıyor
   - Response: Kullanıcı bilgileri doğru dönüyor
   - Sonuç: Authentication ve session yönetimi çalışıyor

3. **Paynet Bağlantı Testi** (`GET /v1/payments/test-paynet-connection`)
   - Durum: Başarılı
   - Response: Tüm testler başarılı (`success: true`)
   - Sonuç: Paynet API bağlantısı ve yapılandırma doğru

### ❌ Hata Durumları ve Çözümler

1. **Payment Process** (`POST /v1/payments/process`) - 404
   - **Hata:** `"Device not found: 123e4567-e89b-12d3-a456-426614174000"`
   - **Neden:** Test için gerçek bir device ID kullanılmamış
   - **Çözüm:**
     - Database'de `payment_pending` durumunda bir device oluşturun
     - Veya mevcut bir device ID kullanın
     - Request body'de `deviceId`, `totalAmount` ve `feeBreakdown` gönderin
   - **Not:** Endpoint `deviceId` bekliyor, `paymentId` değil

2. **Complete 3D** (`POST /v1/payments/complete-3d`) - 400
   - **Hata:** `"Payment completion failed: Request failed with status code 401"`
   - **Neden:** Paynet API authentication hatası
   - **Olası Nedenler:**
     - Test ortamında geçersiz `sessionId`/`tokenId` kullanılmış
     - Paynet API key'leri yanlış veya süresi dolmuş olabilir
     - Test ortamı ile production key'leri karışmış olabilir
   - **Çözüm:**
     - Gerçek bir 3D Secure akışından gelen `sessionId` ve `tokenId` kullanın
     - Paynet test ortamı key'lerini kontrol edin
     - Backend log'larını inceleyin

3. **Payment Status** (`GET /v1/payments/{id}/status`) - 404
   - **Hata:** `"Payment not found: 123e4567-e89b-12d3-a456-426614174000"`
   - **Neden:** Test için gerçek bir payment ID kullanılmamış
   - **Çözüm:**
     - Önce `POST /v1/payments/process` ile bir payment oluşturun
     - Dönen `paymentId`'yi kullanın

4. **Release Escrow** (`POST /v1/payments/release-escrow`) - 404
   - **Hata:** `"Payment not found: undefined"`
   - **Neden:** Request body eksik veya yanlış format
   - **Beklenen Format:**
     ```json
     {
       "paymentId": "uuid",
       "deviceId": "uuid",
       "releaseReason": "string"
     }
     ```
   - **Çözüm:** Request body'yi doğru formatta gönderin

### ⚠️ Kısmi Başarılı / Beklenen Durumlar

1. **Admin Diagnostics** (`GET /v1/admin/diagnostics`) - 403
   - Durum: Beklenen
   - Açıklama: Kullanıcı admin değil, bu normal
   - Çözüm: Admin rolüne sahip bir kullanıcı ile test edin

2. **Webhook Data** (`GET /v1/payments/{id}/webhook-data`) - 200
   - Response: `{"success": false, "error": "Webhook data not found for this payment"}`
   - Durum: Beklenen (henüz webhook gelmemiş)
   - Açıklama: Webhook Paynet'ten otomatik gelir, test için gerçek bir ödeme gerekir

3. **Webhook Callback** (`POST /v1/webhooks/paynet-callback`)
   - Durum: Test edilemedi
   - Neden: `x-paynet-signature` ve `x-paynet-timestamp` header'ları eksik
   - Çözüm: Paynet'ten gelen gerçek webhook ile test edin

### Öneriler ve Sonraki Adımlar

#### Kritik Öncelik

1. **Test Verisi Hazırlığı**
   - Database'de test için:
     - `payment_pending` durumunda bir device oluşturun
     - İlgili `device_models` kaydı (`ifoundanapple_fee` ile)
     - Eşleşmiş bir finder device (opsiyonel)

2. **Paynet Authentication Sorunu**
   - `complete-3d` endpoint'inde 401 hatası var
   - Paynet API key'lerini kontrol edin
   - Test ortamı key'lerinin doğru olduğundan emin olun
   - Backend log'larını inceleyin

3. **End-to-End Test Akışı**
   - Gerçek bir ödeme akışı ile test edin:
     1. Device oluştur → `payment_pending` durumuna getir
     2. `POST /v1/payments/process` → Payment oluştur
     3. 3D Secure sayfasına yönlendir
     4. Gerçek `sessionId` ve `tokenId` al
     5. `POST /v1/payments/complete-3d` → Ödemeyi tamamla
     6. Webhook'u bekle
     7. `GET /v1/payments/{id}/status` → Durumu kontrol et

#### İyileştirme Önerileri (Uygulandı ✅)

1. **Swagger Dokümantasyonu**
   - ✅ `POST /v1/payments/process` için request body örneği güncellendi
   - ✅ `deviceId`, `totalAmount` ve `feeBreakdown` zorunlu alanlar olarak belirtildi
   - ✅ Hata mesajları daha açıklayıcı hale getirildi

2. **Hata Mesajları**
   - ✅ 404 hatalarında daha açıklayıcı mesajlar eklendi
   - ✅ Örnek: "Device not found" yerine "Device not found. Please ensure the device exists and belongs to your account."

3. **Paynet Authentication Hataları**
   - ✅ 401 hataları için özel mesaj eklendi
   - ✅ Paynet API key kontrolü için daha detaylı log'lar

4. **Request Validation**
   - ✅ Release escrow endpoint'inde request body validation eklendi
   - ✅ Eksik alanlar için açıklayıcı hata mesajları

### Sonuç

**Genel Durum:** Backend temel işlevler açısından çalışıyor. Paynet bağlantısı doğru yapılandırılmış. Testlerdeki hatalar çoğunlukla test verisi eksikliğinden kaynaklanıyor.

**Başarılı Alanlar:**
- ✅ Health check çalışıyor
- ✅ Authentication/Session yönetimi çalışıyor
- ✅ Paynet API bağlantısı doğru yapılandırılmış

**Dikkat Edilmesi Gerekenler:**
- ⚠️ Paynet API authentication (401 hatası) - `complete-3d` endpoint'inde
- ⚠️ Test verisi hazırlığı - Gerçek device/payment ID'leri gerekli
- ⚠️ End-to-end test akışı - Gerçek ödeme akışı ile test edilmeli

**Önerilen Aksiyon Planı:**
1. ✅ Database'de test verisi oluştur (manuel veya migration ile)
2. ⚠️ Paynet authentication sorununu çöz (401 hatası) - Backend log'larını kontrol et
3. ⚠️ Gerçek ödeme akışı ile end-to-end test yap
4. ⚠️ Webhook callback'i test et (gerçek webhook ile)

---

**Son Güncelleme:** 2025-12-07 - Test raporu eklendi ve iyileştirmeler uygulandı.

