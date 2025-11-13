# iFoundAnApple Backend API Dokümantasyonu

## 📋 İçindekiler

1. [Genel Bilgiler](#genel-bilgiler)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [PAYNET Entegrasyonu](#paynet-entegrasyonu)
5. [Webhook Yapısı](#webhook-yapısı)
6. [Error Handling](#error-handling)
7. [Frontend Entegrasyon Notları](#frontend-entegrasyon-notları)
8. [Örnek Request/Response'lar](#örnek-requestresponse-lar)

---

## 🔧 Genel Bilgiler

### Base URL

**Development:**
```
http://localhost:3000/api
```

**Production:**
```
https://api.ifoundanapple.com/api
```

### API Versiyonu

- **Version:** 1.0.0
- **Format:** REST API
- **Content-Type:** `application/json`
- **Character Encoding:** UTF-8

### Swagger Dokümantasyonu

Backend'de interaktif API dokümantasyonu mevcuttur:

```
http://localhost:3000/api/docs
```

Swagger UI'da tüm endpoint'leri test edebilir, request/response formatlarını görebilirsiniz.

### CORS (Cross-Origin Resource Sharing)

Backend CORS aktif durumda. Frontend URL'i `.env` dosyasında `FRONTEND_URL` olarak tanımlanmalı.

---

## 🔐 Authentication

### JWT Token Kullanımı

Backend, **Supabase JWT token** kullanarak authentication yapar. Tüm korumalı endpoint'ler için token gereklidir.

### Token Formatı

```
Authorization: Bearer <supabase_jwt_token>
```

### Token Nasıl Alınır?

1. Frontend'de Supabase Auth ile kullanıcı girişi yapılır
2. Supabase `access_token` döner
3. Bu token her API isteğinde `Authorization` header'ında gönderilir

**Örnek:**
```javascript
const token = supabase.auth.session()?.access_token;

fetch('http://localhost:3000/api/session', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### Token Doğrulama

- Token Supabase SDK ile doğrulanır
- Token geçersiz veya süresi dolmuşsa `401 Unauthorized` döner
- Token'da kullanıcı bilgileri (`user.id`, `user.email`, vb.) bulunur

### Public Endpoints

Bazı endpoint'ler authentication gerektirmez (public):

- `GET /api/health` - Health check

---

## 📡 API Endpoints

### Health Check

#### `GET /api/health`

Backend'in çalışıp çalışmadığını kontrol eder.

**Authentication:** Gerekmez (Public)

**Response:**
```json
{
  "status": "ok",
  "uptime": 12345.67,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**Status Codes:**
- `200 OK` - Backend çalışıyor

---

### Authentication & Session

#### `GET /api/session`

Mevcut kullanıcının session bilgilerini döner.

**Authentication:** Gerekli (Bearer Token)

**Response:**
```json
{
  "id": "df612602-69f0-4e3c-ac31-f23c5ada8d77",
  "email": "user@example.com",
  "roles": ["user"]
}
```

**Status Codes:**
- `200 OK` - Session bilgileri başarıyla döndü
- `401 Unauthorized` - Geçersiz veya eksik token

**Response Fields:**
- `id` (string): Kullanıcı ID'si (UUID)
- `email` (string): Kullanıcı e-posta adresi
- `roles` (string[]): Kullanıcı rolleri (örn: `["user"]`, `["admin"]`)

---

### Payments

#### `POST /api/payments/process`

Eşleşmiş bir cihaz için ödeme işlemini başlatır.

**Authentication:** Gerekli (Bearer Token)

**Request Body:**
```json
{
  "deviceId": "123e4567-e89b-12d3-a456-426614174000",
  "totalAmount": 2000.0
}
```

**Request Fields:**
- `deviceId` (string, UUID, **ZORUNLU**): Ödeme yapılacak cihazın ID'si
- `totalAmount` (number, **ZORUNLU**): Frontend'den gelen toplam tutar (backend'de doğrulanır)

**Response:**
```json
{
  "id": "payment-uuid-123",
  "deviceId": "123e4567-e89b-12d3-a456-426614174000",
  "paymentStatus": "pending",
  "escrowStatus": "pending",
  "totalAmount": 2000.0,
  "providerTransactionId": "paynet-txn-123",
  "publishableKey": "pk_test_...",
  "paymentUrl": "https://api.paynet.com.tr/v2/transaction/tds_initial"
}
```

**Response Fields:**
- `id` (string): Payment ID (UUID)
- `deviceId` (string): Device ID
- `paymentStatus` (string): Ödeme durumu (`pending`, `completed`, `failed`)
- `escrowStatus` (string): Escrow durumu (`pending`, `held`, `released`)
- `totalAmount` (number): Toplam tutar
- `providerTransactionId` (string, opsiyonel): PAYNET transaction ID
- `publishableKey` (string, opsiyonel): PAYNET publishable key (frontend için)
- `paymentUrl` (string, opsiyonel): 3D Secure ödeme URL'i

**Status Codes:**
- `201 Created` - Ödeme başarıyla başlatıldı
- `400 Bad Request` - Geçersiz request veya tutar uyuşmazlığı
- `401 Unauthorized` - Geçersiz token
- `404 Not Found` - Cihaz bulunamadı

**Önemli Notlar:**

1. **Tutar Doğrulama:** Backend, frontend'den gelen `totalAmount` değerini veritabanındaki `device_models.ifoundanapple_fee` değeri ile karşılaştırır. Eğer tutarlar eşleşmezse `400 Bad Request` döner.

2. **Ücret Hesaplama:** Backend'de ücretler şu formüle göre hesaplanır:
   ```
   totalAmount = device_models.ifoundanapple_fee
   gatewayFee = totalAmount * 0.0343 (3.43%)
   cargoFee = 250.00 TL (sabit)
   rewardAmount = totalAmount * 0.20 (20%)
   serviceFee = totalAmount - gatewayFee - cargoFee - rewardAmount
   netPayout = rewardAmount
   ```

3. **Cihaz Durumu:** Cihaz `status = 'matched'` olmalıdır. Aksi halde `400 Bad Request` döner.

4. **Kullanıcı Kontrolü:** Sadece cihaz sahibi (device.userId) ödeme yapabilir. Başka kullanıcı denerse `400 Bad Request` döner.

5. **PAYNET Entegrasyonu:** Ödeme PAYNET 3D Secure ile başlatılır. `is_escrow: true` parametresi ile gönderilir (ödeme PAYNET tarafında tutulur).

---

#### `GET /api/payments/test-paynet-connection`

PAYNET API bağlantısını ve konfigürasyonu test eder.

**Authentication:** Gerekli (Bearer Token)

**Response:**
```json
{
  "success": true,
  "message": "PAYNET API connection tests passed. Ready for integration testing.",
  "config": {
    "apiUrl": "https://api.paynet.com.tr",
    "hasApiKey": true,
    "hasSecretKey": true,
    "hasPublishableKey": true,
    "secretKeyPrefix": "sk_test_...",
    "publishableKeyPrefix": "pk_test_..."
  },
  "testResults": [
    {
      "test": "Base URL Connectivity",
      "success": true,
      "statusCode": 200,
      "message": "Server is reachable (HTTP 200)"
    },
    {
      "test": "Authentication Format",
      "success": true,
      "message": "Using HTTP Basic Authentication (PAYNET standard)"
    },
    {
      "test": "Configuration",
      "success": true,
      "message": "All required configuration values are set"
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Test sonuçları döndü

**Kullanım:** Bu endpoint, PAYNET konfigürasyonunun doğru olup olmadığını kontrol etmek için kullanılır.

---

### Admin Endpoints

#### `GET /api/admin/diagnostics`

Admin tanılama endpoint'i (sadece admin kullanıcılar).

**Authentication:** Gerekli (Bearer Token + Admin Role)

**Response:**
```json
{
  "status": "admin-ok"
}
```

**Status Codes:**
- `200 OK` - Admin erişimi başarılı
- `401 Unauthorized` - Geçersiz token
- `403 Forbidden` - Admin yetkisi yok

**Admin Kontrolü:** Kullanıcının `roles` array'inde `"admin"` olmalıdır.

---

## 💳 PAYNET Entegrasyonu

### Genel Bilgiler

Backend, PAYNET ödeme sağlayıcısı ile entegre edilmiştir. Ödemeler 3D Secure ile yapılır ve escrow özelliği aktif edilmiştir.

### PAYNET API Endpoints

Backend, PAYNET'in şu endpoint'lerini kullanır:

1. **3D Ödeme Başlatma:** `POST /v2/transaction/tds_initial`
2. **3D Ödeme Tamamlama:** `POST /v2/transaction/tds_charge`
3. **Escrow Release:** `POST /v1/transaction/escrow_status_update`

### PAYNET Konfigürasyonu

Backend `.env` dosyasında şu PAYNET değişkenlerini bekler:

```env
PAYNET_API_URL=https://api.paynet.com.tr
PAYNET_API_KEY=your_api_key
PAYNET_SECRET_KEY=your_secret_key
PAYNET_PUBLISHABLE_KEY=your_publishable_key
PAYNET_ALLOWED_IPS=104.21.232.181,172.67.202.100
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:3000
```

### PAYNET Ödeme Akışı

#### 1. Ödeme Başlatma (Backend)

Frontend, `POST /api/payments/process` endpoint'ini çağırır. Backend:

1. Tutarı doğrular (veritabanından)
2. Payment ve escrow kayıtlarını oluşturur
3. PAYNET'e 3D Secure ödeme isteği gönderir
4. PAYNET'ten `post_url` veya `html_content` alır
5. Frontend'e `paymentUrl` döner

#### 2. 3D Secure Doğrulama (Frontend)

Frontend, `paymentUrl`'e kullanıcıyı yönlendirir. Kullanıcı:

1. Bankanın 3D Secure sayfasında doğrulama yapar
2. Doğrulama sonrası `return_url`'e yönlendirilir
3. `return_url`'e `session_id` ve `token_id` POST edilir

**Örnek return_url:**
```
http://localhost:3000/payment/callback?session_id=xxx&token_id=yyy
```

#### 3. Ödeme Tamamlama (Backend)

Frontend, `session_id` ve `token_id`'yi backend'e gönderir. Backend:

1. PAYNET'e `POST /v2/transaction/tds_charge` isteği gönderir
2. Ödeme tamamlanır
3. Webhook beklenir (veya direkt sonuç döner)

**Not:** Şu anda backend'de 3D tamamlama endpoint'i yok. Frontend, `session_id` ve `token_id`'yi backend'e göndermeli ve backend bunu PAYNET'e iletmelidir. Bu endpoint eklenebilir.

### PAYNET Escrow Yönetimi

#### Escrow Release

Cihaz teslim edildiğinde, backend PAYNET escrow'u serbest bırakır:

**Endpoint:** `POST /v1/transaction/escrow_status_update`

**Request:**
```json
{
  "xact_id": "paynet-transaction-id",
  "status": 2,
  "note": "Device received and confirmed by owner"
}
```

**Status Values:**
- `2` = Onay (Release)
- `3` = Red (Reject)

**Not:** Bu işlem şu anda backend'de otomatik tetiklenmiyor. Cihaz teslim onayı geldiğinde bu endpoint çağrılmalıdır.

### PAYNET Publishable Key

Frontend, PAYNET entegrasyonu için `publishableKey` kullanabilir. Bu key, `POST /api/payments/process` response'unda döner.

**Güvenlik:** Publishable key frontend'de kullanılabilir, ancak secret key asla frontend'e gönderilmemelidir.

---

## 🔔 Webhook Yapısı

### PAYNET Webhook

#### `POST /api/webhooks/paynet-callback`

PAYNET, ödeme tamamlandığında bu endpoint'e webhook gönderir.

**Authentication:** Gerekmez (IP whitelist ile korunur)

**IP Whitelist:** PAYNET'in IP adresleri `.env` dosyasında `PAYNET_ALLOWED_IPS` olarak tanımlanmalıdır.

**Request Body (PAYNET Webhook Payload):**
```json
{
  "reference_no": "payment-uuid-123",
  "xact_date": "2025-01-15T10:30:00.000Z",
  "agent_id": "agent-123",
  "bank_id": "001",
  "instalment": 1,
  "card_holder": "JOHN DOE",
  "card_number": "123456****5678",
  "amount": 2000.0,
  "netAmount": 1931.4,
  "comission": 68.6,
  "comission_tax": 12.34,
  "currency": "TRY",
  "authorization_code": "AUTH123",
  "order_id": "ORDER123",
  "is_succeed": true
}
```

**Webhook Payload Fields:**
- `reference_no` (string, **ZORUNLU**): Payment ID (backend'deki payment.id)
- `is_succeed` (boolean, **ZORUNLU**): Ödeme başarı durumu
- `amount` (decimal): Brüt tutar
- `netAmount` (decimal): Net tutar
- `comission` (decimal): Hizmet bedeli
- `comission_tax` (decimal): Hizmet bedeli vergisi
- `currency` (string): Para birimi (TRY)
- `authorization_code` (string): Banka onay kodu
- `order_id` (string): Banka satış kodu
- `bank_id` (string): Banka numarası
- `instalment` (int): Taksit sayısı
- `card_holder` (string): Kart sahibi adı
- `card_number` (string): Masked kart numarası (ilk 6 + son 4 hane)
- `xact_date` (string): İşlem tarihi
- `agent_id` (string, opsiyonel): Bayi kodu

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

**Webhook İşleme Adımları:**

1. **IP Doğrulama:** İstek IP'si `PAYNET_ALLOWED_IPS` listesinde olmalıdır
2. **Signature Verification:** Opsiyonel (header'da `x-paynet-signature` varsa doğrulanır)
3. **Idempotency Check:** `reference_no` kullanılarak duplicate webhook kontrolü yapılır
4. **Payment Update:** `is_succeed` değerine göre payment durumu güncellenir
5. **Escrow Update:** Ödeme başarılıysa escrow `held` durumuna geçer
6. **Device Update:** Cihaz durumu `payment_completed` olur

**Webhook URL Konfigürasyonu:**

PAYNET yönetim panelinde `confirmation_url` olarak şu URL ayarlanmalıdır:

```
https://api.ifoundanapple.com/api/webhooks/paynet-callback
```

---

## ⚠️ Error Handling

### Error Response Formatı

Tüm hatalar aşağıdaki format ile döner:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/api/payments/process"
}
```

### HTTP Status Codes

- `200 OK` - İstek başarılı
- `201 Created` - Kayıt başarıyla oluşturuldu
- `400 Bad Request` - Geçersiz request (validation hatası, tutar uyuşmazlığı, vb.)
- `401 Unauthorized` - Authentication hatası (geçersiz token, token yok)
- `403 Forbidden` - Yetki hatası (admin endpoint'ine normal kullanıcı erişimi)
- `404 Not Found` - Kaynak bulunamadı (cihaz, ödeme, vb.)
- `500 Internal Server Error` - Sunucu hatası

### Yaygın Hata Mesajları

#### 400 Bad Request

**Tutar Uyuşmazlığı:**
```json
{
  "statusCode": 400,
  "message": "Amount mismatch. Expected: 2000.0, Received: 1500.0",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/api/payments/process"
}
```

**Geçersiz Device Status:**
```json
{
  "statusCode": 400,
  "message": "Device 123e4567-e89b-12d3-a456-426614174000 is not in 'matched' status. Current status: lost",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/api/payments/process"
}
```

**Yetkisiz Kullanıcı:**
```json
{
  "statusCode": 400,
  "message": "User df612602-69f0-4e3c-ac31-f23c5ada8d77 is not the owner of device 123e4567-e89b-12d3-a456-426614174000",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/api/payments/process"
}
```

#### 401 Unauthorized

**Token Yok:**
```json
{
  "statusCode": 401,
  "message": "Missing or invalid token",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/api/session"
}
```

**Geçersiz Token:**
```json
{
  "statusCode": 401,
  "message": "Invalid or expired token",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/api/session"
}
```

#### 404 Not Found

**Cihaz Bulunamadı:**
```json
{
  "statusCode": 404,
  "message": "Device not found: 123e4567-e89b-12d3-a456-426614174000",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/api/payments/process"
}
```

---

## 🎯 Frontend Entegrasyon Notları

### 1. Authentication

**Token Yönetimi:**
- Supabase Auth ile login yapın
- `access_token`'ı her API isteğinde `Authorization` header'ında gönderin
- Token süresi dolduğunda refresh token kullanın veya yeniden login yapın

**Örnek Axios Interceptor:**
```javascript
import axios from 'axios';
import { supabase } from './supabase';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});
```

### 2. Payment Flow

**Ödeme Akışı:**

1. **Ödeme Başlatma:**
   ```javascript
   const response = await api.post('/payments/process', {
     deviceId: '123e4567-e89b-12d3-a456-426614174000',
     totalAmount: 2000.0
   });
   
   const { paymentUrl, publishableKey } = response.data;
   ```

2. **3D Secure Yönlendirme:**
   - `paymentUrl`'e kullanıcıyı yönlendirin
   - Veya `html_content` varsa iframe içinde gösterin

3. **Return URL İşleme:**
   - `return_url`'e gelen `session_id` ve `token_id`'yi alın
   - Backend'e gönderin (şu anda endpoint yok, eklenebilir)

4. **Webhook Bekleme:**
   - Webhook gelene kadar polling yapabilirsiniz
   - Veya WebSocket ile real-time güncelleme alabilirsiniz

### 3. Tutar Doğrulama

**ÖNEMLİ:** Frontend'den gönderilen `totalAmount` backend'de doğrulanır. Eğer tutar veritabanındaki değerle eşleşmezse `400 Bad Request` döner.

**Öneri:** Frontend'de tutarı hesaplarken, backend'deki formülü kullanın:
```javascript
// Frontend'de tutar hesaplama (backend ile aynı formül)
const totalAmount = deviceModel.ifoundanapple_fee;
const gatewayFee = totalAmount * 0.0343;
const cargoFee = 250.0;
const rewardAmount = totalAmount * 0.20;
const serviceFee = totalAmount - gatewayFee - cargoFee - rewardAmount;
```

### 4. Error Handling

**Tüm API isteklerinde error handling yapın:**
```javascript
try {
  const response = await api.post('/payments/process', data);
  // Success
} catch (error) {
  if (error.response) {
    // Backend hatası
    const { statusCode, message } = error.response.data;
    if (statusCode === 400) {
      // Validation hatası veya tutar uyuşmazlığı
      console.error('Payment error:', message);
    } else if (statusCode === 401) {
      // Token hatası - yeniden login
      await supabase.auth.signOut();
      router.push('/login');
    }
  } else {
    // Network hatası
    console.error('Network error:', error.message);
  }
}
```

### 5. Loading States

**Ödeme işlemi sırasında loading state gösterin:**
- Ödeme başlatma: Loading
- 3D Secure yönlendirme: Loading
- Webhook bekleniyor: Loading

### 6. Polling (Webhook Bekleme)

**Webhook gelene kadar payment status'u kontrol edin:**
```javascript
const checkPaymentStatus = async (paymentId) => {
  const maxAttempts = 30; // 30 saniye
  let attempts = 0;
  
  const interval = setInterval(async () => {
    attempts++;
    const response = await api.get(`/payments/${paymentId}/status`);
    
    if (response.data.paymentStatus === 'completed') {
      clearInterval(interval);
      // Payment completed
    } else if (attempts >= maxAttempts) {
      clearInterval(interval);
      // Timeout
    }
  }, 1000);
};
```

**Not:** Şu anda payment status endpoint'i yok. Bu endpoint eklenebilir veya frontend Supabase'den direkt okuyabilir.

### 7. CORS

Backend CORS aktif. Frontend URL'i `.env` dosyasında `FRONTEND_URL` olarak tanımlanmalıdır.

---

## 📝 Örnek Request/Response'lar

### Örnek 1: Health Check

**Request:**
```bash
curl -X GET http://localhost:3000/api/health
```

**Response:**
```json
{
  "status": "ok",
  "uptime": 12345.67,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

### Örnek 2: Session Bilgisi

**Request:**
```bash
curl -X GET http://localhost:3000/api/session \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "id": "df612602-69f0-4e3c-ac31-f23c5ada8d77",
  "email": "user@example.com",
  "roles": ["user"]
}
```

---

### Örnek 3: Ödeme İşlemi

**Request:**
```bash
curl -X POST http://localhost:3000/api/payments/process \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "123e4567-e89b-12d3-a456-426614174000",
    "totalAmount": 2000.0
  }'
```

**Response (Success):**
```json
{
  "id": "payment-uuid-123",
  "deviceId": "123e4567-e89b-12d3-a456-426614174000",
  "paymentStatus": "pending",
  "escrowStatus": "pending",
  "totalAmount": 2000.0,
  "providerTransactionId": "paynet-txn-123",
  "publishableKey": "pk_test_...",
  "paymentUrl": "https://api.paynet.com.tr/v2/transaction/tds_initial"
}
```

**Response (Error - Tutar Uyuşmazlığı):**
```json
{
  "statusCode": 400,
  "message": "Amount mismatch. Expected: 2000.0, Received: 1500.0",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/api/payments/process"
}
```

---

### Örnek 4: PAYNET Connection Test

**Request:**
```bash
curl -X GET http://localhost:3000/api/payments/test-paynet-connection \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response:**
```json
{
  "success": true,
  "message": "PAYNET API connection tests passed. Ready for integration testing.",
  "config": {
    "apiUrl": "https://api.paynet.com.tr",
    "hasApiKey": true,
    "hasSecretKey": true,
    "hasPublishableKey": true,
    "secretKeyPrefix": "sk_test_...",
    "publishableKeyPrefix": "pk_test_..."
  },
  "testResults": [
    {
      "test": "Base URL Connectivity",
      "success": true,
      "statusCode": 200,
      "message": "Server is reachable (HTTP 200)"
    },
    {
      "test": "Authentication Format",
      "success": true,
      "message": "Using HTTP Basic Authentication (PAYNET standard)"
    },
    {
      "test": "Configuration",
      "success": true,
      "message": "All required configuration values are set"
    }
  ]
}
```

---

## 🔒 Güvenlik Notları

### 1. Token Güvenliği

- Token'ları localStorage'da saklamayın (XSS riski)
- httpOnly cookie kullanın veya secure storage kullanın
- Token süresi dolduğunda refresh token kullanın

### 2. Tutar Doğrulama

- **ASLA** frontend'den gelen tutara güvenmeyin
- Backend her zaman veritabanından tutarı doğrular
- Frontend'de tutar gösterimi için backend'den gelen değeri kullanın

### 3. Webhook Güvenliği

- IP whitelist kontrolü yapılır
- Signature verification (opsiyonel) yapılır
- Idempotency kontrolü yapılır

### 4. CORS

- Sadece güvenilir domain'lerden istek kabul edilir
- `.env` dosyasında `FRONTEND_URL` tanımlanmalıdır

---

## 📚 Ek Kaynaklar

- [PAYNET API Referansı](./PAYNET_API_REFERENCE.md)
- [Backend Roadmap](../docs/backend%20roadmap)
- [Process Flow](./PROCESS_FLOW.md)
- [Swagger UI](http://localhost:3000/api/docs)

---

## 🆘 Destek

Sorularınız için:
- Backend geliştirici ile iletişime geçin
- Swagger UI'da endpoint'leri test edin
- Backend loglarını kontrol edin

---

**Son Güncelleme:** 2025-01-15
**Versiyon:** 1.0.0

