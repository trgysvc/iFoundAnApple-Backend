# PAYNET Entegrasyon Dokümantasyonu

## 📋 İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [PAYNET API Referans](#paynet-api-referans)
3. [Mimari Prensipler](#mimari-prensipler)
4. [Backend API Endpoints](#backend-api-endpoints)
5. [iOS Entegrasyonu](#ios-entegrasyonu)
6. [Webhook İşleme](#webhook-işleme)
7. [Escrow Serbest Bırakma](#escrow-serbest-bırakma)
8. [Hata Senaryoları](#hata-senaryoları)
9. [Güvenlik Kontrolleri](#güvenlik-kontrolleri)
10. [Test Senaryoları](#test-senaryoları)
11. [Implementasyon Kontrol Listesi](#implementasyon-kontrol-listesi)

---

## 🎯 Genel Bakış

Bu dokümantasyon, PAYNET ödeme sürecinin Backend ve iOS platformlarında nasıl çalıştığını açıklar.

### Önemli Notlar

- ✅ **Backend:** PAYNET API ile iletişim kurar ve **tüm veritabanı işlemlerini yapar**
- ✅ **Backend:** Webhook geldiğinde tüm ilgili tablolara (payments, escrow_accounts, devices, audit_logs, notifications) yazar
- ✅ **Frontend/iOS:** Backend'den ödeme sonucunu alır ve **sadece kullanıcıya gösterir** - veritabanına yazmaz
- ✅ **Ödeme Kayıtları:** Backend tarafından webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true) oluşturulur

### Ödeme Akışı Özeti

```
1. Frontend/iOS → Backend: Ödeme başlatma isteği (deviceId, totalAmount, feeBreakdown ile)
2. Backend: Payment ID oluşturur ve veritabanına yazar (payments tablosuna status='pending' ile)
3. Backend → PAYNET: 3D Secure başlatma (is_escrow: true)
4. Kullanıcı → PAYNET: 3D Secure doğrulama
5. PAYNET → Backend: Return URL callback (session_id, token_id)
6. Frontend/iOS → Backend: 3D Secure tamamlama (session_id, token_id)
7. Backend → PAYNET: 3D Secure tamamlama (POST /v2/transaction/tds_charge)
8. PAYNET → Backend: Webhook (ödeme başarılı/başarısız)
9. Backend: Webhook'u doğrular, saklar ve **tüm veritabanı kayıtlarını oluşturur** (payments, escrow_accounts, devices, audit_logs, notifications)
10. Frontend/iOS: Polling yapar (GET /v1/payments/{paymentId}/status)
11. Frontend/iOS: Backend'den ödeme sonucunu alır ve kullanıcıya gösterir
```

---

## 🔌 PAYNET API Referans

### Base URL Yapısı

- **Production**: `https://api.paynet.com.tr/v1`
- **Test**: `https://pts-api.paynet.com.tr/v1`
- **Not**: Tüm endpoint'ler `/v1/` veya `/v2/` prefix'i ile başlar

### Authentication

- **Format**: HTTP Basic Authentication
- **Header**: `Authorization: Basic base64(secret_key:)`
- **Secret Key**: PAYNET yönetim panelinden alınır
- **Kaynak**: [PAYNET Authentication](https://doc.paynet.com.tr/authentication)

**Örnek:**
```javascript
const secretKey = 'your_secret_key';
const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
```

### 3D Secure Payment

#### 3D Ödeme Başlatma

- **Endpoint**: `POST /v2/transaction/tds_initial`
- **URL**: `https://api.paynet.com.tr/v2/transaction/tds_initial`
- **Kaynak**: [3D ile Ödeme](https://doc.paynet.com.tr/oedeme-metotlari/api-entegrasyonu/3d-ile-odeme)

**Request Parameters:**
```json
{
  "amount": "decimal",           // Çekilecek tutar - ZORUNLU
  "reference_no": "string",      // İşleme ait benzersiz referans numarası (Backend'in oluşturduğu payment ID) - ZORUNLU
  "return_url": "string",        // 3D doğrulama sonucunun post edileceği URL - ZORUNLU
  "domain": "string",            // İşlemin yapıldığı uygulamanın domain bilgisi - ZORUNLU
  "is_escrow": "boolean",        // Escrow özelliği (opsiyonel) - true gönderilirse ödeme ana firma onayına tabi olur
  "card_holder": "string",       // Kart sahibi bilgisi (saklı kart kullanılmıyorsa zorunlu)
  "pan": "string",               // Kart numarası (saklı kart kullanılmıyorsa zorunlu)
  "month": "string",             // Son kullanma tarihi ay (MM formatında)
  "year": "string",              // Son kullanma tarihi yıl (YY veya YYYY formatında)
  "cvc": "string",               // CVV/CVC kodu
  "description": "string",       // Opsiyonel
  "instalment": "int",         // Taksit sayısı (opsiyonel) - PAYNET dokümantasyonuna göre "instalment" kullanılır
  "customer_email": "string",    // Opsiyonel
  "customer_name": "string",     // Opsiyonel
  "customer_phone": "string"     // Opsiyonel
}
```

**Önemli Notlar:**
- **Kart Bilgileri:** Kart bilgileri (PAN, ay, yıl, CVC, kart sahibi adı) backend tarafından toplanır ve PAYNET API'sine gönderilir. **Kart bilgileri sistemde veya veritabanında ASLA TUTULMAZ.**
- **return_url:** iOS uygulamaları için backend'de bir callback endpoint'i oluşturulmalıdır. Bu endpoint, 3D Secure sonucunu alır ve frontend/iOS'a bildirir. Örnek: `https://api.ifoundanapple.com/v1/payments/callback`
- **reference_no:** Backend'in oluşturduğu payment ID kullanılır. Bu ID, webhook geldiğinde eşleştirme için kullanılır.

**Response:**
```json
{
  "success": "boolean",
  "transaction_id": "string",
  "session_id": "string",
  "post_url": "string",          // 3D doğrulama sayfası URL'i
  "html_content": "string",      // 3D doğrulama HTML içeriği
  "error": "string",
  "message": "string"
}
```

#### 3D Ödeme Tamamlama

- **Endpoint**: `POST /v2/transaction/tds_charge`
- **URL**: `https://api.paynet.com.tr/v2/transaction/tds_charge`
- **Kaynak**: [3D ile Ödeme](https://doc.paynet.com.tr/oedeme-metotlari/api-entegrasyonu/3d-ile-odeme)

**Request Parameters:**
```json
{
  "session_id": "string",        // 3D ödeme akışının oturum bilgisi - ZORUNLU
  "token_id": "string",          // İşlemin token bilgisi - ZORUNLU
  "transaction_type": "int"      // İşlem tipi: 1 = Satış, 3 = Ön provizyon (varsayılan: 1)
}
```

**Response:**
```json
{
  "success": "boolean",
  "transaction_id": "string",
  "status": "string",
  "error": "string",
  "message": "string"
}
```

**3D Payment Flow:**
1. Backend → PAYNET: `POST /v2/transaction/tds_initial` (kart bilgileri ile)
2. PAYNET → Backend: `post_url` veya `html_content` döner
3. Backend → Frontend/iOS: `post_url` ve `html_content` döner
4. Frontend/iOS → PAYNET: Kullanıcıyı 3D doğrulama sayfasına yönlendirir (`post_url` veya `html_content` kullanarak)
5. Kullanıcı → Bank: 3D Secure doğrulama işlemini tamamlar (SMS kodu girer)
6. Bank → Backend: `return_url`'e `session_id` ve `token_id` POST eder
7. Backend: `session_id` ve `token_id` alır
8. Frontend/iOS → Backend: `POST /v1/payments/complete-3d` ile `session_id` ve `token_id` gönderir
9. Backend → PAYNET: `POST /v2/transaction/tds_charge` ile ödeme tamamlanır
10. PAYNET → Backend: Webhook gönderilir (ödeme başarılı/başarısız)

**Return URL Yapılandırması (iOS için):**
- Backend'de bir callback endpoint'i oluşturulmalıdır: `POST /v1/payments/callback`
- Bu endpoint, PAYNET'ten gelen `session_id` ve `token_id` parametrelerini alır
- Backend, bu parametreleri frontend/iOS'a bildirir (polling veya push notification ile)
- Alternatif olarak, backend bu parametreleri veritabanında saklayabilir ve frontend/iOS polling yaparak alabilir

### Escrow Durum Güncelleme

- **Endpoint**: `POST /v1/transaction/escrow_status_update`
- **URL**: `https://api.paynet.com.tr/v1/transaction/escrow_status_update`
- **Kaynak**: [Escrow Durum Güncelleme](https://doc.paynet.com.tr/servisler/islem/escrow-durum-guncelleme)

**Request Parameters:**
```json
{
  "xact_id": "string",      // PAYNET işlem ID'si (şifrelenmiş) - ZORUNLU
  "xact": "int",            // PAYNET işlem ID'si (şifrelenmemiş) - ZORUNLU (xact_id veya xact en az biri)
  "status": 2,               // 2 = Onay (Release), 3 = Red (Reject) - ZORUNLU
  "note": "string",          // Maksimum 256 karakter - OPSIYONEL
  "agent_id": "string",     // Bayi kodu - OPSIYONEL
  "agent_amount": "decimal" // Bayiye aktarılacak tutar - OPSIYONEL
}
```

**Status Values:**
- `2`: Onay (Approve/Release) - Escrow serbest bırakılır
- `3`: Red (Reject) - Escrow reddedilir, ödeme iade edilir

**Önemli Notlar:**
- PAYNET'in escrow özelliği **VAR** ve backend'den `is_escrow: true` parametresi ile aktif edilir
- Escrow yönetimi PAYNET tarafında yapılır
- Backend, escrow durumunu PAYNET API üzerinden yönetir

### Webhook Format (confirmation_url)

- **Endpoint**: Backend'de tanımlı: `POST /v1/webhooks/paynet-callback`
- **URL**: PAYNET yönetim panelinde `confirmation_url` olarak ayarlanır
- **Method**: POST
- **Content-Type**: application/json
- **Kaynak**: [Confirmation URL Parametreleri](https://doc.paynet.com.tr/oedeme-metotlari/ortak-odeme-sayfasi/odeme-emri-olusturma/confirmation-url-adresine-post-edilen-parametreler)

**Webhook Payload Structure:**
```json
{
  "reference_no": "string",        // Ödeme işleminin referans numarası (payment_id) - ZORUNLU
  "xact_date": "string",           // Ödeme işleminin yapıldığı zaman
  "agent_id": "string",           // Bayi kodu (opsiyonel)
  "bank_id": "string",             // Ödemenin yapıldığı banka numarası
  "instalment": "int",             // Taksit sayısı
  "card_holder": "string",         // Kart sahibinin adı ve soyadı
  "card_number": "string",         // Kart numarasının ilk 6 ve son 4 hanesi (masked)
  "amount": "decimal",             // Yapılan ödemenin brüt tutarı
  "netAmount": "decimal",          // Yapılan ödemenin net tutarı
  "comission": "decimal",          // Hizmet bedeli tutarı
  "comission_tax": "decimal",      // Hizmet bedeli vergisi
  "currency": "string",            // Para birimi (TRY)
  "authorization_code": "string",   // Bankadan dönen onay kodu
  "order_id": "string",            // Bankadan dönen satış kodu
  "is_succeed": "boolean"          // Ödemenin başarılı olup olmadığı - ZORUNLU
}
```

**Webhook Processing:**
1. PAYNET sends POST request to `confirmation_url` after payment completion
2. Backend verifies IP address (if configured)
3. Backend checks `is_succeed` field to determine payment status
4. Backend uses `reference_no` for idempotency check
5. Backend updates payment, escrow, and device statuses

**Signature Verification:**
- PAYNET may send signature in headers (to be confirmed from documentation)
- Current implementation supports optional signature verification
- IP address verification is also implemented as additional security layer

---

## 🏗️ Mimari Prensipler

### Backend Sorumlulukları (Ödeme Süreci)

**Backend, Paynet ile ödeme haberleşmesini üstlenir:**

1. ✅ **Paynet API ile İletişim:**
   - Frontend/iOS'tan gelen ödeme talebini alır
   - **Payment ID oluşturur ve veritabanına yazar** (`payments` tablosuna `status = 'pending'` ile)
   - Kullanıcıdan kart bilgilerini alır (PAN, ay, yıl, CVC, kart sahibi adı)
   - Paynet API'ye 3D Secure başlatma isteği gönderir (`is_escrow: true` parametresi ile)
   - Paynet API'ye 3D Secure tamamlama isteği gönderir
   - Paynet escrow serbest bırakma isteği gönderir (cihaz teslim edildiğinde)

2. ✅ **Webhook Yönetimi:**
   - Paynet'ten gelen webhook'ları alır ve doğrular (IP whitelist, signature)
   - **Webhook payload'ını veritabanında saklar** (`webhook_storage` veya benzeri tablo)
   - Webhook'tan gelen `reference_no` ile payment ID'yi eşleştirir
   - `payments` tablosunda mevcut kaydı günceller
   - Webhook durumunu frontend/iOS'a bildirir (`GET /v1/payments/{paymentId}/status`)

3. ✅ **Veritabanı İşlemleri (Ödeme için):**
   - **Payment ID oluşturur ve veritabanına yazar** (`payments` tablosuna `status = 'pending'` ile)
   - Webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true) **tüm veritabanı kayıtlarını oluşturur:**
     - `payments` tablosunu günceller (status, provider bilgileri, fee breakdown vb.)
     - `escrow_accounts` tablosuna kayıt oluşturur
     - `devices` tablosunda status'u `payment_completed` yapar
     - `audit_logs` tablosuna kayıt oluşturur
     - `notifications` tablosuna bildirim kayıtları oluşturur
   - Webhook payload'ını veritabanında saklar
   - Veritabanından **OKUMA** yapar (kontrol amaçlı: device status, user kontrolü, tutar doğrulama)

4. ✅ **Frontend/iOS'a Bildirim:**
   - Ödeme başarılı/başarısız durumunu frontend/iOS'a bildirir
   - Payment status kontrolü için endpoint sağlar (`GET /v1/payments/{paymentId}/status`)

**Özet:** Backend, Paynet ile ödeme haberleşmesini yönetir, webhook geldiğinde tüm veritabanı kayıtlarını oluşturur ve sonucu frontend/iOS'a bildirir. Frontend/iOS, backend'den gelen sonucu alır ve sadece kullanıcıya gösterir.

### Frontend/iOS Sorumlulukları

1. ✅ Backend API'ye ödeme başlatma isteği gönderir (deviceId, totalAmount, feeBreakdown ile)
2. ✅ 3D Secure sonucunu backend'e iletir (session_id, token_id)
3. ✅ Backend'den ödeme sonucunu alır (polling ile)
4. ✅ Kullanıcı ekranlarını düzenleyerek kullanıcıyı bilgilendirir
5. ❌ **Veritabanına YAZMAZ** - Tüm veritabanı işlemleri backend tarafından yapılır

---

## 🔌 Backend API Endpoints

### Base URL

**Development:**
```
http://localhost:3000/v1
```

**Production:**
```
https://api.ifoundanapple.com/v1
```

### 1. Ödeme Başlatma

**Endpoint:** `POST /v1/payments/process`

**Authentication:** Bearer Token (Required)

**Request Body:**
```json
{
  "deviceId": "123e4567-e89b-12d3-a456-426614174000",
  "totalAmount": 2000.0,
  "feeBreakdown": {
    "rewardAmount": 400.0,
    "cargoFee": 250.0,
    "serviceFee": 1281.4,
    "gatewayFee": 68.6,
    "totalAmount": 2000.0,
    "netPayout": 400.0
  }
}
```

**Request Fields:**
- `deviceId` (string, UUID, **ZORUNLU**): Ödeme yapılacak cihazın ID'si
- `totalAmount` (number, **ZORUNLU**): Frontend'den gelen toplam tutar (backend'de doğrulanır)
- `feeBreakdown` (object, **ZORUNLU**): Ücret dökümü (iOS tarafından hesaplanır, webhook geldiğinde veritabanı kayıtlarını oluşturmak için kullanılır)
  - `rewardAmount` (number): Bulan kişi ödülü (%20)
  - `cargoFee` (number): Kargo ücreti (250.00 TL sabit)
  - `serviceFee` (number): Hizmet bedeli (geriye kalan)
  - `gatewayFee` (number): Gateway komisyonu (%3.43)
  - `totalAmount` (number): Toplam tutar
  - `netPayout` (number): Bulan kişiye gidecek net tutar

**Backend İşlemleri:**
1. ✅ Token doğrulama
2. ✅ Device bilgilerini veritabanından **OKUR** (kontrol amaçlı)
   - Device status = 'payment_pending' kontrolü
   - User ID kontrolü (sadece device sahibi ödeme yapabilir)
   - Total amount doğrulama
3. ✅ Ücret doğrulama (iOS'tan gelen feeBreakdown'ı kontrol eder, hesaplamaz)
4. ✅ **Payment ID oluşturur ve veritabanına yazar** (`payments` tablosuna `status = 'pending'` ile)
5. ✅ Kullanıcıdan kart bilgilerini alır (PAN, ay, yıl, CVC, kart sahibi adı)
6. ✅ PAYNET API'ye 3D Secure başlatma isteği gönderir
   ```json
   {
     "amount": 2000.0,
     "reference_no": "payment-uuid-123",  // Backend'in oluşturduğu payment ID
     "is_escrow": true,  // ✅ Escrow aktif
     "return_url": "https://api.ifoundanapple.com/v1/payments/callback",  // Backend callback URL'i
     "domain": "ifoundanapple.com",
     "pan": "450634...",
     "month": "12",
     "year": "2025",
     "cvc": "123",
     "card_holder": "John Doe"
   }
   ```
7. ✅ PAYNET'ten dönen `post_url` ve `html_content` frontend'e döner

**Response:**
```json
{
  "id": "payment-uuid-123",
  "deviceId": "123e4567-e89b-12d3-a456-426614174000",
  "paymentStatus": "pending",
  "escrowStatus": "pending",
  "totalAmount": 2000.0,
  "providerTransactionId": "paynet-txn-123",
  "postUrl": "https://3dsecure.paynet.com.tr/...",
  "htmlContent": "<form>...</form>",
  "feeBreakdown": {
    "rewardAmount": 400.0,
    "cargoFee": 250.0,
    "serviceFee": 1281.4,
    "gatewayFee": 68.6,
    "totalAmount": 2000.0,
    "netPayout": 400.0
  }
}
```

**Önemli Notlar:**
- `postUrl`: PAYNET'in döndüğü 3D Secure doğrulama sayfası URL'i
- `htmlContent`: PAYNET'in döndüğü 3D Secure doğrulama HTML içeriği (alternatif kullanım)
- `publishableKey` alanı **YOKTUR** (bu Stripe'a özgü bir alandır)

**Status Codes:**
- `201 Created` - Ödeme başarıyla başlatıldı
- `400 Bad Request` - Geçersiz request veya tutar uyuşmazlığı
- `401 Unauthorized` - Geçersiz token
- `404 Not Found` - Cihaz bulunamadı

### 2. 3D Secure Tamamlama

**Endpoint:** `POST /v1/payments/complete-3d`

**Authentication:** Bearer Token (Required)

**Request Body:**
```json
{
  "paymentId": "123e4567-e89b-12d3-a456-426614174000",
  "sessionId": "session_abc123xyz",
  "tokenId": "token_xyz789abc"
}
```

**Response:**
```json
{
  "success": true,
  "paymentId": "123e4567-e89b-12d3-a456-426614174000",
  "message": "3D Secure payment completed. Waiting for webhook confirmation."
}
```

**Status Codes:**
- `200 OK` - 3D Secure ödeme başarıyla tamamlandı
- `400 Bad Request` - Geçersiz request, payment zaten işlenmiş veya kullanıcıya ait değil
- `401 Unauthorized` - Geçersiz token
- `404 Not Found` - Payment bulunamadı

### 3. Ödeme Durumu Sorgulama

**Endpoint:** `GET /v1/payments/{paymentId}/status`

**Authentication:** Bearer Token (Required)

**Response:**
```json
{
  "id": "payment-uuid-123",
  "deviceId": "123e4567-e89b-12d3-a456-426614174000",
  "paymentStatus": "completed",
  "escrowStatus": "held",
  "webhookReceived": true,
  "totalAmount": 2000.0,
  "providerTransactionId": "paynet-txn-123"
}
```

**Status Codes:**
- `200 OK` - Payment status döndü
- `401 Unauthorized` - Geçersiz token
- `404 Not Found` - Payment bulunamadı

### 4. Webhook Data Çekme

**Endpoint:** `GET /v1/payments/{paymentId}/webhook-data`

**Authentication:** Bearer Token (Required)

**Response:**
```json
{
  "success": true,
  "webhookData": {
    "reference_no": "REF123456",
    "is_succeed": true,
    "amount": 2000.0,
    "netAmount": 1931.4,
    "comission": 68.6,
    "authorization_code": "AUTH123",
    "order_id": "ORDER123",
    "xact_date": "2025-01-15T10:30:00Z"
  }
}
```

**Status Codes:**
- `200 OK` - Webhook data başarıyla alındı
- `401 Unauthorized` - Geçersiz token
- `404 Not Found` - Payment veya webhook data bulunamadı

### 5. Escrow Serbest Bırakma

**Endpoint:** `POST /v1/payments/release-escrow`

**Authentication:** Bearer Token (Required)

**Request Body:**
```json
{
  "paymentId": "payment-uuid-123",
  "deviceId": "device-uuid-123",
  "releaseReason": "Device received and confirmed by owner"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Escrow released successfully"
}
```

**Status Codes:**
- `200 OK` - Escrow başarıyla serbest bırakıldı
- `400 Bad Request` - Geçersiz request
- `401 Unauthorized` - Geçersiz token
- `404 Not Found` - Payment bulunamadı

### 6. Webhook Endpoint (Backend İçin)

**Endpoint:** `POST /v1/webhooks/paynet-callback`

**Authentication:** Gerekmez (IP whitelist ile korunur)

**IP Whitelist:** PAYNET'in IP adresleri `.env` dosyasında `PAYNET_ALLOWED_IPS` olarak tanımlanmalıdır.

**Request Body (PAYNET Webhook Payload):**
```json
{
  "reference_no": "payment-uuid-123",
  "is_succeed": true,
  "amount": 2000.0,
  "netAmount": 1931.4,
  "comission": 68.6,
  "authorization_code": "AUTH123",
  "order_id": "ORDER123",
  "xact_date": "2025-01-15T10:30:00.000Z"
}
```

**Backend İşlemleri:**
1. ✅ IP whitelist kontrolü
2. ✅ Signature doğrulama
3. ✅ Idempotency kontrolü (duplicate webhook kontrolü)
4. ✅ Payment bilgilerini veritabanından **OKUR** (kontrol amaçlı)
5. ✅ Webhook'u doğrular
6. ✅ **Webhook payload'ını veritabanında saklar** (`webhook_storage` veya benzeri tablo)
7. ✅ Webhook'tan gelen `reference_no` ile payment ID'yi eşleştirir
8. ✅ `payments` tablosunda mevcut kaydı günceller (`status`, `provider_payment_id`, `provider_transaction_id` vb.)
9. ✅ iOS'a webhook bildirimi gönderebilir (opsiyonel - Supabase Realtime veya Push Notification)

**Response:**
```json
{
  "received": true
}
```

**Status Codes:**
- `200 OK` - Webhook başarıyla işlendi
- `400 Bad Request` - Geçersiz payload veya signature
- `401 Unauthorized` - IP adresi whitelist'te değil

---

## 📱 iOS Entegrasyonu

### 1. Ödeme Başlatma

**Swift Kodu:**

```swift
import Foundation

struct PaymentProcessRequest: Codable {
    let deviceId: String
    let totalAmount: Double
    let feeBreakdown: FeeBreakdown
}

struct PaymentProcessResponse: Codable {
    let id: String
    let deviceId: String
    let paymentStatus: String
    let totalAmount: Double
    let providerTransactionId: String?
    let publishableKey: String?
    let paymentUrl: String?
    let feeBreakdown: FeeBreakdown?
}

struct FeeBreakdown: Codable {
    let totalAmount: Double
    let gatewayFee: Double
    let cargoFee: Double
    let rewardAmount: Double
    let serviceFee: Double
    let netPayout: Double
}

class PaymentService {
    private let baseURL = "https://api.ifoundanapple.com/v1"
    private let authToken: String
    
    init(authToken: String) {
        self.authToken = authToken
    }
    
    func initiatePayment(deviceId: String, totalAmount: Double, feeBreakdown: FeeBreakdown) async throws -> PaymentProcessResponse {
        let url = URL(string: "\(baseURL)/payments/process")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let requestBody = PaymentProcessRequest(
            deviceId: deviceId,
            totalAmount: totalAmount,
            feeBreakdown: feeBreakdown
        )
        request.httpBody = try JSONEncoder().encode(requestBody)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PaymentError.invalidResponse
        }
        
        guard httpResponse.statusCode == 201 else {
            throw PaymentError.serverError(httpResponse.statusCode)
        }
        
        let paymentResponse = try JSONDecoder().decode(PaymentProcessResponse.self, from: data)
        
        // Payment ID'yi UserDefaults'a kaydet
        UserDefaults.standard.set(paymentResponse.id, forKey: "current_payment_id")
        UserDefaults.standard.set(paymentResponse.deviceId, forKey: "current_payment_device_id")
        
        // Fee breakdown'ı UserDefaults'a kaydet
        if let feeBreakdown = paymentResponse.feeBreakdown {
            if let feeData = try? JSONEncoder().encode(feeBreakdown) {
                UserDefaults.standard.set(feeData, forKey: "current_payment_fee_breakdown")
            }
        }
        
        return paymentResponse
    }
}
```

### 2. 3D Secure Tamamlama

**Swift Kodu:**

```swift
struct Complete3DRequest: Codable {
    let paymentId: String
    let sessionId: String
    let tokenId: String
}

extension PaymentService {
    func complete3DSecure(
        paymentId: String,
        sessionId: String,
        tokenId: String
    ) async throws -> Complete3DResponse {
        let url = URL(string: "\(baseURL)/payments/complete-3d")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let requestBody = Complete3DRequest(
            paymentId: paymentId,
            sessionId: sessionId,
            tokenId: tokenId
        )
        request.httpBody = try JSONEncoder().encode(requestBody)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PaymentError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw PaymentError.serverError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(Complete3DResponse.self, from: data)
    }
}
```

### 3. Payment Status Polling

**Swift Kodu:**

```swift
extension PaymentService {
    func checkPaymentStatus(paymentId: String) async throws -> PaymentStatusResponse {
        let url = URL(string: "\(baseURL)/payments/\(paymentId)/status")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PaymentError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw PaymentError.serverError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(PaymentStatusResponse.self, from: data)
    }
    
    func getWebhookData(paymentId: String) async throws -> WebhookDataResponse {
        let url = URL(string: "\(baseURL)/payments/\(paymentId)/webhook-data")!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw PaymentError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw PaymentError.serverError(httpResponse.statusCode)
        }
        
        return try JSONDecoder().decode(WebhookDataResponse.self, from: data)
    }
}

func startPaymentStatusPolling(paymentId: String) {
    Task {
        var attempts = 0
        let maxAttempts = 30 // 5 dakika (10 saniye * 30)
        
        while attempts < maxAttempts {
            do {
                let status = try await paymentService.checkPaymentStatus(paymentId: paymentId)
                
                if status.webhookReceived && status.paymentStatus == "completed" {
                    // Webhook geldi, webhook data'yı al ve kayıtları oluştur
                    await createPaymentRecordsFromWebhook(paymentId: paymentId)
                    break
                }
                
                // 10 saniye bekle
                try await Task.sleep(nanoseconds: 10_000_000_000)
                attempts += 1
            } catch {
                print("Status check error: \(error)")
                break
            }
        }
    }
}
```

---

## 🔔 Webhook İşleme

### Backend Webhook Handler

**Backend'de webhook geldiğinde:**

1. ✅ Webhook'u doğrula (IP, signature)
2. ✅ Payment bilgilerini veritabanından **OKUR** (kontrol amaçlı)
3. ✅ **Webhook payload'ını saklar** (webhook_storage tablosuna)
4. ✅ Webhook'tan gelen `reference_no` ile payment ID'yi eşleştirir
5. ✅ **Eğer ödeme başarılı (is_succeed: true) ise, backend tüm veritabanı kayıtlarını oluşturur:**
   - `payments` tablosunu günceller (status, provider bilgileri, fee breakdown vb.)
   - `escrow_accounts` tablosuna kayıt oluşturur
   - `devices` tablosunda status'u `payment_completed` yapar
   - `audit_logs` tablosuna kayıt oluşturur
   - `notifications` tablosuna bildirim kayıtları oluşturur
6. ✅ Frontend/iOS'a ödeme sonucunu bildirir (polling endpoint'i ile)

**Webhook Saklama Mekanizması:**

Backend, webhook payload'ını **veritabanında saklamalıdır**. Önerilen yaklaşım:
- **Veritabanı tablosu:** `webhook_storage` veya benzeri bir tablo oluşturulmalıdır
- **Tablo yapısı:**
  ```sql
  CREATE TABLE webhook_storage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES payments(id),
    reference_no VARCHAR(255) UNIQUE,
    webhook_payload JSONB NOT NULL,
    is_succeed BOOLEAN,
    processed_at TIMESTAMP DEFAULT now(),
    created_at TIMESTAMP DEFAULT now()
  );
  ```
- **Avantajlar:**
  - Webhook geçmişi tutulur (hata analizi için)
  - Idempotency kontrolü kolaylaşır
  - Frontend/iOS'un webhook data'yı alması kolaylaşır
  - Audit trail sağlanır

Önemli: Webhook'lar idempotency kontrolü ile tekrar işlenmez. Aynı `reference_no` ile gelen webhook'lar yok sayılır.

---

## 🔓 Escrow Serbest Bırakma

### Escrow Serbest Bırakma Akışı

**1. iOS'tan Backend'e İstek:**

Cihaz teslim edildiğinde iOS, backend'e escrow serbest bırakma isteği gönderir:

```swift
let releaseResponse = try await paymentService.releaseEscrow(
    paymentId: payment.id,
    deviceId: device.id,
    releaseReason: "Device received and confirmed by owner"
)

if releaseResponse.success {
    // Escrow serbest bırakıldı
    // Veritabanı güncellemeleri yapılır
}
```

**2. Backend: PAYNET API'ye Escrow Release İsteği:**

Backend, iOS'tan gelen isteği alır ve PAYNET API'ye escrow release isteği gönderir:

```javascript
POST /v1/transaction/escrow_status_update
{
  "xact_id": "[paynet_transaction_id]",  // PAYNET işlem ID'si (payments.provider_transaction_id)
  "status": 2,                            // 2 = Onay (Release), 3 = Red (Reject)
  "note": "Device received and confirmed by owner"
}
```

**3. Backend: Veritabanı Güncellemeleri:**

Backend, PAYNET'ten başarılı yanıt aldıktan sonra **tüm veritabanı güncellemelerini yapar:**
- `escrow_accounts` tablosunda `status = 'released'` günceller
- `financial_transactions` kaydı oluşturur
- `devices` tablosunda `status = 'completed'` günceller
- `payments` tablosunda `status = 'completed'` günceller
- `audit_logs` tablosuna kayıt oluşturur
- `notifications` tablosuna bildirim kayıtları oluşturur

**4. Frontend/iOS:**

Frontend/iOS, backend'den başarılı yanıt aldıktan sonra:
- ✅ Kullanıcıya başarı mesajı gösterir
- ✅ İşlem tamamlandı sayfasına yönlendirilir
- ❌ **Veritabanına YAZMAZ** - Tüm veritabanı işlemleri backend tarafından yapılır

---

## ⚠️ Hata Senaryoları

### Senaryo 1: Ödeme Başarısız

**PAYNET Webhook (Başarısız):**
```json
{
  "reference_no": "payment-uuid-123",
  "is_succeed": false,
  "error_message": "Insufficient funds"
}
```

**Backend İşlemleri:**
1. ✅ Webhook'u doğrular
2. ✅ **Webhook payload'ını veritabanında saklar** (hata analizi için)
3. ✅ Webhook'tan gelen `reference_no` ile payment ID'yi eşleştirir
4. ✅ `payments` tablosunda mevcut kaydı günceller (`status = 'failed'`, `failed_reason` vb.)
5. ✅ Frontend/iOS'a bildirim gönderir

**Frontend/iOS İşlemleri:**
1. ✅ Backend'den hata sonucunu alır
2. ✅ Hata mesajını kullanıcıya gösterir
3. ✅ "Tekrar Dene" butonu ile ödeme sayfasına geri dönülür
4. ❌ **Veritabanına YAZMAZ** - Tüm işlemler backend tarafından yapılır

### Senaryo 2: Webhook Gecikmesi

Eğer webhook gecikirse:
1. Frontend/iOS polling yapabilir (30 deneme, 10 saniye aralık)
2. Backend, PAYNET API'den status sorgular (opsiyonel)
3. Webhook geldiğinde backend normal akışı devam ettirir (tüm veritabanı kayıtlarını oluşturur)

### Senaryo 3: Duplicate Webhook

Backend idempotency kontrolü yapar:
- Aynı `reference_no` ile gelen webhook'lar tekrar işlenmez
- iOS tarafında da duplicate kayıt kontrolü yapılmalı

---

## 🔐 Güvenlik Kontrolleri

### Backend Güvenlik Kontrolleri

1. ✅ Token doğrulama (her istekte)
2. ✅ User ID kontrolü (sadece device sahibi ödeme yapabilir)
3. ✅ Device status kontrolü (sadece 'payment_pending' device'lar için)
4. ✅ Amount doğrulama (backend'de hesaplanan tutar ile karşılaştırma)
5. ✅ IP whitelist (webhook için)
6. ✅ Signature doğrulama (webhook için)

### iOS Güvenlik Kontrolleri

1. ✅ RLS (Row Level Security) politikaları
2. ✅ User authentication
3. ✅ Webhook payload doğrulama
4. ✅ Idempotency kontrolü (duplicate kayıt önleme)
5. ✅ Payment ID doğrulama (kullanıcıya ait mi?)

---

## 🧪 Test Senaryoları

### Test 1: Ödeme Başlatma

1. ✅ Device status = 'payment_pending' kontrolü
2. ✅ User ID kontrolü (sadece device sahibi)
3. ✅ Amount doğrulama
4. ✅ Backend response kontrolü
5. ✅ Payment ID saklama

### Test 2: 3D Secure Tamamlama

1. ✅ Session ID ve Token ID doğrulama
2. ✅ Payment ID doğrulama
3. ✅ Backend response kontrolü
4. ✅ Polling başlatma

### Test 3: Webhook İşleme

1. ✅ Webhook payload doğrulama
2. ✅ Payment kaydı oluşturma
3. ✅ Escrow kaydı oluşturma
4. ✅ Device status güncelleme
5. ✅ Audit log kaydı

### Test 4: Escrow Serbest Bırakma

1. ✅ Backend API çağrısı
2. ✅ Escrow status güncelleme
3. ✅ Financial transaction kaydı
4. ✅ Device status güncelleme

---

## ✅ Implementasyon Kontrol Listesi

### 1. Authentication

- ✅ **HTTP Basic Authentication** implementasyonu
- ✅ Format: `Authorization: Basic base64(secret_key:)`
- ✅ Secret Key environment variable'dan alınıyor
- ✅ Publishable Key frontend için hazır

### 2. API Base URLs

- ✅ Test: `https://pts-api.paynet.com.tr/v1`
- ✅ Production: `https://api.paynet.com.tr/v1`
- ✅ Environment variable ile yapılandırılabilir

### 3. 3D Secure Ödeme Akışı

- ✅ `initiate3DPayment()` - 3D ödeme başlatma
- ✅ `complete3DPayment()` - 3D ödeme tamamlama
- ✅ Request/Response interface'leri tanımlandı

### 4. Webhook Güvenliği

- ✅ IP kontrolü (PAYNET statik IP'leri)
- ✅ Idempotency kontrolü
- ⏳ Signature verification (implement edilecek)

### 5. Escrow Yönetimi

- ✅ Backend'de escrow_accounts tablosu
- ✅ Ödeme tamamlandığında `status = 'held'`
- ✅ Cihaz teslim edildiğinde `status = 'released'`
- ✅ PAYNET API üzerinden escrow yönetimi

---

## 📊 Veritabanı Tabloları

### `payments` Tablosu

**Oluşturma Zamanı:** ✅ Ödeme başlatıldığında (`status = 'pending'`) ve webhook geldiğinde güncellenir

**Oluşturan/Güncelleyen:** Backend

**Backend Erişimi:** ✅ YAZMA ve OKUMA (tüm işlemler backend tarafından yapılır)

### `escrow_accounts` Tablosu

**Oluşturma Zamanı:** ✅ Webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true)

**Oluşturan:** Backend

**Backend Erişimi:** ✅ YAZMA ve OKUMA (tüm işlemler backend tarafından yapılır)

### `devices` Tablosu

**Güncelleme Zamanı:** ✅ Webhook geldiğinde ve ödeme başarılı olduğunda (status = 'payment_completed')

**Güncelleyen:** Backend

**Backend Erişimi:** ✅ YAZMA ve OKUMA (tüm işlemler backend tarafından yapılır)

---

## 📝 Özet

### Backend Sorumlulukları

- ✅ PAYNET API ile iletişim
- ✅ **Payment ID oluşturur ve veritabanına yazar** (`payments` tablosuna `status = 'pending'` ile)
- ✅ Webhook payload'ını veritabanında saklar
- ✅ Webhook'tan gelen `reference_no` ile payment ID'yi eşleştirir
- ✅ **Webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true) tüm veritabanı kayıtlarını oluşturur:**
  - `payments` tablosunu günceller
  - `escrow_accounts` tablosuna kayıt oluşturur
  - `devices` tablosunda status'u `payment_completed` yapar
  - `audit_logs` tablosuna kayıt oluşturur
  - `notifications` tablosuna bildirim kayıtları oluşturur
- ✅ PAYNET escrow yönetimi (başlatma ve serbest bırakma)
- ✅ Veritabanından **OKUMA** (kontrol amaçlı: device status, user kontrolü, tutar doğrulama)

### Frontend/iOS Sorumlulukları

- ✅ Backend API'ye ödeme başlatma isteği gönderir (deviceId, totalAmount, feeBreakdown ile)
- ✅ 3D Secure sonucunu backend'e iletir (session_id, token_id)
- ✅ Backend'den ödeme sonucunu alır (polling ile)
- ✅ Kullanıcı ekranlarını düzenleyerek kullanıcıyı bilgilendirir
- ❌ **Veritabanına YAZMAZ** - Tüm veritabanı işlemleri backend tarafından yapılır

### Önemli Kurallar

1. ✅ **Backend, ödeme başlatıldığında payment ID oluşturur ve veritabanına yazar** (`payments` tablosuna `status = 'pending'` ile)
2. ✅ Backend, webhook geldiğinde `reference_no` ile payment ID'yi eşleştirir
3. ✅ Backend, webhook payload'ını veritabanında saklar
4. ✅ **Backend, webhook başarılı olduğunda (is_succeed: true) tüm veritabanı kayıtlarını oluşturur** (payments, escrow_accounts, devices, audit_logs, notifications)
5. ✅ Backend PAYNET escrow'u yönetir (başlatma ve serbest bırakma)
6. ✅ **Kart bilgileri sistemde veya veritabanında ASLA TUTULMAZ** - sadece PAYNET API'sine gönderilir
7. ✅ **Frontend/iOS veritabanına YAZMAZ** - Sadece backend'den sonucu alır ve kullanıcıya gösterir

---

## 🔗 Kaynaklar

- [PAYNET Dokümantasyon](https://doc.paynet.com.tr)
- [API Entegrasyonu](https://doc.paynet.com.tr/oedeme-metotlari/api-entegrasyonu)
- [3D ile Ödeme](https://doc.paynet.com.tr/oedeme-metotlari/api-entegrasyonu/3d-ile-odeme)
- [Escrow Durum Güncelleme](https://doc.paynet.com.tr/servisler/islem/escrow-durum-guncelleme)
- [Authentication](https://doc.paynet.com.tr/authentication)

---

**Son Güncelleme:** 2025-01-15
**Versiyon:** 2.0.0
