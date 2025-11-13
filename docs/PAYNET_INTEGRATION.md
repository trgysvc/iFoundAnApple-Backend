# PAYNET Entegrasyon Notları

## Önemli Notlar

### Escrow Sistemi
- **PAYNET'in kendi escrow özelliği YOK**
- Escrow yönetimi **bizim backend sistemimizde** yapılıyor
- PAYNET sadece **ödeme almak** için kullanılıyor
- Ödeme tamamlandıktan sonra:
  1. Webhook ile bilgilendiriliyoruz
  2. `escrow_accounts` tablosunda `status = 'held'` yapıyoruz
  3. Cihaz teslim edildiğinde `status = 'released'` yapıyoruz

### PAYNET API Özellikleri
- **Secret Key** ile authentication (Basic Auth veya Bearer Token)
- **3D Secure** ödeme desteği
- **Tek çekim** ve **taksitli** ödeme
- **Kart saklama** özelliği
- **Webhook** callback desteği

### API Endpoint'leri (Tahmini - Dokümantasyona göre güncellenecek)
- Test: `https://pts-api.paynet.com.tr`
- Production: `https://api.paynet.com.tr` (doğrulanacak)

### Authentication
- Header: `Authorization: Bearer {secret_key}` veya
- Header: `X-Secret-Key: {secret_key}` (format dokümantasyona göre güncellenecek)

### 3D Secure Ödeme Akışı
1. **3D Ödeme Başlatma**: `POST /api/payment/3d`
   - Request: `amount`, `currency`, `order_id`, `return_url`, kart bilgileri
   - Response: `transaction_id`, `session_id`, `post_url` veya `html_content`

2. **3D Ödeme Tamamlama**: `POST /api/payment/3d/complete`
   - Request: `session_id`, `token_id` (return_url'den gelir)
   - Response: `transaction_id`, `status`

### Webhook
- Endpoint: `POST /api/webhooks/paynet-callback`
- IP Kontrolü: PAYNET'in statik IP'lerinden gelmeli
- Signature Verification: HMAC-SHA256 ile doğrulanmalı (implement edilecek)

## Yapılacaklar

1. ✅ PAYNET API endpoint'lerini dokümantasyondan doğrulama
2. ✅ Authentication formatını doğrulama
3. ✅ Request/Response formatlarını doğrulama
4. ⏳ Webhook signature verification implementasyonu
5. ⏳ Test ortamı ile gerçek API testi

## Kaynaklar
- [PAYNET Dokümantasyon](https://doc.paynet.com.tr)
- [API Entegrasyonu](https://doc.paynet.com.tr/oedeme-metotlari/api-entegrasyonu)
- [3D ile Ödeme](https://doc.paynet.com.tr/oedeme-metotlari/api-entegrasyonu/3d-ile-odeme)

