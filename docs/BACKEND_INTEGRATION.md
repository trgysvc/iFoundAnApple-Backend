# Backend Entegrasyon Dokümantasyonu

Bu dokümantasyon, **iFoundAnApple-Web** frontend projesi için ayrı bir backend repository açarken gerekli tüm bilgileri içerir.

## 📋 İçindekiler

1. [Proje Bilgileri](#proje-bilgileri)
2. [Veritabanı Şeması](#veritabanı-şeması)
3. [API Endpoint'leri](#api-endpointleri)
4. [Frontend Entegrasyon Notları](#frontend-entegrasyon-notları)
5. [Veri Modelleri](#veri-modelleri)
6. [Konfigürasyon](#konfigürasyon)
7. [Ödeme Gateway Entegrasyonu](#ödeme-gateway-entegrasyonu)
8. [Paynet Entegrasyonu](#paynet-entegrasyonu)
9. [Kargo API Entegrasyonu](#kargo-api-entegrasyonu)
10. [Admin Paneli API'leri](#admin-paneli-apileri)
11. [Webhook Endpoint'leri](#webhook-endpointleri)
12. [Error Handling](#error-handling)
13. [Güvenlik Gereksinimleri](#güvenlik-gereksinimleri)
14. [Local Test ve Geliştirme](#local-test-ve-geliştirme)
15. [Örnek Request/Response'lar](#örnek-requestresponse-lar)
16. [Örnek API İstekleri](#örnek-api-istekleri)
17. [Frontend-Backend Entegrasyon Noktaları](#frontend-backend-entegrasyon-noktaları)
18. [Referans Dosyalar](#referans-dosyalar)
19. [Backend Geliştirme Önerileri](#backend-geliştirme-önerileri)
20. [İletişim ve Destek](#iletişim-ve-destek)

---

## 📦 Proje Bilgileri

### Proje Adı
**iFoundAnApple** - Lost & Found Platform for Apple Devices

### Versiyon
**Frontend Version:** 2.2.0

### Proje Tipi
- Frontend: React + TypeScript + Vite (SPA)
- Backend: Supabase (PostgreSQL + Auth + Storage)
- Ödeme Gateway: İyzico, Paynet (sandbox/production)
- Kargo Entegrasyonu: Kargo API'leri (MNG, Yurtiçi, Aras, vb.)
- Admin Paneli: Backend üzerinden yönetim paneli

### Repository Bilgileri
- **Frontend Repo:** `iFoundAnApple-Web`
- **Backend Repo:** (Yeni oluşturulacak)
- **Database:** Supabase PostgreSQL (cloud-hosted)

---

## 🗄️ Veritabanı Şeması

### Veritabanı Yönetimi
- **Provider:** Supabase (PostgreSQL)
- **Schema:** `public`
- **RLS:** Row Level Security aktif (tüm tablolarda)

### Önemli Tablolar ve İlişkiler

#### 1. **users** (Supabase Auth)
- Supabase Auth tarafından yönetilir
- Ek profil bilgileri için `userprofile` tablosu kullanılır

#### 2. **devices**
```sql
- id: uuid (PK)
- user_id: uuid (FK → auth.users)
- model: text
- serial_number: text
- status: text (DeviceStatus enum)
- color: text
- description: text
- reward_amount: numeric
- invoice_url: text (Supabase Storage URL)
- lost_date: date
- lost_location: text
- found_date: date
- found_location: text
- device_role: varchar(10) ('owner' | 'finder')
- created_at: timestamp
- updated_at: timestamp
```

**Status Değerleri:**
- `lost` - Sahip cihazı kaybetti
- `reported` - Bulan kişi cihazı bildirdi
- `matched` - Sistem eşleşme buldu
- `payment_pending` - Ödeme bekleniyor
- `payment_completed` - Ödeme tamamlandı
- `cargo_shipped` - Kargo gönderildi
- `delivered` - Teslim edildi
- `confirmed` - Sahip teslim aldı
- `completed` - İşlem tamamlandı
- `disputed` - İhtilaflı
- `cancelled` - İptal edildi
- `returned` - İade edildi
- `failed_delivery` - Teslimat başarısız

#### 3. **payments**
```sql
- id: uuid (PK)
- device_id: uuid (FK → devices)
- payer_id: uuid (FK → auth.users)
- receiver_id: uuid (FK → auth.users)
- total_amount: numeric(10,2)
- reward_amount: numeric(10,2)
- cargo_fee: numeric(10,2)
- payment_gateway_fee: numeric(10,2)
- service_fee: numeric(10,2)
- net_payout: numeric(10,2)
- payment_provider: varchar(50) ('iyzico' | 'stripe' | 'test')
- provider_payment_id: varchar(200)
- provider_transaction_id: varchar(200)
- provider_status: varchar(50)
- payment_status: varchar(20) ('pending' | 'processing' | 'completed' | 'failed')
- escrow_status: varchar(20) ('pending' | 'held' | 'released' | 'refunded')
- payment_method: varchar(50)
- currency: varchar(3) ('TRY')
- payer_info: jsonb
- device_info: jsonb
- billing_address: jsonb
- shipping_address: jsonb
- created_at: timestamp
- updated_at: timestamp
- completed_at: timestamp
```

#### 4. **escrow_accounts**
```sql
- id: uuid (PK)
- payment_id: uuid (FK → payments)
- device_id: uuid (FK → devices)
- holder_user_id: uuid (FK → auth.users)
- beneficiary_user_id: uuid (FK → auth.users)
- total_amount: numeric(10,2)
- reward_amount: numeric(10,2)
- service_fee: numeric(10,2)
- gateway_fee: numeric(10,2)
- cargo_fee: numeric(10,2)
- net_payout: numeric(10,2)
- status: varchar(20) ('pending' | 'held' | 'released' | 'refunded')
- release_conditions: jsonb
- confirmations: jsonb
- created_at: timestamp
- held_at: timestamp
- released_at: timestamp
- refunded_at: timestamp
```

#### 5. **device_models**
```sql
- id: uuid (PK)
- name: text
- model_name: varchar(100)
- category: varchar(50)
- repair_price: numeric(10,2)
- ifoundanapple_fee: numeric(10,2)
- fee_percentage: numeric(5,2) (default: 10.00)
- is_active: boolean
- created_at: timestamp
- updated_at: timestamp
```

#### 6. **cargo_shipments**
```sql
- id: uuid (PK)
- device_id: uuid (FK → devices)
- payment_id: uuid (FK → payments)
- cargo_company: varchar(50)
- tracking_number: varchar(100)
- sender_user_id: uuid (FK → auth.users)
- receiver_user_id: uuid (FK → auth.users)
- sender_address_encrypted: text
- receiver_address_encrypted: text
- status: varchar(30) ('created' | 'picked_up' | 'in_transit' | 'delivered' | 'failed')
- cargo_fee: numeric(8,2)
- created_at: timestamp
- updated_at: timestamp
```

#### 7. **userprofile**
```sql
- id: uuid (PK)
- user_id: uuid (FK → auth.users) UNIQUE
- first_name: varchar(100)
- last_name: varchar(100)
- tc_kimlik_no: varchar(11) (encrypted)
- phone_number: varchar(20)
- address: text (encrypted)
- iban: varchar(34) (encrypted)
- date_of_birth: date
- created_at: timestamp
- updated_at: timestamp
```

#### 8. **notifications**
```sql
- id: uuid (PK)
- user_id: uuid (FK → auth.users)
- message_key: text
- link: text
- is_read: boolean
- replacements: jsonb
- created_at: timestamp
```

#### 9. **audit_logs**
```sql
- id: uuid (PK)
- event_type: varchar(50)
- event_category: varchar(30)
- event_action: varchar(30)
- event_severity: varchar(20)
- user_id: uuid
- resource_type: varchar(50)
- resource_id: uuid
- old_values: jsonb
- new_values: jsonb
- event_description: text
- event_data: jsonb
- created_at: timestamp
```

### Detaylı Veritabanı Şeması
Tüm tablo yapıları, RLS politikaları ve foreign key ilişkileri için:
📄 **`database/COMPLETE_DATABASE_SCHEMA.md`** dosyasına bakın.

---

## 🔌 API Endpoint'leri

### Base URL

**Development:**
```
http://localhost:3000/v1
```

**Production:**
```
https://api.ifoundanapple.com/v1
```

### API Versiyonu

- **Version:** 1.0.0
- **Format:** REST API
- **Content-Type:** `application/json`
- **Character Encoding:** UTF-8

### Swagger Dokümantasyonu

Backend'de interaktif API dokümantasyonu mevcuttur:

```
http://localhost:3000/v1/docs
```

Swagger UI'da tüm endpoint'leri test edebilir, request/response formatlarını görebilirsiniz.

### CORS (Cross-Origin Resource Sharing)

Backend CORS aktif durumda. Frontend URL'i `.env` dosyasında `FRONTEND_URL` olarak tanımlanmalı.

### Authentication

Tüm endpoint'ler (public olanlar hariç) Supabase JWT token gerektirir:
```
Authorization: Bearer <supabase_jwt_token>
```

**Token Formatı:**
```
Authorization: Bearer <supabase_jwt_token>
```

**Token Nasıl Alınır?**
1. Frontend'de Supabase Auth ile kullanıcı girişi yapılır
2. Supabase `access_token` döner
3. Bu token her API isteğinde `Authorization` header'ında gönderilir

**Örnek:**
```javascript
const token = supabase.auth.session()?.access_token;

fetch('http://localhost:3000/v1/session', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

**Token Doğrulama:**
- Token Supabase SDK ile doğrulanır
- Token geçersiz veya süresi dolmuşsa `401 Unauthorized` döner
- Token'da kullanıcı bilgileri (`user.id`, `user.email`, vb.) bulunur

**Public Endpoints:**
- `GET /v1/health` - Health check

### 1. Health Check

#### `GET /v1/health`

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

### 2. Authentication & Session

#### `GET /v1/session`

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

### 3. Ödeme İşleme

**BACKEND SORUMLULUĞU (Ödeme Süreci):**
- Backend, Paynet ile ödeme haberleşmesini üstlenir
- Frontend/iOS'tan gelen ödeme talebini alır
- **Payment ID oluşturur ve veritabanına yazar** (`payments` tablosuna `status = 'pending'` ile)
- Paynet API ile haberleşerek başarılı/başarısız ödeme sürecini yönetir
- **Webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true) tüm veritabanı kayıtlarını oluşturur:**
  - `payments` tablosunu günceller
  - `escrow_accounts` tablosuna kayıt oluşturur
  - `devices` tablosunda status'u `payment_completed` yapar
  - `audit_logs` tablosuna kayıt oluşturur
  - `notifications` tablosuna bildirim kayıtları oluşturur
- Veritabanından **okuma** yapar (kontrol amaçlı: device status, user kontrolü, tutar doğrulama)
- Ödeme sonucunu frontend/iOS'a bildirir

**FRONTEND/IOS SORUMLULUĞU:**
- Backend'den gelen ödeme sonucunu alır
- Kullanıcı ekranlarını düzenleyerek kullanıcıyı bilgilendirir
- ❌ **Veritabanına YAZMAZ** - Tüm veritabanı işlemleri backend tarafından yapılır

#### 3.1. Ödeme Başlatma

#### `POST /v1/payments/process`

Eşleşmiş bir cihaz için ödeme işlemini başlatır.

**BACKEND SORUMLULUĞU (Ödeme Süreci):**
- Backend, Paynet ile ödeme haberleşmesini üstlenir
- Frontend/iOS'tan gelen ödeme talebini alır
- **Payment ID oluşturur ve veritabanına yazar** (`payments` tablosuna `status = 'pending'` ile)
- Paynet API ile haberleşerek başarılı/başarısız ödeme sürecini yönetir
- **Webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true) tüm veritabanı kayıtlarını oluşturur:**
  - `payments` tablosunu günceller
  - `escrow_accounts` tablosuna kayıt oluşturur
  - `devices` tablosunda status'u `payment_completed` yapar
  - `audit_logs` tablosuna kayıt oluşturur
  - `notifications` tablosuna bildirim kayıtları oluşturur
- Veritabanından **okuma** yapar (kontrol amaçlı: device status, user kontrolü, tutar doğrulama)
- Ödeme sonucunu frontend/iOS'a bildirir

**FRONTEND/IOS SORUMLULUĞU:**
- Backend'den gelen ödeme sonucunu alır
- Kullanıcı ekranlarını düzenleyerek kullanıcıyı bilgilendirir
- ❌ **Veritabanına YAZMAZ** - Tüm veritabanı işlemleri backend tarafından yapılır

**Authentication:** Gerekli (Bearer Token)

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
- `feeBreakdown` (object, **ZORUNLU**): Ücret dökümü (frontend/iOS tarafından hesaplanır, webhook geldiğinde veritabanı kayıtlarını oluşturmak için kullanılır)
  - `rewardAmount` (number): Bulan kişi ödülü (%20)
  - `cargoFee` (number): Kargo ücreti (250.00 TL sabit)
  - `serviceFee` (number): Hizmet bedeli (geriye kalan)
  - `gatewayFee` (number): Gateway komisyonu (%3.43)
  - `totalAmount` (number): Toplam tutar
  - `netPayout` (number): Bulan kişiye gidecek net tutar

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
  "paymentUrl": "https://api.paynet.com.tr/v2/transaction/tds_initial",
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

**Response Fields:**
- `id` (string): Payment ID (UUID) - Frontend/iOS tarafından localStorage/UserDefaults'a kaydedilir
- `deviceId` (string): Device ID - Frontend/iOS tarafından localStorage/UserDefaults'a kaydedilir
- `paymentStatus` (string): Ödeme durumu (`pending`, `completed`, `failed`)
- `escrowStatus` (string): Escrow durumu (`pending`, `held`, `released`)
- `totalAmount` (number): Toplam tutar
- `providerTransactionId` (string, opsiyonel): PAYNET transaction ID
- `publishableKey` (string, opsiyonel): PAYNET publishable key (frontend/iOS için)
- `paymentUrl` (string, opsiyonel): 3D Secure ödeme URL'i
- `feeBreakdown` (object, opsiyonel): Ücret dökümü - Frontend/iOS tarafından localStorage/UserDefaults'a kaydedilir (webhook geldiğinde kullanılır)

**Status Codes:**
- `201 Created` - Ödeme başarıyla başlatıldı
- `400 Bad Request` - Geçersiz request veya tutar uyuşmazlığı
- `401 Unauthorized` - Geçersiz token
- `404 Not Found` - Cihaz bulunamadı

**Önemli Notlar:**

1. **Tutar Doğrulama:** Backend, frontend'den gelen `totalAmount` değerini veritabanındaki `device_models.ifoundanapple_fee` değeri ile karşılaştırır. Eğer tutarlar eşleşmezse `400 Bad Request` döner.

2. **Ücret Hesaplama:** Ücretler frontend/iOS tarafından hesaplanır ve `feeBreakdown` olarak gönderilir:
   ```
   totalAmount = device_models.ifoundanapple_fee
   gatewayFee = totalAmount * 0.0343 (3.43%)
   cargoFee = 250.00 TL (sabit)
   rewardAmount = totalAmount * 0.20 (20%)
   serviceFee = totalAmount - gatewayFee - cargoFee - rewardAmount
   netPayout = rewardAmount
   ```

3. **Cihaz Durumu:** Cihaz `status = 'payment_pending'` olmalıdır. Aksi halde `400 Bad Request` döner.

4. **Kullanıcı Kontrolü:** Sadece cihaz sahibi (device.userId) ödeme yapabilir. Başka kullanıcı denerse `400 Bad Request` döner.

5. **PAYNET Entegrasyonu:** Ödeme PAYNET 3D Secure ile başlatılır. `is_escrow: true` parametresi ile gönderilir (ödeme PAYNET tarafında tutulur).

6. **Backend Veritabanı İşlemleri:** Backend, **Payment ID oluşturur ve veritabanına yazar** (`payments` tablosuna `status = 'pending'` ile). Paynet API ile iletişim kurar ve `paymentUrl`, `publishableKey` gibi bilgileri frontend/iOS'a döner.

7. **Frontend/iOS İşlemleri:** Frontend/iOS, `deviceId` ve `feeBreakdown`'ı localStorage/UserDefaults'a kaydeder (sadece kullanıcı deneyimi için). **Veritabanına YAZMAZ** - Tüm veritabanı işlemleri backend tarafından webhook geldiğinde yapılır.

---

#### 3.2. 3D Secure Tamamlama

#### `POST /v1/payments/complete-3d`

3D Secure doğrulaması sonrası ödemeyi tamamlar. Frontend, PAYNET callback'inden gelen `session_id` ve `token_id`'yi bu endpoint'e gönderir.

**Authentication:** Gerekli (Bearer Token)

**Request Body:**
```json
{
  "paymentId": "123e4567-e89b-12d3-a456-426614174000",
  "sessionId": "session_abc123xyz",
  "tokenId": "token_xyz789abc"
}
```

**Request Fields:**
- `paymentId` (string, UUID, **ZORUNLU**): Ödeme başlatma sırasında alınan payment ID
- `sessionId` (string, **ZORUNLU**): PAYNET 3D Secure callback'inden gelen session ID
- `tokenId` (string, **ZORUNLU**): PAYNET 3D Secure callback'inden gelen token ID

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

**Güvenlik Kontrolleri:**
- Payment'ın kullanıcıya ait olduğu doğrulanır (`payer_id` kontrolü)
- Payment'ın `pending` status'ünde olduğu kontrol edilir
- Session ID ve Token ID PAYNET'e gönderilir

**Önemli Notlar:**
1. Bu endpoint, 3D Secure doğrulaması sonrası çağrılmalıdır
2. Backend, Paynet API'ye 3D Secure sonucu gönderir
3. Final payment status webhook ile güncellenir (`POST /v1/webhooks/paynet-callback`)
4. Backend, webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true) tüm veritabanı kayıtlarını oluşturur
5. Frontend/iOS, webhook işlenene kadar payment status'u polling ile takip eder (`GET /v1/payments/{paymentId}/status`)

---

#### 3.3. Payment Status Kontrolü

#### `GET /v1/payments/{paymentId}/status`

Payment status'u ve webhook durumunu kontrol eder. Frontend/iOS tarafından webhook gelene kadar polling yapmak için kullanılır.

**Authentication:** Gerekli (Bearer Token)

**Path Parameters:**
- `paymentId` (string, UUID, **ZORUNLU**): Payment ID

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

**Response Fields:**
- `id` (string): Payment ID
- `deviceId` (string): Device ID
- `paymentStatus` (string): Ödeme durumu (`pending`, `completed`, `failed`)
- `escrowStatus` (string): Escrow durumu (`pending`, `held`, `released`)
- `webhookReceived` (boolean): Webhook geldi mi? (Frontend/iOS bu değer `true` olduğunda webhook data'yı alır)
- `totalAmount` (number): Toplam tutar
- `providerTransactionId` (string, opsiyonel): PAYNET transaction ID

**Status Codes:**
- `200 OK` - Payment status başarıyla alındı
- `401 Unauthorized` - Geçersiz token
- `404 Not Found` - Payment bulunamadı

**Önemli Notlar:**
1. Frontend/iOS tarafından webhook işlenene kadar polling yapılır (30 deneme, 10 saniye aralık önerilir)
2. Backend, webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true) tüm veritabanı kayıtlarını oluşturur
3. `paymentStatus: 'completed'` olduğunda frontend/iOS ödeme başarılı sayfasına yönlendirilir
4. Frontend/iOS veritabanına yazmaz - Tüm işlemler backend tarafından yapılır

---

#### 3.4. Webhook Data Çekme

#### `GET /v1/payments/{paymentId}/webhook-data`

Webhook geldiğinde, webhook payload'ını frontend/iOS'a sağlar. Frontend/iOS bu data ile veritabanı kayıtlarını oluşturur.

**Authentication:** Gerekli (Bearer Token)

**Path Parameters:**
- `paymentId` (string, UUID, **ZORUNLU**): Payment ID

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

**Response Fields:**
- `success` (boolean): İşlem başarılı mı?
- `webhookData` (object, opsiyonel): Webhook payload
  - `reference_no` (string): Paynet referans numarası
  - `is_succeed` (boolean): Ödeme başarılı mı?
  - `amount` (number): Toplam tutar
  - `netAmount` (number): Net tutar
  - `comission` (number): Komisyon
  - `authorization_code` (string): Yetkilendirme kodu
  - `order_id` (string): Sipariş ID
  - `xact_date` (string): İşlem tarihi (ISO 8601)
- `error` (string, opsiyonel): Hata mesajı

**Status Codes:**
- `200 OK` - Webhook data başarıyla alındı
- `401 Unauthorized` - Geçersiz token
- `404 Not Found` - Payment veya webhook data bulunamadı

**Önemli Notlar:**
1. Bu endpoint, webhook data'yı frontend/iOS'a sağlamak için kullanılabilir (opsiyonel)
2. **Backend, webhook geldiğinde zaten tüm veritabanı kayıtlarını oluşturmuştur** - Bu endpoint sadece webhook data'yı görüntülemek için kullanılabilir
3. Frontend/iOS, veritabanı kaydı oluşturmaz - Tüm işlemler backend tarafından yapılır
4. `is_succeed: false` ise backend sadece payment status'unu `failed` olarak günceller

---

#### 3.5. Paynet Connection Test

#### `GET /v1/payments/test-paynet-connection`

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

### 4. Admin Endpoints

#### `GET /v1/admin/diagnostics`

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

### 5. Escrow Serbest Bırakma

**ÖNEMLİ:** Backend sadece Paynet API'ye escrow release isteği gönderir. Veritabanı güncellemeleri frontend/iOS tarafından yapılır.

```
POST /v1/payments/release-escrow
Headers:
  Authorization: Bearer <JWT_TOKEN>

Request Body:
{
  paymentId: string;
  deviceId: string;
  releaseReason: string;
  confirmedBy?: string;
}

Response:
{
  success: boolean;
  escrowId?: string;
  status?: string;
  releasedAt?: string;
  errorMessage?: string;
}
```

**Backend İşlemleri:**
- Paynet API'ye escrow release isteği gönderilir (`POST /v1/transaction/escrow_status_update`)
- **Backend, Paynet'ten başarılı yanıt aldıktan sonra tüm veritabanı güncellemelerini yapar:**
  - `escrow_accounts` tablosunda `status = 'released'` günceller
  - `financial_transactions` kaydı oluşturur
  - `devices` tablosunda `status = 'completed'` günceller
  - `payments` tablosunda `status = 'completed'` günceller
  - `audit_logs` tablosuna kayıt oluşturur
  - `notifications` tablosuna bildirim kayıtları oluşturur
- Frontend/iOS, backend'den başarılı yanıt alır ve kullanıcıya gösterir (veritabanına yazmaz)

### 6. Ödeme İptal
```
POST /api/cancel-transaction
Request Body:
{
  paymentId: string;
  reason: string;
}

Response:
{
  success: boolean;
  paymentId?: string;
  status?: string;
  cancelledAt?: string;
  errorMessage?: string;
}
```

### 7. Ödeme İade
```
POST /api/refund-transaction
Request Body:
{
  paymentId: string;
  amount?: number; // Partial refund için
  reason: string;
}

Response:
{
  success: boolean;
  refundId?: string;
  status?: string;
  refundedAt?: string;
  errorMessage?: string;
}
```

### 8. İhtilaf Başlatma
```
POST /api/dispute-transaction
Request Body:
{
  paymentId: string;
  deviceId: string;
  reason: string;
  description: string;
}

Response:
{
  success: boolean;
  disputeId?: string;
  status?: string;
  errorMessage?: string;
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
  baseURL: 'http://localhost:3000/v1',
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
     totalAmount: 2000.0,
     feeBreakdown: {
       rewardAmount: 400.0,
       cargoFee: 250.0,
       serviceFee: 1281.4,
       gatewayFee: 68.6,
       totalAmount: 2000.0,
       netPayout: 400.0
     }
   });
   
   const { paymentUrl, publishableKey, id, deviceId, feeBreakdown } = response.data;
   
   // localStorage'a kaydet
   localStorage.setItem('current_payment_id', id);
   localStorage.setItem('current_device_id', deviceId);
   localStorage.setItem('current_fee_breakdown', JSON.stringify(feeBreakdown));
   ```

2. **3D Secure Yönlendirme:**
   - `paymentUrl`'e kullanıcıyı yönlendirin
   - Veya `html_content` varsa iframe içinde gösterin

3. **Return URL İşleme:**
   ```javascript
   // Callback sayfasında session_id ve token_id'yi al
   const sessionId = searchParams.get('session_id');
   const tokenId = searchParams.get('token_id');
   const paymentId = localStorage.getItem('current_payment_id');
   
   // Backend'e 3D tamamlama isteği gönder
   const response = await api.post('/payments/complete-3d', {
     paymentId,
     sessionId,
     tokenId
   });
   ```

4. **Webhook Bekleme:**
   - Backend'den başarılı yanıt geldikten sonra webhook beklenir
   - Payment status'u polling ile takip edilir
   - Payment status `completed` olduğunda success sayfasına yönlendirilir

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

### 4.1. Ödeme Sürecindeki Aksaklıklar ve Önlemler

Backend, Paynet dokümantasyonuna uygun olarak ([doc.paynet.com.tr](https://doc.paynet.com.tr)) aşağıdaki önlemleri almıştır:

#### Paynet ile İletişim Kesilirse

**Backend Önlemleri:**
- ✅ **Retry Mekanizması:** Exponential backoff ile 3 deneme (1s, 2s, 4s gecikme)
- ✅ **Timeout Ayarı:** 30 saniye timeout ile uzun süren istekler kesilir
- ✅ **Aynı Reference No:** Paynet dokümantasyonuna göre, aynı `reference_no` ile retry yapılabilir - sistem önceki başarılı işlemi döndürür

**Frontend/iOS Önlemleri:**
- Ödeme başlatma başarısız olursa, kullanıcıya hata mesajı gösterilir
- "Tekrar Dene" butonu ile kullanıcı tekrar deneme yapabilir
- Payment kaydı `pending` durumunda kalır, kullanıcı tekrar ödeme yapabilir

#### Ödeme İşlemi Olumsuz Sonuçlanırsa

**Backend Önlemleri:**
- ✅ Webhook'ta `is_succeed: false` geldiğinde otomatik işleme alınır
- ✅ Payment status `failed` olarak güncellenir
- ✅ Device status `payment_pending`'e döner (kullanıcı tekrar ödeme yapabilir)
- ✅ Kullanıcıya bildirim gönderilir
- ✅ Audit log kaydı oluşturulur

**Frontend/iOS Önlemleri:**
- Backend'den hata mesajı alınır ve kullanıcıya gösterilir
- "Tekrar Dene" butonu ile ödeme sayfasına geri dönülür
- Device status `payment_pending` olduğu için kullanıcı tekrar ödeme yapabilir

#### Paynet Tarafında Aksaklık Sonucu Webhook Gelmezse

**Backend Önlemleri:**
- ✅ **Otomatik Payment Reconciliation:** Her 5 dakikada bir pending payment'lar kontrol edilir
- ✅ **Webhook Storage:** Tüm webhook payload'ları `webhook_storage` tablosunda saklanır
- ✅ **Retry Mekanizması:** Her 1 saatte bir başarısız webhook işlemleri tekrar denenir (maksimum 5 deneme)
- ✅ **Manuel İnceleme:** 10 dakikadan eski pending payment'lar için audit log oluşturulur

**Frontend/iOS Önlemleri:**
- Polling mekanizması: 30 deneme, 10 saniye aralık (toplam 5 dakika)
- Timeout durumunda kullanıcıya bilgi verilir
- Backend'den payment status kontrol edilir

#### Webhook İşleme Başarısız Olursa

**Backend Önlemleri:**
- ✅ Webhook `webhook_storage` tablosuna kaydedilir
- ✅ Retry mekanizması ile otomatik tekrar deneme (maksimum 5 deneme)
- ✅ Hata mesajı ve retry count kaydedilir
- ✅ Her 1 saatte bir başarısız webhook'lar tekrar denenir

**Referans:** Paynet dokümantasyonuna göre, bağlantı zaman aşımı durumunda aynı `reference_no` ile işlemi tekrarlayabilirsiniz. Sistem, daha önce başarılı bir işlem varsa onu döndürür. ([doc.paynet.com.tr](https://doc.paynet.com.tr/oedeme-metotlari/api-entegrasyonu/odeme))

### 5. Loading States

**Ödeme işlemi sırasında loading state gösterin:**
- Ödeme başlatma: Loading
- 3D Secure yönlendirme: Loading
- Webhook bekleniyor: Loading

### 6. Polling (Webhook Bekleme)

**Webhook gelene kadar payment status'u kontrol edin:**
```javascript
const checkPaymentStatus = async (paymentId) => {
  const maxAttempts = 30; // 30 deneme
  const intervalSeconds = 1; // 1 saniye aralık
  let attempts = 0;
  
  const interval = setInterval(async () => {
    attempts++;
    try {
      const response = await api.get(`/payments/${paymentId}/status`);
      
      if (response.data.webhookReceived) {
        clearInterval(interval);
        // Webhook geldi, webhook data'yı al
        const webhookResponse = await api.get(`/payments/${paymentId}/webhook-data`);
        
        if (webhookResponse.data.webhookData?.is_succeed) {
          // Ödeme başarılı - veritabanı kayıtlarını oluştur
          const feeBreakdown = JSON.parse(localStorage.getItem('current_fee_breakdown'));
          const deviceId = localStorage.getItem('current_device_id');
          
          // Supabase'e kayıt oluştur
          await createPaymentRecord(webhookResponse.data.webhookData, feeBreakdown, deviceId);
          await createEscrowRecord(webhookResponse.data.webhookData, feeBreakdown, deviceId);
          await updateDeviceStatus(deviceId, 'payment_completed');
          
          // Success sayfasına yönlendir
          router.push('/payment/success');
        } else {
          // Ödeme başarısız
          router.push('/payment/failed');
        }
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        // Timeout - kullanıcıyı bilgilendir
        console.error('Payment status check timeout');
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }
  }, intervalSeconds * 1000);
};
```

### 7. CORS

Backend CORS aktif. Frontend URL'i `.env` dosyasında `FRONTEND_URL` olarak tanımlanmalıdır.

---

## 📐 Veri Modelleri

### TypeScript Interfaces

#### User
```typescript
enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email: string;
  role: UserRole;
  dateOfBirth?: string;
  tcKimlikNo?: string;
  phoneNumber?: string;
  address?: string;
  iban?: string;
}
```

#### Device
```typescript
enum DeviceStatus {
  LOST = "lost",
  REPORTED = "reported",
  MATCHED = "matched",
  PAYMENT_PENDING = "payment_pending",
  PAYMENT_COMPLETED = "payment_completed",
  CARGO_SHIPPED = "cargo_shipped",
  DELIVERED = "delivered",
  CONFIRMED = "confirmed",
  EXCHANGE_PENDING = "exchange_pending",
  COMPLETED = "completed",
  DISPUTED = "disputed",
  CANCELLED = "cancelled",
  RETURNED = "returned",
  FAILED_DELIVERY = "failed_delivery",
}

interface Device {
  id: string;
  userId: string;
  model: string;
  serialNumber: string;
  color: string;
  invoice_url?: string;
  description?: string;
  status: DeviceStatus;
  rewardAmount?: number;
  marketValue?: number;
  exchangeConfirmedBy?: string[];
  lost_date?: string;
  lost_location?: string;
  found_date?: string;
  found_location?: string;
  device_role?: 'owner' | 'finder';
}
```

#### Payment
```typescript
interface Payment {
  id: string;
  device_id: string;
  payer_id: string;
  receiver_id?: string;
  total_amount: number;
  reward_amount: number;
  cargo_fee: number;
  payment_gateway_fee: number;
  service_fee: number;
  net_payout: number;
  payment_provider: 'iyzico' | 'paynet' | 'stripe' | 'test';
  provider_payment_id?: string;
  provider_transaction_id?: string;
  payment_status: 'pending' | 'processing' | 'completed' | 'failed';
  escrow_status: 'pending' | 'held' | 'released' | 'refunded';
  payment_method?: string;
  currency: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}
```

#### FeeBreakdown
```typescript
interface FeeBreakdown {
  rewardAmount: number;
  cargoFee: number;
  serviceFee: number;
  gatewayFee: number;
  totalAmount: number;
  netPayout: number;
  originalRepairPrice: number;
  deviceModel: string;
  category: string;
}
```

**Tüm TypeScript tipleri için:** 📄 **`types.ts`** dosyasına bakın.

---

## ⚙️ Konfigürasyon

### Environment Variables

#### Supabase
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### İyzico Payment Gateway
```env
VITE_IYZICO_API_KEY=your-iyzico-api-key
VITE_IYZICO_SECRET_KEY=your-iyzico-secret-key
VITE_IYZICO_BASE_URL=https://sandbox-api.iyzipay.com
VITE_IYZICO_CALLBACK_URL=https://your-domain.com/api/webhooks/iyzico-callback
```

#### Paynet Payment Gateway
```env
PAYNET_API_URL=https://api.paynet.com.tr
PAYNET_MERCHANT_ID=your-merchant-id
PAYNET_API_KEY=your-api-key
PAYNET_SECRET_KEY=your-secret-key
PAYNET_CALLBACK_URL=https://your-domain.com/api/webhooks/paynet-callback
PAYNET_FAILURE_URL=https://your-domain.com/payment-failed
PAYNET_SUCCESS_URL=https://your-domain.com/payment-success
```

#### Stripe (Opsiyonel)
```env
VITE_STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
VITE_STRIPE_SECRET_KEY=your-stripe-secret-key
VITE_STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
```

#### Kargo API'leri
```env
# MNG Kargo
MNG_API_URL=https://api.mngkargo.com.tr
MNG_API_KEY=your-mng-api-key
MNG_API_SECRET=your-mng-api-secret

# Yurtiçi Kargo
YURTICI_API_URL=https://api.yurticikargo.com
YURTICI_API_KEY=your-yurtici-api-key
YURTICI_API_SECRET=your-yurtici-api-secret

# Aras Kargo
ARAS_API_URL=https://api.araskargo.com.tr
ARAS_API_KEY=your-aras-api-key
ARAS_API_SECRET=your-aras-api-secret

# Kargo Webhook Secret
CARGO_WEBHOOK_SECRET=your-webhook-secret
```

#### Google Gemini AI (Opsiyonel)
```env
VITE_GEMINI_API_KEY=your-gemini-api-key
```

#### Encryption
```env
VITE_ENCRYPTION_KEY=your-encryption-key (32 karakter hex)
```

**ÖNEMLİ - Encryption Key Backup Stratejisi:**

Encryption key (`VITE_ENCRYPTION_KEY`) kritik öneme sahiptir. Bu key olmadan şifrelenmiş veriler (TC Kimlik No, IBAN, adres bilgileri vb.) çözülemez ve kalıcı olarak kaybolur.

**Backup Stratejisi:**
1. **Manuel Yedekleme:** Encryption key **manuel olarak** güvenli bir yerde yedeklenmelidir.
2. **Yedekleme Yöntemleri:**
   - Password manager (1Password, LastPass, Bitwarden vb.) - **Önerilen**
   - Şifrelenmiş dosya (encrypted file) - Offline backup için
   - Güvenli fiziksel depolama (encrypted USB drive, safe deposit box) - Disaster recovery için
3. **Yedekleme Sıklığı:**
   - Key oluşturulduğunda hemen yedeklenmelidir
   - Key değiştirildiğinde yeni key yedeklenmelidir
   - Düzenli olarak yedeklerin erişilebilirliği kontrol edilmelidir
4. **Güvenlik:**
   - Key asla git repository'ye commit edilmemelidir
   - Key asla kod içinde hardcode edilmemelidir
   - Key sadece environment variable olarak kullanılmalıdır
   - Yedekler şifrelenmiş formatta saklanmalıdır
5. **Erişim Kontrolü:**
   - Key'e erişimi olan kişi sayısı minimum tutulmalıdır
   - Key erişimi audit log'lanmalıdır
   - Key rotation stratejisi belirlenmelidir

**Not:** Key kaybı durumunda şifrelenmiş tüm veriler kalıcı olarak kaybolur. Bu nedenle backup stratejisi kritik öneme sahiptir.

#### IBAN Validation
```env
IBAN_VALIDATION_API_KEY=your-iban-validation-api-key
IBAN_VALIDATION_API_URL=https://api.iban.com/v1/validate (örnek)
# veya
IBAN_VALIDATION_SERVICE_KEY=your-iban-validation-service-key
```

### Ücret Hesaplama Sabitleri
```typescript
const FIXED_FEES = {
  CARGO_FEE: 250.0,                    // TL
  GATEWAY_FEE_PERCENTAGE: 3.43,        // %
  REWARD_PERCENTAGE: 20,               // %
  MIN_REWARD_AMOUNT: 100,              // TL
  MAX_REWARD_AMOUNT: 5000,              // TL
};
```

### Ücret Hesaplama Formülü
```
totalAmount = ifoundanapple_fee (device_models tablosundan)
gatewayFee = totalAmount * 0.0343 (%3.43)
cargoFee = 250.00 TL (sabit)
rewardAmount = totalAmount * 0.20 (%20)
serviceFee = totalAmount - gatewayFee - cargoFee - rewardAmount
netPayout = rewardAmount
```

---

## 💳 Ödeme Gateway Entegrasyonu

### İyzico Entegrasyonu

#### Ödeme İsteği Oluşturma
```typescript
import Iyzipay from 'iyzipay';

const iyzico = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY,
  secretKey: process.env.IYZICO_SECRET_KEY,
  uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com'
});

const request = {
  locale: Iyzipay.LOCALE.TR,
  conversationId: paymentId,
  price: amount.toFixed(2),
  paidPrice: amount.toFixed(2),
  currency: 'TRY',
  installment: 1,
  basketId: paymentId,
  paymentChannel: Iyzipay.PAYMENT_CHANNEL.WEB,
  paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
  callbackUrl: `${CALLBACK_URL}?conversationId=${paymentId}`,
  buyer: {
    id: buyerId,
    name: buyerName,
    surname: buyerSurname,
    email: buyerEmail,
    gsmNumber: buyerPhone,
    identityNumber: buyerTCKimlik,
    city: buyerCity,
    country: 'Turkey',
    address: buyerAddress,
    zipCode: buyerZipCode
  },
  billingAddress: { /* ... */ },
  shippingAddress: { /* ... */ },
  basketItems: [/* ... */]
};

iyzico.payment.create(request, (err, result) => {
  // Handle response
});
```

#### Ödeme Durumu Sorgulama
```typescript
iyzico.payment.retrieve({
  locale: Iyzipay.LOCALE.TR,
  conversationId: paymentId,
  paymentId: paymentId
}, (err, result) => {
  // Handle response
});
```

#### İade İşlemi
```typescript
iyzico.cancel.create({
  locale: Iyzipay.LOCALE.TR,
  conversationId: paymentId,
  paymentId: paymentId,
  ip: requestIp
}, (err, result) => {
  // Handle response
});
```

**Detaylı İyzico entegrasyonu için:** 📄 **`utils/iyzicoConfig.ts`** dosyasına bakın.

---

## 💳 Paynet Entegrasyonu

### Paynet Ödeme Sistemi

Paynet, Türkiye'de yaygın kullanılan bir ödeme gateway'idir. Platform bağımsız REST API servisleri sunar ve escrow (emanet) sistemi desteği sağlar. [Paynet API Dokümantasyonu](https://doc.paynet.com.tr/)

### Paynet Gereksinimleri

Paynet API kullanımı için gerekli bilgiler:
- **API Anahtarı**: Paynet API KEY gereklidir ([odeme.paynet.com.tr](https://odeme.paynet.com.tr) veya [email protected] üzerinden talep edilebilir)
- **Statik IP Adresi**: Paynet hizmetlerine erişim için statik IP adresi gereklidir
- **Güvenli İletişim**: TLS 1.1 ve TLS 1.2 protokolleri desteklenir
- **Authentication**: `secret_key` ile Basic Authentication kullanılır

### Paynet Konfigürasyonu

```env
# Paynet Configuration
# Base URLs
PAYNET_API_URL=https://api.paynet.com.tr
PAYNET_TEST_API_URL=https://pts-api.paynet.com.tr

# Authentication Keys
PAYNET_SECRET_KEY=your-secret-key  # HTTP Basic Auth için kullanılır (ZORUNLU)
PAYNET_PUBLISHABLE_KEY=your-publishable-key  # Frontend için (opsiyonel)

# Webhook & Callback URLs
PAYNET_ALLOWED_IPS=104.21.232.181,172.67.202.100  # Paynet webhook IP'leri (opsiyonel)
FRONTEND_URL=http://localhost:3000  # 3D Secure return URL için
BACKEND_URL=http://localhost:3000  # Domain bilgisi için
```

**ÖNEMLİ NOTLAR:**
- **Production Base URL:** `https://api.paynet.com.tr/v1` veya `/v2` (endpoint'e göre)
- **Test Base URL:** `https://pts-api.paynet.com.tr/v1` veya `/v2` (endpoint'e göre)
- **Secret Key:** PAYNET yönetim panelinden alınır, HTTP Basic Authentication için kullanılır
- **Publishable Key:** Frontend'de kullanılabilir (opsiyonel)
- Tüm endpoint'ler `/v1/` veya `/v2/` prefix'i ile başlar (endpoint tipine göre)

### Paynet Ödeme Metotları

Paynet, farklı ödeme entegrasyon yöntemleri sunar:
1. **API Entegrasyonu**: REST API servisleri ile entegrasyon (önerilen backend için)
   - 3D Secure ile ödeme
   - 3D Secure olmadan ödeme (tek çekim, taksitli, saklı kart)
   - PayLink entegrasyonu
2. **PayLink**: SMS/E-posta ile gönderilen güvenli ödeme linki
3. **Hazır Form**: JavaScript ile eklenen hazır ödeme formu
4. **Özelleştirilebilir Form**: Kendi tasarımınıza uygun ödeme formu

**Backend için önerilen:** API Entegrasyonu yöntemi, escrow desteği ve tam kontrol sağladığı için tercih edilmelidir.

### Paynet Ödeme İşleme Endpoint'i

#### Escrow ile Ödeme (Önerilen)

Escrow sistemi için ödeme isteğinde `is_escrow: true` parametresi gönderilmelidir. Bu sayede ödeme ana firma onayıyla gerçekleşir.

**ÖNEMLİ:** Aşağıdaki endpoint referansları **DEPRECATED**'dir. Yeni endpoint'ler yukarıdaki [API Endpoint'leri](#api-endpointleri) bölümünde detaylı olarak açıklanmıştır.

**Yeni Endpoint:** `POST /v1/payments/process` (Detaylar için yukarıdaki [3.1. Ödeme Başlatma](#31-ödeme-başlatma) bölümüne bakın)

**DEPRECATED Endpoint (Kullanılmıyor):**
```
POST /api/process-payment-paynet  ❌ DEPRECATED
```

**Yeni Endpoint Formatı:**
```
POST /v1/payments/process
Headers:
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json

Request Body:
{
  deviceId: string;
  totalAmount: number;
  feeBreakdown: {
    rewardAmount: number;
    cargoFee: number;
    serviceFee: number;
    gatewayFee: number;
    totalAmount: number;
    netPayout: number;
  };
}

Response:
{
  id: string;
  deviceId: string;
  paymentStatus: 'pending';
  escrowStatus: 'pending';
  totalAmount: number;
  providerTransactionId?: string;
  publishableKey?: string;
  paymentUrl?: string;
  feeBreakdown?: {
    rewardAmount: number;
    cargoFee: number;
    serviceFee: number;
    gatewayFee: number;
    totalAmount: number;
    netPayout: number;
  };
}
  redirectUrl?: string; // 3D Secure için yönlendirme URL'i
  providerResponse?: any;
}
```

### Paynet API Endpoint'leri

Backend, Paynet'in şu endpoint'lerini kullanır:

1. **3D Ödeme Başlatma:** `POST /v2/transaction/tds_initial`
2. **3D Ödeme Tamamlama:** `POST /v2/transaction/tds_charge`
3. **Escrow Release:** `POST /v1/transaction/escrow_status_update`

### Paynet 3D Secure Ödeme Formatı

**Kaynak:** [Paynet 3D ile Ödeme Dokümantasyonu](https://doc.paynet.com.tr/oedeme-metotlari/api-entegrasyonu/3d-ile-odeme)

#### 3D Ödeme Başlatma (tds_initial)

**Endpoint:** `POST /v2/transaction/tds_initial`

**Request Format (snake_case):**
```typescript
interface Paynet3DPaymentRequest {
  amount: number;                    // Çekilecek tutar - ZORUNLU
  reference_no: string;              // İşleme ait benzersiz referans numarası (payment_id) - ZORUNLU
  return_url: string;                // 3D doğrulama sonucunun post edileceği URL - ZORUNLU
  domain: string;                    // İşlemin yapıldığı uygulamanın domain bilgisi - ZORUNLU
  is_escrow?: boolean;               // Escrow özelliği (true = ana firma onayına tabi)
  card_holder?: string;              // Kart sahibi bilgisi (saklı kart kullanılmıyorsa zorunlu)
  pan?: string;                      // Kart numarası (saklı kart kullanılmıyorsa zorunlu)
  month?: string;                    // Son kullanma tarihi ay (MM formatında)
  year?: string;                     // Son kullanma tarihi yıl (YY veya YYYY formatında)
  cvc?: string;                      // CVV/CVC kodu
  description?: string;              // Opsiyonel
  installments?: number;             // Taksit sayısı (opsiyonel)
  customer_email?: string;           // Opsiyonel
  customer_name?: string;            // Opsiyonel
  customer_phone?: string;           // Opsiyonel
}
```

**Response Format:**
```json
{
  "success": true,
  "transaction_id": "string",
  "session_id": "string",
  "post_url": "string",              // 3D doğrulama sayfası URL'i
  "html_content": "string",          // 3D doğrulama HTML içeriği
  "error": "string",
  "message": "string"
}
```

**Örnek API Çağrısı:**
```typescript
const authHeader = Buffer.from(`${secretKey}:`).toString('base64');

const response = await fetch('https://api.paynet.com.tr/v2/transaction/tds_initial', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${authHeader}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 2000.0,
    reference_no: paymentId,
    return_url: `${frontendUrl}/payment/callback`,
    domain: new URL(backendUrl).hostname,
    is_escrow: true,
    description: `Payment for device ${deviceModel}`
  })
});
```

#### 3D Ödeme Tamamlama (tds_charge)

**Endpoint:** `POST /v2/transaction/tds_charge`

**Request Format (snake_case):**
```typescript
interface Paynet3DCompleteRequest {
  session_id: string;                // 3D ödeme akışının oturum bilgisi - ZORUNLU
  token_id: string;                  // İşlemin token bilgisi - ZORUNLU
  transaction_type?: number;         // İşlem tipi: 1 = Satış, 3 = Ön provizyon (varsayılan: 1)
}
```

**Response Format:**
```json
{
  "success": true,
  "transaction_id": "string",
  "status": "string",
  "error": "string",
  "message": "string"
}
```

### Paynet Ödeme Akışı

#### 1. Ödeme Başlatma (Backend)

Frontend/iOS, `POST /v1/payments/process` endpoint'ini çağırır. Backend:

1. Tutarı doğrular (veritabanından okur, **yazmaz**)
2. **Payment ve escrow kayıtlarını oluşturmaz** (Frontend/iOS webhook geldiğinde oluşturur)
3. PAYNET'e 3D Secure ödeme isteği gönderir (`is_escrow: true` parametresi ile)
4. PAYNET'ten `post_url` veya `html_content` alır
5. Frontend/iOS'a `paymentUrl` ve `feeBreakdown` döner

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

Frontend/iOS, `session_id` ve `token_id`'yi backend'e gönderir. Backend:

1. Payment'ı doğrular (kullanıcı sahipliği, status kontrolü - veritabanından okur)
2. PAYNET'e `POST /v2/transaction/tds_charge` isteği gönderir
3. Ödeme tamamlanır
4. Backend, webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true) tüm veritabanı kayıtlarını oluşturur
5. Frontend/iOS webhook işlenene kadar polling yapar (`GET /v1/payments/{paymentId}/status`)

**Endpoint:** `POST /v1/payments/complete-3d`

#### 4. Webhook İşleme

**Webhook İşleme Adımları (Backend):**

1. **IP Doğrulama:** İstek IP'si `PAYNET_ALLOWED_IPS` listesinde olmalıdır
2. **Signature Verification:** Opsiyonel (header'da `x-paynet-signature` varsa doğrulanır)
3. **Idempotency Check:** `reference_no` kullanılarak duplicate webhook kontrolü yapılır
4. **Webhook Saklama:** Backend webhook payload'ını `webhook_storage` tablosuna saklar
5. **Payment ID Eşleştirme:** Webhook'tan gelen `reference_no` ile payment ID'yi eşleştirir
6. **Veritabanı Kayıtları:** Eğer ödeme başarılı (is_succeed: true) ise, backend tüm veritabanı kayıtlarını oluşturur:
   - `payments` tablosunu günceller (status, provider bilgileri, fee breakdown vb.)
   - `escrow_accounts` tablosuna kayıt oluşturur
   - `devices` tablosunda status'u `payment_completed` yapar
   - `audit_logs` tablosuna kayıt oluşturur
   - `notifications` tablosuna bildirim kayıtları oluşturur
7. **Frontend/iOS Bildirimi:** Frontend/iOS polling yaparak ödeme sonucunu alır

**Webhook İşleme Adımları (Frontend/iOS):**

1. **Polling:** Frontend/iOS `GET /v1/payments/{paymentId}/status` ile ödeme durumunu kontrol eder
2. **Sonuç Alma:** `paymentStatus: 'completed'` olduğunda ödeme başarılı sayfasına yönlendirilir
3. ❌ **Veritabanına YAZMAZ** - Tüm veritabanı işlemleri backend tarafından yapılır

**Webhook URL Konfigürasyonu:**

PAYNET yönetim panelinde `confirmation_url` olarak şu URL ayarlanmalıdır:

```
https://api.ifoundanapple.com/v1/webhooks/paynet-callback
```

### Paynet Escrow Serbest Bırakma

**Kaynak:** [Paynet Escrow Durum Güncelleme](https://doc.paynet.com.tr/servisler/islem/escrow-durum-guncelleme)

Escrow işlemlerinde, ödeme tamamlandıktan sonra belirli koşullar sağlandığında (cihaz teslim edildi, onaylandı vb.) escrow'dan para serbest bırakılmalıdır.

**Endpoint:** `POST /v1/transaction/escrow_status_update`

**Request Format (snake_case):**
```typescript
interface PaynetEscrowStatusUpdateRequest {
  xact_id?: string;                // PAYNET işlem ID'si (şifrelenmiş) - ZORUNLU (xact_id veya xact en az biri)
  xact?: number;                   // PAYNET işlem ID'si (şifrelenmemiş) - ZORUNLU (xact_id veya xact en az biri)
  status: number;                  // 2 = Onay (Release), 3 = Red (Reject) - ZORUNLU
  note?: string;                   // Maksimum 256 karakter - OPSIYONEL
  agent_id?: string;               // Bayi kodu - OPSIYONEL
  agent_amount?: number;           // Bayiye aktarılacak tutar - OPSIYONEL
}
```

**Status Değerleri:**
- `2`: Onay (Approve/Release) - Escrow serbest bırakılır
- `3`: Red (Reject) - Escrow reddedilir, ödeme iade edilir

**Örnek API Çağrısı:**
```typescript
const authHeader = Buffer.from(`${secretKey}:`).toString('base64');

const releaseResponse = await fetch('https://api.paynet.com.tr/v1/transaction/escrow_status_update', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${authHeader}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    xact_id: paynetTransactionId,
    status: 2,  // 2 = Onay (Release)
    note: 'Device received and confirmed by owner'
  })
});
```

**Backend Endpoint:** `POST /v1/payments/release-escrow`

Backend, Paynet API'ye escrow release isteği gönderir. Veritabanı güncellemeleri frontend/iOS tarafından yapılır.

### Paynet Webhook Handler

**Kaynak:** [Paynet Confirmation URL Parametreleri](https://doc.paynet.com.tr/oedeme-metotlari/ortak-odeme-sayfasi/odeme-emri-olusturma/confirmation-url-adresine-post-edilen-parametreler)

Paynet, ödeme tamamlandığında `confirmation_url` endpoint'inize webhook gönderir.

**Backend Endpoint:** `POST /v1/webhooks/paynet-callback`

**Webhook Payload Formatı (snake_case):**
```json
{
  "reference_no": "string",        // Ödeme işleminin referans numarası (payment_id) - ZORUNLU
  "xact_date": "string",           // Ödeme işleminin yapıldığı zaman
  "agent_id": "string",           // Bayi kodu (opsiyonel)
  "bank_id": "string",            // Ödemenin yapıldığı banka numarası
  "instalment": 1,                // Taksit sayısı
  "card_holder": "string",        // Kart sahibinin adı ve soyadı
  "card_number": "string",        // Kart numarasının ilk 6 ve son 4 hanesi (masked)
  "amount": 2000.0,               // Yapılan ödemenin brüt tutarı
  "netAmount": 1931.4,            // Yapılan ödemenin net tutarı
  "comission": 68.6,              // Hizmet bedeli tutarı
  "comission_tax": 12.34,         // Hizmet bedeli vergisi
  "currency": "TRY",              // Para birimi
  "authorization_code": "string", // Bankadan dönen onay kodu
  "order_id": "string",           // Bankadan dönen satış kodu
  "is_succeed": true              // Ödemenin başarılı olup olmadığı - ZORUNLU
}
```

**Webhook İşleme Adımları:**

1. **IP Doğrulama:** İstek IP'si `PAYNET_ALLOWED_IPS` listesinde olmalıdır (opsiyonel)
2. **Signature Verification:** Opsiyonel (header'da `x-paynet-signature` varsa doğrulanır)
3. **Idempotency Check:** `reference_no` kullanılarak duplicate webhook kontrolü yapılır
4. **Webhook Saklama:** Backend webhook payload'ını `webhook_storage` tablosuna saklar
5. **Payment ID Eşleştirme:** Webhook'tan gelen `reference_no` ile payment ID'yi eşleştirir
6. **Veritabanı Kayıtları:** Eğer ödeme başarılı (is_succeed: true) ise, backend tüm veritabanı kayıtlarını oluşturur:
   - `payments` tablosunu günceller
   - `escrow_accounts` tablosuna kayıt oluşturur
   - `devices` tablosunda status'u `payment_completed` yapar
   - `audit_logs` tablosuna kayıt oluşturur
   - `notifications` tablosuna bildirim kayıtları oluşturur
7. **Frontend/iOS Bildirimi:** Frontend/iOS polling yaparak ödeme sonucunu alır

**Response:**
```json
{
  "received": true
}
```

**ÖNEMLİ:** Backend webhook'u alır, doğrular, saklar ve **eğer ödeme başarılı (is_succeed: true) ise tüm veritabanı kayıtlarını oluşturur**. Frontend/iOS, backend'den ödeme sonucunu alır ve sadece kullanıcıya gösterir - veritabanına yazmaz.

### Paynet Signature Doğrulama

Webhook signature doğrulama, Paynet dokümantasyonunda belirtilmemiş olabilir. Paynet destek ekibiyle doğrulama yöntemi teyit edilmelidir.

**Not:** Şu anda backend'de signature verification placeholder olarak implement edilmiştir. Production'a geçmeden önce Paynet'ten doğrulama yöntemi teyit edilmelidir.

**IP Whitelist Kontrolü:** Webhook güvenliği için IP whitelist kontrolü yapılır. PAYNET'in IP adresleri `.env` dosyasında `PAYNET_ALLOWED_IPS` olarak tanımlanmalıdır.

### Paynet Servisleri

Paynet API aşağıdaki servisleri sunar:
- **İşlem (Transaction)**: Ödeme işlemleri
- **İptal/İade (Cancellation/Refund)**: İptal ve iade işlemleri
- **Oran (Rate)**: Komisyon oranları sorgulama
- **Bayi (Agent)**: Bayi yönetimi
- **Abonelik (Subscription)**: Tekrarlayan ödemeler
- **Kart Saklama (Card Save)**: Müşteri kartlarını güvenli saklama
- **Cari Hesap Entegrasyonu**: Escrow benzeri cari hesap işlemleri
- **Fatura**: Fatura oluşturma ve yönetimi
- **Başvuru**: API erişim başvurusu

Detaylı bilgiler için: [Paynet Dokümantasyon - Servisler](https://doc.paynet.com.tr/servisler)

### Paynet Test Kartları

Paynet test ortamında kullanılabilecek test kartları dokümantasyonda belirtilmiştir. 

**ÖNEMLİ:** Test ortamında ödeme testleri yaparken Paynet'in test kartlarını kullanın. Production ortamında gerçek kart bilgileri kullanılır.

Detaylı bilgiler için: [Paynet Test Kartları](https://doc.paynet.com.tr/genel-bilgiler/test-kartlari)

### Paynet Hata Kodları

Paynet API hata kodları ve açıklamaları dokümantasyonda belirtilmiştir.

**ÖNEMLİ:** Backend'de Paynet API hatalarını uygun şekilde handle edin ve frontend/iOS'a anlamlı hata mesajları döndürün.

Detaylı bilgiler için: [Paynet Hata Kodları](https://doc.paynet.com.tr/genel-bilgiler/hata-kodlari)

### Paynet Publishable Key

Frontend, PAYNET entegrasyonu için `publishableKey` kullanabilir. Bu key, `POST /v1/payments/process` response'unda döner.

**Güvenlik:** Publishable key frontend'de kullanılabilir, ancak secret key asla frontend'e gönderilmemelidir.

### Ödeme Gateway Seçimi

`payment_provider` alanına göre ödeme gateway'i seçilmeli:
- `'iyzico'` → İyzico API kullanılır
- `'paynet'` → Paynet API kullanılır
- `'stripe'` → Stripe API kullanılır
- `'test'` → Test modu (mock payment)

---

## 📦 Kargo API Entegrasyonu

### BACKEND SORUMLULUĞU (Kargo Süreci)

**Backend, kargo firması ile haberleşmeyi sağlar:**

1. ✅ **Kargo Firması ile İletişim:**
   - Frontend/iOS'tan gelen kargo gönderi talebini alır
   - Kargo firması API'si ile haberleşir
   - Kargo firmasından takip numarası (`tracking_number`) ve teslim kodu (`code`) alır
   - Kargo firmasından süreç bilgilerini alır (kargo durumu, tahmini teslimat tarihi vb.)

2. ✅ **Veritabanı İşlemleri (Kargo için):**
   - Kargo firmasından alınan `tracking_number` ve `code` bilgilerini `cargo_shipments` tablosuna **yazar**
   - Kargo firmasından alınan süreç bilgilerini ilgili tablolara **yazar**
   - Kargo durumu güncellemelerini yapar
   - Kargo webhook'larını alır ve `cargo_shipments` tablosunu günceller (cargo_status, tracking_number vb.)

3. ✅ **Frontend/iOS'a Bildirim:**
   - Kargo bilgilerini frontend/iOS'a döner
   - Frontend/iOS bu bilgiler ile süreci işleterek kullanıcıya bilgi verir

**Özet:** Backend, kargo firması ile haberleşmeyi sağlar ve aldığı bilgileri (takip numarası, teslim kodu, süreç bilgileri) veritabanına yazar. Frontend/iOS bu bilgiler ile kullanıcı ekranlarını düzenler.

**Not:** Ödeme API'si webhook geldiğinde ve ödeme başarılı olduğunda tüm veritabanı kayıtlarını oluşturur. Kargo API'si de kargo süreçleri için veritabanına yazma yetkisine sahiptir.

### Kargo Şirketleri

Sistemde desteklenen kargo şirketleri `cargo_companies` tablosunda tutulur:
- MNG Kargo
- Yurtiçi Kargo
- Aras Kargo
- Sürat Kargo
- PTT Kargo
- ve diğerleri...

### Kargo API Endpoint'leri

#### 1. Kargo Şirketlerini Listele
```
GET /api/cargo/companies
Response:
{
  success: boolean;
  companies: Array<{
    id: string;
    code: string;
    name: string;
    api_endpoint?: string;
    tracking_url_template: string;
    standard_delivery_days: number;
    express_delivery_days: number;
    base_fee: number;
    express_fee_multiplier: number;
    is_active: boolean;
  }>;
}
```

#### 2. Kargo Ücreti Hesapla
```
POST /api/cargo/calculate-fee
Request Body:
{
  cargoCompanyCode: string;
  serviceType: 'standard' | 'express' | 'same_day';
  declaredValue?: number;
  packageWeight?: number;
  packageDimensions?: string;
}

Response:
{
  success: boolean;
  cargoFee: number;
  estimatedDeliveryDays: number;
  serviceType: string;
}
```

#### 3. Kargo Gönderisi Oluştur

**ÖNEMLİ:** Backend kargo API'si, kargo firması API'si ile iletişim kurar ve aldığı bilgileri veritabanına yazar.

```
POST /api/cargo/create-shipment
Request Body:
{
  deviceId: string;
  paymentId: string;
  cargoCompanyCode: string;
  serviceType: 'standard' | 'express';
  senderUserId: string;
  receiverUserId: string;
  senderAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    district: string;
    postalCode: string;
  };
  receiverAddress: {
    name: string;
    phone: string;
    address: string;
    city: string;
    district: string;
    postalCode: string;
  };
  declaredValue: number;
  packageWeight?: number;
  packageDimensions?: string;
  specialInstructions?: string;
}

Backend İşlemleri:
1. ✅ Token doğrulama
2. ✅ Kargo firması API'sine gönderi oluşturma isteği gönderir
3. ✅ Kargo firması API'sinden dönen `code` (teslim kodu) ve `tracking_number` (takip numarası) bilgilerini alır
4. ✅ `cargo_shipments` tablosuna kayıt oluşturur (code, tracking_number, cargo_status vb.)
5. ✅ Response'da shipmentId ve trackingNumber döner

Response:
{
  success: boolean;
  shipmentId?: string;        // cargo_shipments.id
  code?: string;              // Kargo firması tarafından üretilen teslim kodu
  trackingNumber?: string;    // Kargo firması tarafından üretilen takip numarası
  cargoLabelUrl?: string;     // Kargo etiketi PDF URL'i
  cargoFee?: number;
  estimatedDeliveryDays?: number;
  errorMessage?: string;
}
```

#### 4. Kargo Takip Sorgula
```
GET /api/cargo/track/{trackingNumber}
Query Parameters:
  cargoCompanyCode: string (required)

Response:
{
  success: boolean;
  trackingNumber: string;
  cargoCompany: string;
  status: 'created' | 'label_printed' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned';
  currentLocation?: string;
  estimatedDeliveryDate?: string;
  events: Array<{
    timestamp: string;
    location: string;
    status: string;
    description: string;
  }>;
  deliveredAt?: string;
  deliveredTo?: string;
  errorMessage?: string;
}
```

#### 5. Kargo Durumu Güncelle (Webhook)
```
POST /api/cargo/webhook/{cargoCompanyCode}
Request Body:
{
  trackingNumber: string;
  status: string;
  location?: string;
  timestamp: string;
  description?: string;
  // Kargo şirketine özel ek alanlar
}

Response:
{
  success: boolean;
  message: string;
  shipmentId?: string;
}
```

#### 6. Teslimat Onayı
```
POST /api/cargo/confirm-delivery
Request Body:
{
  shipmentId: string;
  userId: string;
  signature?: string; // Dijital imza veya fotoğraf URL'i
  photos?: string[]; // Teslimat fotoğrafları URL'leri
  notes?: string;
}

Response:
{
  success: boolean;
  confirmationId?: string;
  confirmedAt?: string;
  errorMessage?: string;
}
```

### Kargo API Entegrasyonu Gereksinimleri

#### MNG Kargo API
```typescript
// MNG Kargo API örneği
interface MNGKargoRequest {
  referenceNumber: string;
  sender: MNGAddress;
  receiver: MNGAddress;
  cargo: {
    weight: number;
    declaredValue: number;
    serviceType: 'standard' | 'express';
  };
}

// API çağrısı
const mngResponse = await fetch('https://api.mngkargo.com.tr/shipment/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${MNG_API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(mngRequest)
});
```

#### Yurtiçi Kargo API
```typescript
// Yurtiçi Kargo API örneği
const yurticiResponse = await fetch('https://api.yurticikargo.com/shipment', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${YURTICI_AUTH}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(yurticiRequest)
});
```

### Kargo Şirketi Konfigürasyonu

```env
# MNG Kargo
MNG_API_URL=https://api.mngkargo.com.tr
MNG_API_KEY=your-mng-api-key
MNG_API_SECRET=your-mng-api-secret

# Yurtiçi Kargo
YURTICI_API_URL=https://api.yurticikargo.com
YURTICI_API_KEY=your-yurtici-api-key
YURTICI_API_SECRET=your-yurtici-api-secret

# Aras Kargo
ARAS_API_URL=https://api.araskargo.com.tr
ARAS_API_KEY=your-aras-api-key
ARAS_API_SECRET=your-aras-api-secret

# Kargo Webhook Secret
CARGO_WEBHOOK_SECRET=your-webhook-secret
```

### Anonim Kargo Sistemi

Kargo gönderilerinde gönderen ve alıcı bilgileri şifrelenmiş olarak saklanır ve anonim ID'ler kullanılır:
- `sender_anonymous_id`: "FND" + random ID (örn: FND-ABC123)
- `receiver_anonymous_id`: "OWN" + random ID (örn: OWN-XYZ789)

Bu ID'ler kargo takip sayfasında gösterilir ve gerçek kullanıcı bilgileri gizlenir.

---

## 👨‍💼 Admin Paneli API'leri

### Admin Yetkilendirme

Admin paneli için `admin_permissions` tablosu kullanılır. Kullanıcıların admin rolü ve yetkileri bu tabloda tutulur.

### Admin API Endpoint'leri

#### 1. Admin Girişi
```
POST /api/admin/login
Request Body:
{
  email: string;
  password: string;
}

Response:
{
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    role: 'admin' | 'super_admin';
    permissions: Record<string, boolean>;
  };
  errorMessage?: string;
}
```

#### 2. Dashboard İstatistikleri
```
GET /api/admin/dashboard/stats
Headers:
  Authorization: Bearer <admin_token>

Response:
{
  success: boolean;
  stats: {
    totalUsers: number;
    totalDevices: number;
    activeDevices: number;
    matchedDevices: number;
    completedTransactions: number;
    pendingPayments: number;
    totalRevenue: number;
    pendingEscrows: number;
    activeCargoShipments: number;
    disputes: number;
  };
  period: {
    startDate: string;
    endDate: string;
  };
}
```

#### 3. Kullanıcı Yönetimi

##### Kullanıcıları Listele
```
GET /api/admin/users
Query Parameters:
  page?: number (default: 1)
  limit?: number (default: 20)
  search?: string
  role?: 'user' | 'admin'
  status?: 'active' | 'banned' | 'suspended'

Response:
{
  success: boolean;
  users: Array<User>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

##### Kullanıcı Detayı
```
GET /api/admin/users/{userId}
Response:
{
  success: boolean;
  user: User;
  profile: UserProfile;
  devices: Device[];
  payments: Payment[];
  statistics: {
    totalDevices: number;
    totalPayments: number;
    totalEarnings: number;
    rating: number;
  };
}
```

##### Kullanıcı Durumu Güncelle
```
PATCH /api/admin/users/{userId}/status
Request Body:
{
  status: 'active' | 'banned' | 'suspended';
  reason?: string;
}

Response:
{
  success: boolean;
  message: string;
}
```

#### 4. Cihaz Yönetimi

##### Cihazları Listele
```
GET /api/admin/devices
Query Parameters:
  page?: number
  limit?: number
  status?: DeviceStatus
  search?: string
  dateFrom?: string
  dateTo?: string

Response:
{
  success: boolean;
  devices: Array<Device>;
  pagination: Pagination;
}
```

##### Cihaz Durumu Manuel Güncelle
```
PATCH /api/admin/devices/{deviceId}/status
Request Body:
{
  status: DeviceStatus;
  reason: string;
  notes?: string;
}

Response:
{
  success: boolean;
  device: Device;
  message: string;
}
```

#### 5. Ödeme ve Escrow Yönetimi

##### Ödemeleri Listele
```
GET /api/admin/payments
Query Parameters:
  page?: number
  limit?: number
  status?: string
  paymentProvider?: string
  dateFrom?: string
  dateTo?: string

Response:
{
  success: boolean;
  payments: Array<Payment>;
  pagination: Pagination;
  summary: {
    totalAmount: number;
    totalCompleted: number;
    totalPending: number;
    totalFailed: number;
  };
}
```

##### Escrow Manuel Serbest Bırakma
```
POST /api/admin/escrow/release
Request Body:
{
  escrowId: string;
  reason: string;
  adminNotes?: string;
}

Response:
{
  success: boolean;
  escrowId?: string;
  releasedAt?: string;
  errorMessage?: string;
}
```

##### Ödeme İade (Admin)
```
POST /api/admin/payments/{paymentId}/refund
Request Body:
{
  amount?: number; // Full refund için belirtilmez
  reason: string;
  adminNotes?: string;
}

Response:
{
  success: boolean;
  refundId?: string;
  refundedAt?: string;
  errorMessage?: string;
}
```

#### 6. İhtilaf Yönetimi

##### İhtilafları Listele
```
GET /api/admin/disputes
Query Parameters:
  status?: 'open' | 'in_review' | 'resolved' | 'closed'
  page?: number
  limit?: number

Response:
{
  success: boolean;
  disputes: Array<{
    id: string;
    paymentId: string;
    deviceId: string;
    initiatorUserId: string;
    reason: string;
    description: string;
    status: string;
    createdAt: string;
    resolvedAt?: string;
    resolution?: string;
  }>;
  pagination: Pagination;
}
```

##### İhtilaf Çözümü
```
POST /api/admin/disputes/{disputeId}/resolve
Request Body:
{
  resolution: 'refund_payer' | 'release_to_beneficiary' | 'partial_refund' | 'reject';
  resolutionAmount?: number; // Partial refund için
  adminNotes: string;
}

Response:
{
  success: boolean;
  disputeId?: string;
  resolution?: string;
  resolvedAt?: string;
  errorMessage?: string;
}
```

#### 7. Kargo Yönetimi

##### Kargo Gönderilerini Listele
```
GET /api/admin/cargo/shipments
Query Parameters:
  status?: CargoStatus
  cargoCompany?: string
  page?: number
  limit?: number

Response:
{
  success: boolean;
  shipments: Array<CargoShipment>;
  pagination: Pagination;
}
```

##### Kargo Durumu Manuel Güncelle
```
PATCH /api/admin/cargo/shipments/{shipmentId}/status
Request Body:
{
  status: CargoStatus;
  trackingNumber?: string;
  notes?: string;
}

Response:
{
  success: boolean;
  shipment: CargoShipment;
  message: string;
}
```

#### 8. Sistem Ayarları

##### Cihaz Model Ücretlerini Güncelle
```
PATCH /api/admin/device-models/{modelId}/fees
Request Body:
{
  repairPrice?: number;
  ifoundanappleFee?: number;
  feePercentage?: number;
}

Response:
{
  success: boolean;
  model: DeviceModel;
  message: string;
}
```

##### Kargo Şirketi Ayarları
```
GET /api/admin/cargo/companies
Response:
{
  success: boolean;
  companies: Array<CargoCompany>;
}

PATCH /api/admin/cargo/companies/{companyId}
Request Body:
{
  name?: string;
  baseFee?: number;
  expressFeeMultiplier?: number;
  standardDeliveryDays?: number;
  expressDeliveryDays?: number;
  isActive?: boolean;
  apiEndpoint?: string;
  trackingUrlTemplate?: string;
}

Response:
{
  success: boolean;
  company: CargoCompany;
}
```

#### 9. Audit Log ve Raporlama

##### Audit Logları Listele
```
GET /api/admin/audit-logs
Query Parameters:
  eventType?: string
  eventCategory?: string
  userId?: string
  resourceType?: string
  resourceId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number

Response:
{
  success: boolean;
  logs: Array<AuditLog>;
  pagination: Pagination;
}
```

##### Finansal Raporlar
```
GET /api/admin/reports/financial
Query Parameters:
  period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  dateFrom?: string
  dateTo?: string

Response:
{
  success: boolean;
  report: {
    period: string;
    totalRevenue: number;
    totalPayments: number;
    completedPayments: number;
    failedPayments: number;
    totalEscrows: number;
    releasedEscrows: number;
    refundedEscrows: number;
    totalCargoFees: number;
    totalServiceFees: number;
    totalGatewayFees: number;
    breakdown: Array<{
      date: string;
      revenue: number;
      payments: number;
    }>;
  };
}
```

#### 10. Güvenlik ve İzleme

##### Güvenlik Dashboard
```
GET /api/admin/security/dashboard
Response:
{
  success: boolean;
  security: {
    failedLoginAttempts: number;
    suspiciousActivities: number;
    blockedIPs: number;
    activeSessions: number;
    recentSecurityEvents: Array<SecurityEvent>;
  };
}
```

##### Sistem Performans Metrikleri
```
GET /api/admin/system/metrics
Response:
{
  success: boolean;
  metrics: {
    apiResponseTime: number;
    databaseQueryTime: number;
    activeUsers: number;
    apiRequestsPerMinute: number;
    errorRate: number;
    systemUptime: number;
  };
}
```

### Admin Yetki Kontrolü

Tüm admin endpoint'lerinde yetki kontrolü yapılmalı:

```typescript
// Middleware örneği
async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = await verifyAdminToken(token);
  
  if (!user || user.role !== 'admin' && user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  req.admin = user;
  next();
}

// Özel yetki kontrolü
async function requirePermission(permission: string) {
  return async (req, res, next) => {
    if (!req.admin.permissions[permission]) {
      return res.status(403).json({ error: `Permission required: ${permission}` });
    }
    next();
  };
}
```

### Admin Panel Özellikleri

- **Kullanıcı Yönetimi**: Kullanıcı listeleme, detay görüntüleme, durum değiştirme
- **Cihaz Yönetimi**: Cihaz listeleme, durum güncelleme, manuel eşleştirme
- **Ödeme Yönetimi**: Ödeme takibi, escrow yönetimi, manuel iade
- **İhtilaf Yönetimi**: İhtilaf çözümleme, karar verme
- **Kargo Yönetimi**: Kargo takibi, durum güncelleme
- **Raporlama**: Finansal raporlar, istatistikler, audit loglar
- **Sistem Ayarları**: Ücret yönetimi, kargo şirketi ayarları
- **Güvenlik**: Güvenlik izleme, şüpheli aktivite takibi

---

## 🔔 Webhook Endpoint'leri

### PAYNET Webhook

#### `POST /v1/webhooks/paynet-callback`

PAYNET, ödeme tamamlandığında bu endpoint'e webhook gönderir.

**ÖNEMLİ:** Backend webhook'u alır, doğrular ve saklar, ancak **veritabanına yazmaz**. Frontend/iOS webhook geldiğinde webhook data'yı alır (`GET /v1/payments/{paymentId}/webhook-data`) ve veritabanı kayıtlarını oluşturur.

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

**Webhook İşleme Adımları (Backend):**

1. **IP Doğrulama:** İstek IP'si `PAYNET_ALLOWED_IPS` listesinde olmalıdır
2. **Signature Verification:** Opsiyonel (header'da `x-paynet-signature` varsa doğrulanır)
3. **Idempotency Check:** `reference_no` kullanılarak duplicate webhook kontrolü yapılır
4. **Webhook Saklama:** Backend webhook payload'ını `webhook_storage` tablosuna saklar
5. **Payment ID Eşleştirme:** Webhook'tan gelen `reference_no` ile payment ID'yi eşleştirir
6. **Veritabanı Kayıtları:** Eğer ödeme başarılı (is_succeed: true) ise, backend tüm veritabanı kayıtlarını oluşturur:
   - `payments` tablosunu günceller (status, provider bilgileri, fee breakdown vb.)
   - `escrow_accounts` tablosuna kayıt oluşturur
   - `devices` tablosunda status'u `payment_completed` yapar
   - `audit_logs` tablosuna kayıt oluşturur
   - `notifications` tablosuna bildirim kayıtları oluşturur
7. **Frontend/iOS Bildirimi:** Frontend/iOS polling yaparak ödeme sonucunu alır

**Webhook İşleme Adımları (Frontend/iOS):**

1. **Polling:** Frontend/iOS `GET /v1/payments/{paymentId}/status` ile ödeme durumunu kontrol eder
2. **Sonuç Alma:** `paymentStatus: 'completed'` olduğunda ödeme başarılı sayfasına yönlendirilir
3. ❌ **Veritabanına YAZMAZ** - Tüm veritabanı işlemleri backend tarafından yapılır

**Webhook URL Konfigürasyonu:**

PAYNET yönetim panelinde `confirmation_url` olarak şu URL ayarlanmalıdır:

```
https://api.ifoundanapple.com/v1/webhooks/paynet-callback
```

---

### İyzico Webhook

```
POST /api/webhooks/iyzico-callback
Headers:
  x-iyzico-signature: <signature>
  Content-Type: application/json

Request Body:
{
  paymentId: string;
  conversationId: string;
  status: 'success' | 'failure';
  paidPrice?: string;
  currency?: string;
  // ... diğer İyzico alanları
}

Response:
{
  success: boolean;
  message: string;
  paymentId: string;
  status: string;
}
```

### Webhook Signature Doğrulama

**İyzico Signature Doğrulama:**
```typescript
import crypto from 'crypto';

function verifyIyzicoWebhook(signature: string, body: string): boolean {
  const secretKey = process.env.IYZICO_SECRET_KEY;
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(body);
  const expectedSignature = hmac.digest('base64');
  return signature === expectedSignature;
}
```

**PAYNET Signature Doğrulama:** Webhook signature doğrulama, Paynet dokümantasyonunda belirtilmemiş olabilir. Paynet destek ekibiyle doğrulama yöntemi teyit edilmelidir. Şu anda backend'de signature verification placeholder olarak implement edilmiştir.

**Detaylı webhook handler için:** 📄 **`api/webhooks/iyzico-callback.ts`** dosyasına bakın.

---

## ⚠️ Error Handling

### Error Response Formatı

Tüm hatalar aşağıdaki format ile döner:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/v1/payments/process"
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
  "path": "/v1/payments/process"
}
```

**Geçersiz Device Status:**
```json
{
  "statusCode": 400,
  "message": "Device 123e4567-e89b-12d3-a456-426614174000 is not in 'payment_pending' status. Current status: lost",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/v1/payments/process"
}
```

**Yetkisiz Kullanıcı:**
```json
{
  "statusCode": 400,
  "message": "User df612602-69f0-4e3c-ac31-f23c5ada8d77 is not the owner of device 123e4567-e89b-12d3-a456-426614174000",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/v1/payments/process"
}
```

#### 401 Unauthorized

**Token Yok:**
```json
{
  "statusCode": 401,
  "message": "Missing or invalid token",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/v1/session"
}
```

**Geçersiz Token:**
```json
{
  "statusCode": 401,
  "message": "Invalid or expired token",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/v1/session"
}
```

#### 404 Not Found

**Cihaz Bulunamadı:**
```json
{
  "statusCode": 404,
  "message": "Device not found: 123e4567-e89b-12d3-a456-426614174000",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/v1/payments/process"
}
```

---

## 🔒 Güvenlik Gereksinimleri

### Row Level Security (RLS)
Tüm tablolarda RLS aktif olmalı. Kullanıcılar sadece kendi verilerine erişebilir.

### Authentication
- Supabase JWT token ile authentication
- Token'lar her request'te `Authorization` header'ında gönderilmeli

### Data Encryption
- TC Kimlik No: Şifrelenmiş saklanmalı
- IBAN: Şifrelenmiş saklanmalı
- Adres Bilgileri: Şifrelenmiş saklanmalı (cargo_shipments)

**Encryption Key Backup Stratejisi:**
- Encryption key (`VITE_ENCRYPTION_KEY`) **manuel olarak** yedeklenmelidir
- Key kaybı durumunda şifrelenmiş tüm veriler kalıcı olarak kaybolur
- Detaylı backup stratejisi için yukarıdaki "Encryption" bölümüne bakın

### Input Validation
- Email format kontrolü
- TC Kimlik No algoritma kontrolü (11 haneli, doğrulama algoritması)
- IBAN format kontrolü (TR ile başlayan 26 haneli, Mod 97)
  - **IBAN Validation Key:** `IBAN_VALIDATION_API_KEY` veya `IBAN_VALIDATION_SERVICE_KEY` environment variable'ı ile IBAN validation servisi kullanılabilir
  - IBAN validation servisi ile gerçek zamanlı doğrulama yapılabilir (opsiyonel)
  - Format kontrolü: TR ile başlayan 26 haneli, Mod 97 checksum kontrolü
- Telefon numarası format kontrolü (Türkiye formatı)
- Seri numarası format kontrolü

**Validation fonksiyonları için:** 📄 **`utils/security.ts`** dosyasına bakın.

### Rate Limiting
- API endpoint'lerinde rate limiting uygulanmalı
- Ödeme işlemlerinde özellikle dikkatli olunmalı

### Audit Logging
Tüm önemli işlemler `audit_logs` tablosuna kaydedilmeli:
- Ödeme işlemleri
- Escrow işlemleri
- Cihaz durumu değişiklikleri
- Kullanıcı işlemleri

### Güvenlik Notları

#### 1. Token Güvenliği

- Token'ları localStorage'da saklamayın (XSS riski)
- httpOnly cookie kullanın veya secure storage kullanın
- Token süresi dolduğunda refresh token kullanın

#### 2. Tutar Doğrulama

- **ASLA** frontend'den gelen tutara güvenmeyin
- Backend her zaman veritabanından tutarı doğrular
- Frontend'de tutar gösterimi için backend'den gelen değeri kullanın

#### 3. Webhook Güvenliği

- IP whitelist kontrolü yapılır
- Signature verification (opsiyonel) yapılır
- Idempotency kontrolü yapılır

#### 4. CORS

- Sadece güvenilir domain'lerden istek kabul edilir
- `.env` dosyasında `FRONTEND_URL` tanımlanmalıdır

---

## 🧪 Local Test ve Geliştirme

### Backend Kurulumu

#### 1. Proje Oluşturma
```bash
# Yeni backend projesi oluştur
mkdir iFoundAnApple-Back
cd iFoundAnApple-Back

# npm ile proje başlat
npm init -y

# TypeScript ve temel bağımlılıkları yükle
npm install express cors dotenv
npm install -D typescript @types/node @types/express @types/cors ts-node nodemon
```

#### 2. TypeScript Konfigürasyonu
```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### 3. package.json Scripts
```json
{
  "scripts": {
    "dev": "nodemon --watch src --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts"
  }
}
```

### Local Test Araçları

#### 1. Postman Collection
Postman ile API testleri için collection oluşturun:

```json
// postman_collection.json örneği
{
  "info": {
    "name": "iFoundAnApple Backend API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "http://localhost:3001/api/health",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3001",
          "path": ["api", "health"]
        }
      }
    }
  ]
}
```

#### 2. REST Client (VS Code Extension)
VS Code'da REST Client extension'ı kullanarak test dosyaları oluşturun:

```http
# tests/api.http

### Health Check
GET http://localhost:3001/api/health

### Calculate Fees
POST http://localhost:3001/api/calculate-fees
Content-Type: application/json
Authorization: Bearer {{token}}

{
  "deviceModelName": "iPhone 14 Pro"
}

### Process Payment (Yeni Endpoint)
POST http://localhost:3000/v1/payments/process
Content-Type: application/json
Authorization: Bearer {{token}}

{
  "deviceId": "test-device-id",
  "totalAmount": 1585.75,
  "feeBreakdown": {
    "rewardAmount": 500,
    "cargoFee": 250,
    "serviceFee": 750,
    "gatewayFee": 85.75,
    "totalAmount": 1585.75,
    "netPayout": 500
  }
}

### Payment Status Check (Yeni Endpoint)
GET http://localhost:3000/v1/payments/{paymentId}/status
Authorization: Bearer {{token}}

### Webhook Data (Yeni Endpoint)
GET http://localhost:3000/v1/payments/{paymentId}/webhook-data
Authorization: Bearer {{token}}

**NOT:** Eski test endpoint'leri (`POST /api/process-payment`) artık kullanılmıyor. Yeni endpoint'ler yukarıdaki [API Endpoint'leri](#api-endpointleri) bölümünde detaylı olarak açıklanmıştır.
```

#### 3. cURL ile Test
```bash
# Health check
curl http://localhost:3001/api/health

# Calculate fees
curl -X POST http://localhost:3001/api/calculate-fees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"deviceModelName": "iPhone 14 Pro"}'

# Process payment (Yeni Endpoint)
curl -X POST http://localhost:3000/v1/payments/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "deviceId": "test-device-id",
    "totalAmount": 1585.75,
    "feeBreakdown": {
      "rewardAmount": 500,
      "cargoFee": 250,
      "serviceFee": 750,
      "gatewayFee": 85.75,
      "totalAmount": 1585.75,
      "netPayout": 500
    }
  }'

# Payment status check
curl -X GET http://localhost:3000/v1/payments/{paymentId}/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Webhook data
curl -X GET http://localhost:3000/v1/payments/{paymentId}/webhook-data \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 4. npm Script ile Otomatik Test
```json
// package.json
{
  "scripts": {
    "test:api": "node scripts/test-api.js",
    "test:integration": "jest --testPathPattern=integration",
    "test:unit": "jest --testPathPattern=unit"
  }
}
```

```javascript
// scripts/test-api.js
const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function testHealthCheck() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check:', response.data);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

async function testCalculateFees() {
  try {
    const response = await axios.post(`${BASE_URL}/calculate-fees`, {
      deviceModelName: 'iPhone 14 Pro'
    });
    console.log('✅ Calculate fees:', response.data);
  } catch (error) {
    console.error('❌ Calculate fees failed:', error.message);
  }
}

async function runTests() {
  console.log('🧪 Running API tests...\n');
  await testHealthCheck();
  await testCalculateFees();
  console.log('\n✨ Tests completed!');
}

runTests();
```

### Test Ortamı Konfigürasyonu

#### .env.test
```env
# Test Environment
NODE_ENV=test
PORT=3001

# Supabase Test
SUPABASE_URL=your-test-supabase-url
SUPABASE_ANON_KEY=your-test-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-test-service-key

# Payment Gateway Test
IYZICO_API_KEY=test-api-key
IYZICO_SECRET_KEY=test-secret-key
IYZICO_BASE_URL=https://sandbox-api.iyzipay.com

PAYNET_API_KEY=test-api-key
PAYNET_SECRET_KEY=test-secret-key
PAYNET_API_URL=https://test-api.paynet.com.tr

# Cargo API Test
MNG_API_KEY=test-api-key
MNG_API_SECRET=test-secret-key

# Test Mode
PAYMENT_PROVIDER=test
```

### Mock Servisler

#### Mock Payment Gateway
```typescript
// src/services/mocks/paymentMock.ts
export const mockPaymentGateway = {
  processPayment: async (request: PaymentRequest) => {
    // Simüle edilmiş ödeme işlemi
    return {
      success: true,
      paymentId: `mock_${Date.now()}`,
      status: 'completed',
      providerResponse: { mock: true }
    };
  },
  
  checkStatus: async (paymentId: string) => {
    return {
      success: true,
      status: 'completed',
      paymentId
    };
  },
  
  refund: async (paymentId: string, amount?: number) => {
    return {
      success: true,
      refundId: `refund_${Date.now()}`,
      status: 'refunded'
    };
  }
};
```

#### Mock Cargo API
```typescript
// src/services/mocks/cargoMock.ts
export const mockCargoAPI = {
  createShipment: async (request: ShipmentRequest) => {
    return {
      success: true,
      shipmentId: `mock_shipment_${Date.now()}`,
      trackingNumber: `MOCK${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      cargoLabelUrl: 'https://example.com/mock-label.pdf'
    };
  },
  
  trackShipment: async (trackingNumber: string) => {
    return {
      success: true,
      trackingNumber,
      status: 'in_transit',
      events: [
        {
          timestamp: new Date().toISOString(),
          location: 'İstanbul',
          status: 'picked_up',
          description: 'Package picked up'
        }
      ]
    };
  }
};
```

### Jest Test Örnekleri

```typescript
// tests/unit/paymentService.test.ts
import { PaymentService } from '../../src/services/paymentService';

describe('PaymentService', () => {
  let paymentService: PaymentService;

  beforeEach(() => {
    paymentService = new PaymentService();
  });

  test('should calculate fees correctly', async () => {
    const fees = await paymentService.calculateFees({
      deviceModelName: 'iPhone 14 Pro'
    });

    expect(fees).toHaveProperty('totalAmount');
    expect(fees.totalAmount).toBeGreaterThan(0);
    expect(fees.cargoFee).toBe(250);
  });

  test('should process test payment', async () => {
    const result = await paymentService.processPayment({
      deviceId: 'test-device',
      payerId: 'test-user',
      feeBreakdown: {
        totalAmount: 1000,
        rewardAmount: 200,
        cargoFee: 250,
        serviceFee: 550,
        gatewayFee: 0,
        netPayout: 200
      },
      deviceInfo: {
        model: 'iPhone 14 Pro',
        serialNumber: 'TEST123'
      },
      payerInfo: {
        name: 'Test User',
        email: 'test@example.com',
        phone: '05551234567',
        address: {
          street: 'Test',
          city: 'İstanbul',
          district: 'Kadıköy',
          postalCode: '34000'
        }
      },
      paymentProvider: 'test'
    });

    expect(result.success).toBe(true);
    expect(result.paymentId).toBeDefined();
  });
});
```

### Integration Test Örnekleri

```typescript
// tests/integration/api.test.ts
import request from 'supertest';
import app from '../../src/app';

describe('API Integration Tests', () => {
  test('GET /api/health should return 200', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
  });

  test('POST /api/calculate-fees should calculate fees', async () => {
    const response = await request(app)
      .post('/api/calculate-fees')
      .send({ deviceModelName: 'iPhone 14 Pro' })
      .expect(200);

    expect(response.body).toHaveProperty('totalAmount');
    expect(response.body.totalAmount).toBeGreaterThan(0);
  });
});
```

### Hot Reload ile Geliştirme

#### nodemon.json
```json
{
  "watch": ["src"],
  "ext": "ts,json",
  "ignore": ["src/**/*.test.ts"],
  "exec": "ts-node src/index.ts",
  "env": {
    "NODE_ENV": "development"
  }
}
```

#### Kullanım
```bash
# Development mode (hot reload)
npm run dev

# Build ve production
npm run build
npm start
```

### Webhook Test için Local Tunnel

#### ngrok ile Webhook Test
```bash
# ngrok kurulumu
npm install -g ngrok

# Local server'ı expose et
ngrok http 3001

# Çıkan URL'i webhook callback URL olarak kullan
# Örn: https://abc123.ngrok.io/api/webhooks/paynet-callback
```

#### localtunnel ile Alternatif
```bash
# localtunnel kurulumu
npm install -g localtunnel

# Tunnel oluştur
lt --port 3001 --subdomain ifoundanapple-backend

# Çıkan URL: https://ifoundanapple-backend.loca.lt
```

### Test Veritabanı

#### Supabase Local Development
```bash
# Supabase CLI kurulumu
npm install -g supabase

# Local Supabase başlat
supabase start

# Migration'ları çalıştır
supabase db reset
```

### Debugging

#### VS Code launch.json
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Backend",
      "program": "${workspaceFolder}/src/index.ts",
      "runtimeExecutable": "ts-node",
      "restart": true,
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Test Komutları Özeti

```bash
# Development server (hot reload)
npm run dev

# Build
npm run build

# Production start
npm start

# Unit tests
npm test

# Integration tests
npm run test:integration

# Watch mode tests
npm run test:watch

# Coverage
npm run test:coverage

# Lint
npm run lint

# Format code
npm run format
```

### Örnek Test Senaryoları

1. **Health Check Test**
   ```bash
   curl http://localhost:3001/api/health
   ```

2. **Ücret Hesaplama Test**
   ```bash
   npm run test:api
   ```

3. **Test Payment (Mock)**
   ```bash
   # paymentProvider: "test" kullanarak gerçek ödeme yapmadan test
   ```

4. **Webhook Simulation**
   ```bash
   # Postman veya curl ile webhook endpoint'ine istek gönder
   curl -X POST http://localhost:3000/v1/webhooks/paynet-callback \
     -H "Content-Type: application/json" \
     -d '{"reference_no": "payment-uuid", "is_succeed": true, "amount": 2000.0}'
   ```
   
   **NOT:** Webhook endpoint'i IP whitelist ile korunur. Test için PAYNET_ALLOWED_IPS'e test IP'si eklenmelidir.

---

## 📝 Örnek Request/Response'lar

### Örnek 1: Health Check

**Request:**
```bash
curl -X GET http://localhost:3000/v1/health
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
curl -X GET http://localhost:3000/v1/session \
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
curl -X POST http://localhost:3000/v1/payments/process \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
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
  "paymentUrl": "https://api.paynet.com.tr/v2/transaction/tds_initial",
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

**Response (Error - Tutar Uyuşmazlığı):**
```json
{
  "statusCode": 400,
  "message": "Amount mismatch. Expected: 2000.0, Received: 1500.0",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/v1/payments/process"
}
```

---

### Örnek 4: PAYNET Connection Test

**Request:**
```bash
curl -X GET http://localhost:3000/v1/payments/test-paynet-connection \
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

## 📝 Örnek API İstekleri

### 1. Ücret Hesaplama
```bash
curl -X POST http://localhost:3001/api/calculate-fees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "deviceModelName": "iPhone 14 Pro"
  }'
```

### 2. Ödeme İşleme (Yeni Endpoint)
```bash
curl -X POST http://localhost:3000/v1/payments/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "deviceId": "device-uuid",
    "totalAmount": 1585.75,
    "feeBreakdown": {
      "rewardAmount": 500,
      "cargoFee": 250,
      "serviceFee": 750,
      "gatewayFee": 85.75,
      "totalAmount": 1585.75,
      "netPayout": 500
    }
  }'
```

**NOT:** Eski endpoint (`POST /api/process-payment`) artık kullanılmıyor. Yeni endpoint: `POST /v1/payments/process`

### 3. Escrow Serbest Bırakma (Yeni Endpoint)
```bash
curl -X POST http://localhost:3000/v1/payments/release-escrow \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "paymentId": "payment-uuid",
    "deviceId": "device-uuid",
    "releaseReason": "Device received and confirmed",
    "confirmedBy": "user-uuid"
  }'
```

**NOT:** Eski endpoint (`POST /api/release-escrow`) artık kullanılmıyor. Yeni endpoint: `POST /v1/payments/release-escrow`

---

## 🔗 Frontend-Backend Entegrasyon Noktaları

### Frontend'den Backend'e Çağrılar

Frontend'de şu dosyalar backend API'lerini çağırır:

**Yeni Endpoint'ler (Güncel):**
1. **`utils/paynetPayment.ts`** → `POST /v1/payments/process` (Ödeme başlatma)
2. **`utils/paynetPayment.ts`** → `POST /v1/payments/complete-3d` (3D Secure tamamlama)
3. **`utils/paynetPayment.ts`** → `GET /v1/payments/{paymentId}/status` (Payment status kontrolü)
4. **`utils/paynetPayment.ts`** → `GET /v1/payments/{paymentId}/webhook-data` (Webhook data çekme)
5. **`utils/paynetPayment.ts`** → `POST /v1/payments/release-escrow` (Escrow serbest bırakma)

**DEPRECATED (Kullanılmıyor):**
- ❌ `api/process-payment.ts` → `/api/process-payment` (Deprecated)
- ❌ `api/release-escrow.ts` → `/api/release-escrow` (Deprecated)

### Supabase Client Kullanımı
Frontend direkt Supabase client kullanır:
- Authentication (sign up, sign in, sign out)
- Database queries (devices, payments, escrow_accounts, etc.)
- Real-time subscriptions
- File uploads (Supabase Storage)

Backend'de Supabase Service Role Key kullanılmalı (RLS bypass için gerekli yerlerde).

---

## 📚 Referans Dosyalar

### Frontend'deki Önemli Dosyalar

1. **Veritabanı Şeması:** `database/COMPLETE_DATABASE_SCHEMA.md`
2. **Type Definitions:** `types.ts`
3. **Konfigürasyon:** `utils/security.ts`
4. **Ödeme Gateway:** `utils/iyzicoConfig.ts`
5. **API Functions:** `api/*.ts`
6. **Webhook Handlers:** `api/webhooks/*.ts`
7. **Ücret Hesaplama:** `api/calculate-fees.ts`
8. **Proje Dokümantasyonu:** `README.md`

### İş Akışı Dokümantasyonu
- **`PROCESS_FLOW.md`** - İş akışı ve süreçler
- **`PROJECT_DESIGN_DOCUMENTATION.md`** - Proje tasarım dokümantasyonu

### Ek Kaynaklar

- [PAYNET API Referansı](./PAYNET_INTEGRATION.md)
- [Backend Roadmap](./backend%20roadmap)
- [Process Flow](./PROCESS_FLOW.md)
- [Swagger UI](http://localhost:3000/v1/docs)

---

## 🚀 Backend Geliştirme Önerileri

### Teknoloji Önerileri
- **Framework:** Express.js veya Fastify
- **Database Client:** Supabase JS Client (@supabase/supabase-js)
- **Payment SDK:** İyzico Node.js SDK (iyzipay)
- **Validation:** Zod veya Joi
- **Error Handling:** Custom error handler middleware
- **Logging:** Winston veya Pino
- **Testing:** Jest veya Vitest

### Proje Yapısı Önerisi
```
backend/
├── src/
│   ├── controllers/      # Request handlers
│   ├── services/         # Business logic
│   ├── models/           # Data models
│   ├── middleware/       # Auth, validation, etc.
│   ├── routes/           # API routes
│   ├── utils/            # Helper functions
│   ├── config/           # Configuration
│   └── types/            # TypeScript types
├── tests/
├── .env.example
├── package.json
└── README.md
```

### Endpoint Naming Convention
- RESTful API standartlarına uygun
- `/api/v1/` prefix kullanılabilir (versiyonlama için)
- Resource-based naming (örn: `/api/devices`, `/api/payments`)

---

## 📞 İletişim ve Destek

### Sorular İçin
- GitHub Issues: Frontend repository'de issue açın
- Email: (Backend repo için belirlenecek)

### Notlar
- Bu dokümantasyon frontend projesindeki mevcut yapıya göre hazırlanmıştır
- Backend geliştirilirken database şeması değişiklikleri frontend ile senkronize edilmelidir
- Yeni endpoint'ler eklendiğinde bu dokümantasyon güncellenmelidir

---

## 🆘 Destek

Sorularınız için:
- Backend geliştirici ile iletişime geçin
- Swagger UI'da endpoint'leri test edin
- Backend loglarını kontrol edin

---

**Son Güncelleme:** 2025-01-15
**Versiyon:** 1.0.0

