# PAYNET API Referans Dokümantasyonu

## ✅ Doğrulanmış Bilgiler

### 1. Base URL Yapısı
- **Production**: `https://api.paynet.com.tr/v1`
- **Test**: `https://pts-api.paynet.com.tr/v1`
- **Not**: Tüm endpoint'ler `/v1/` prefix'i ile başlar

### 2. Authentication
- **Format**: HTTP Basic Authentication
- **Header**: `Authorization: Basic base64(secret_key:)`
- **Secret Key**: PAYNET yönetim panelinden alınır
- **Kaynak**: [PAYNET Authentication](https://doc.paynet.com.tr/authentication)

### 3. Escrow Durum Güncelleme ✅
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

### 4. Escrow Parametresi
- **Parametre**: `is_escrow`
- **Tip**: `boolean`
- **Varsayılan**: `false`
- **Açıklama**: `true` gönderilirse ödeme ana firma onayına tabi olur (escrow'da tutulur)
- **Kaynak**: PAYNET API dokümantasyonu

### 4. 3D Secure Payment ✅
- **Endpoint**: `POST /v2/transaction/tds_initial`
- **URL**: `https://api.paynet.com.tr/v2/transaction/tds_initial`
- **Kaynak**: [3D ile Ödeme](https://doc.paynet.com.tr/oedeme-metotlari/api-entegrasyonu/3d-ile-odeme)

**Request Parameters:**
```json
{
  "amount": "decimal",           // Çekilecek tutar - ZORUNLU
  "reference_no": "string",      // İşleme ait benzersiz referans numarası - ZORUNLU
  "return_url": "string",        // 3D doğrulama sonucunun post edileceği URL - ZORUNLU
  "domain": "string",            // İşlemin yapıldığı uygulamanın domain bilgisi - ZORUNLU
  "is_escrow": "boolean",        // Escrow özelliği (opsiyonel)
  "card_holder": "string",       // Kart sahibi bilgisi (saklı kart kullanılmıyorsa zorunlu)
  "pan": "string",               // Kart numarası (saklı kart kullanılmıyorsa zorunlu)
  "month": "string",             // Son kullanma tarihi ay (MM formatında)
  "year": "string",              // Son kullanma tarihi yıl (YY veya YYYY formatında)
  "cvc": "string",               // CVV/CVC kodu
  "description": "string",       // Opsiyonel
  "installments": "int",         // Taksit sayısı (opsiyonel)
  "customer_email": "string",    // Opsiyonel
  "customer_name": "string",     // Opsiyonel
  "customer_phone": "string"     // Opsiyonel
}
```

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

### 5. 3D Payment Completion ✅
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
2. PAYNET → Frontend: `post_url` veya `html_content` döner
3. Frontend → Bank: Kullanıcıyı 3D doğrulama sayfasına yönlendirir
4. Bank → Frontend: `return_url`'e `session_id` ve `token_id` POST eder
5. Frontend → Backend: `session_id` ve `token_id` gönderir
6. Backend → PAYNET: `POST /v2/transaction/tds_charge` ile ödeme tamamlanır

### 6. Webhook Format (confirmation_url) ✅
- **Endpoint**: Backend'de tanımlı: `POST /api/webhooks/paynet-callback`
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

## ⏳ Doğrulanacak Bilgiler

### 1. Transaction Query Endpoint
- **Tahmini**: `GET /v1/transaction/{xact_id}` veya `GET /v2/transaction/{xact_id}`
- **Dokümantasyon**: PAYNET İşlem servisleri
- **Not**: Endpoint URL'i dokümantasyondan doğrulanacak (webhook'ta zaten transaction bilgileri mevcut)

## 📝 Güncellemeler

### Yapılan Güncellemeler:
1. ✅ Escrow release endpoint'i eklendi: `/v1/transaction/escrow_status_update`
2. ✅ Escrow reject metodu eklendi
3. ✅ Base URL `/v1/` ve `/v2/` prefix'leri eklendi
4. ✅ `is_escrow` parametresi eklendi
5. ✅ HTTP Basic Authentication formatı doğrulandı
6. ✅ 3D payment endpoint'leri doğrulandı: `/v2/transaction/tds_initial` ve `/v2/transaction/tds_charge`
7. ✅ Request/Response field isimleri doğrulandı: `snake_case` formatı (`reference_no`, `return_url`, `domain`, `session_id`, `token_id`, vb.)
8. ✅ Field mapping güncellendi: `order_id` → `reference_no`, `card_number` → `pan`, `card_holder_name` → `card_holder`, vb.
9. ✅ Webhook formatı doğrulandı: `confirmation_url` payload structure (`reference_no`, `is_succeed`, `amount`, vb.)
10. ✅ Webhook service güncellendi: PAYNET formatına göre `reference_no` ve `is_succeed` kullanımı

### Yapılacaklar:
1. ⏳ Transaction query endpoint'ini doğrulama (webhook'ta zaten transaction bilgileri mevcut, opsiyonel)
2. ⏳ Test ortamında gerçek API testleri

## 🔗 Kaynaklar
- [PAYNET Dokümantasyon](https://doc.paynet.com.tr)
- [Escrow Durum Güncelleme](https://doc.paynet.com.tr/servisler/islem/escrow-durum-guncelleme)
- [3D ile Ödeme](https://doc.paynet.com.tr/oedeme-metotlari/api-entegrasyonu/3d-ile-odeme)
- [API Entegrasyonu](https://doc.paynet.com.tr/oedeme-metotlari/api-entegrasyonu)

