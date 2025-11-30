# iFoundAnApple - Kapsamlı Proje Tasarım Dokümantasyonu

**Versiyon:** 2.1  
**Son Güncelleme:** 2025-11-04  
**Dokümantasyon Durumu:** ✅ Güncel

---

## 📋 İçindekiler

1. [Genel Bakış ve Kapsam](#bölüm-1-genel-bakış-ve-kapsam)
2. [Gereksinimler](#bölüm-2-gereksinimler)
3. [Tasarım ve Mimari](#bölüm-3-tasarım-ve-mimari)
4. [Kullanıcı Dokümantasyonu](#bölüm-4-kullanıcı-dokümantasyonu)
5. [Geliştirici Dokümantasyonu](#bölüm-5-geliştirici-dokümantasyonu)
6. [Test Dokümantasyonu](#bölüm-6-test-dokümantasyonu)
7. [Sürüm Notları](#bölüm-7-sürüm-notları)

---

## BÖLÜM 1: GENEL BAKIŞ VE KAPSAM

### 1.1 Proje Özeti

**iFoundAnApple**, kayıp Apple cihazlarının sahipleri ile bulanlar arasında anonim ve güvenli bir şekilde, belirli bir ücret karşılığında takasını sağlayan modern bir web platformudur.

#### Projenin Amacı
- Kayıp Apple cihazlarının geri kazanımını kolaylaştırmak
- Cihaz sahibi ve bulan kişi arasında güvenli, anonim iletişim sağlamak
- Otomatik eşleştirme ile hızlı sonuç vermek
- Güvenli ödeme (escrow) sistemi ile tarafları korumak
- Kargo entegrasyonu ile fiziksel takası güvenli hale getirmek

#### Çözülen Problemler
1. **Güvenlik Sorunları**: Geleneksel kayıp-bulunmuş sistemlerinde kişisel bilgilerin paylaşımı risk oluşturuyordu. Platform tam anonimlik sağlar.
2. **İletişim Zorlukları**: Sahip ve bulan arasında güvenli iletişim kanalı yoktu. Platform hiçbir kişisel bilgi paylaşmaz.
3. **Ödeme Güvencesi**: Bulan kişiler ödüllerini alamama, sahipler ise ödeme yaptıktan sonra cihaz alamama riski taşıyordu. Escrow sistemi her iki tarafı korur.
4. **Manuel Süreçler**: Eşleştirme ve takip manuel yapılıyordu. Sistem otomatik eşleştirme ve bildirim sistemi ile süreci otomatikleştirir.
5. **Takas Güvenliği**: Fiziksel takas riskleri vardı. Kargo entegrasyonu ile güvenli teslimat sağlanır.

#### Hedeflenen Platformlar
- ✅ **Web Platformu** (Mevcut) - React/TypeScript tabanlı modern SPA
  - Bilgilendirme ve destek
  - Tam fonksiyonel kullanıcı arayüzü
  - Responsive tasarım (mobil uyumlu)
- 📱 **iOS Uygulaması** (Planlanan) - Native iOS uygulaması
  - Ana fonksiyonellik
  - Push bildirimleri
  - Offline destek

#### Hedef Kitle
1. **Cihaz Sahipleri** (Device Owners)
   - Apple cihazını kaybeden kişiler
   - Güvenli ve hızlı geri kazanım isteyenler
   - Ödeme yapmaya hazır kullanıcılar

2. **Bulan Kişiler** (Finders)
   - Kayıp Apple cihazı bulan kişiler
   - Cihazı sahibine güvenli şekilde ulaştırmak isteyenler
   - Ödül almak isteyenler

#### Temel Özellikler

1. **Anonim Eşleşme Sistemi**
   - Model + Seri Numarası bazında otomatik eşleştirme
   - Kullanıcılar birbirlerinin kimlik bilgilerine erişemez
   - Anonim ID'ler ile kargo takibi

2. **Güvenli Ödeme Sistemi (Escrow)**
   - Ödeme güvenli emanet sisteminde tutulur
   - Cihaz teslim edilip onaylanana kadar para bloke edilir
   - Otomatik ödeme dağıtımı

3. **Otomatik Bildirim Sistemi**
   - Eşleşme bildirimleri
   - Ödeme hatırlatmaları
   - Kargo takip güncellemeleri
   - Süreç durumu bildirimleri

4. **Kargo Entegrasyonu**
   - Kargo firması API entegrasyonu
   - Otomatik teslim kodu üretimi
   - Takip numarası ile güncel durum
   - Anonim adres yönetimi

5. **Çoklu Dil Desteği**
   - Türkçe, İngilizce, Fransızca, Japonca, İspanyolca
   - 200+ çeviri anahtarı
   - Dinamik dil değiştirme

6. **Gelişmiş Güvenlik**
   - Row Level Security (RLS) ile veri izolasyonu
   - Hassas bilgilerin şifreli saklanması
   - Audit log sistemi
   - KYC/AML kontrolleri

7. **Yüzdesel Ücretlendirme**
   - Dinamik ücret hesaplama
   - Gateway komisyonu: %3.43
   - Bulan kişi ödülü: %20
   - Kargo ücreti: 250.00 TL (sabit)
   - Hizmet bedeli: Kalan tutar

8. **AI Destekli Özellikler**
   - Google Gemini entegrasyonu
   - Ödül miktarı önerileri
   - Açıklama önerileri

#### Kapsam Dışı Olanlar

1. **Doğrudan Kullanıcı İletişimi**
   - Kullanıcılar birbirleriyle doğrudan iletişim kuramaz
   - Tüm iletişim platform üzerinden anonim olarak gerçekleşir

2. **Manuel Arama Fonksiyonu**
   - Kullanıcılar manuel olarak cihaz arayamaz
   - Sadece sistem otomatik eşleştirme yapar

3. **Android veya Diğer Marka Cihaz Desteği**
   - Sadece Apple cihazları desteklenir
   - iPhone, iPad, MacBook, AirPods, Apple Watch vb.

4. **Fiziksel Teslim Noktaları**
   - Manuel teslim noktaları yoktur
   - Sadece kargo ile teslimat yapılır

5. **Anlık Mesajlaşma**
   - Chat/sohbet özelliği yoktur
   - Sadece bildirimler üzerinden iletişim

6. **Çoklu Ödeme Yöntemleri (Şu An)**
   - Şu anda Stripe/PAYNET odaklı
   - Gelecekte ek ödeme yöntemleri eklenecek

### 1.2 Hedefler

#### Kullanıcı Hedefleri
- ✅ Kullanıcılar için güvenli ve anonim bir takas süreci sunmak
- ✅ Kayıp cihazların geri kazanım oranını artırmak
- ✅ Basit, sezgisel, kullanıcı dostu bir arayüz sağlamak
- ✅ Mobil ve masaüstü cihazlarda mükemmel deneyim

#### Teknik Hedefler
- ✅ Modern, ölçeklenebilir mimari
- ✅ Yüksek performans ve hızlı yanıt süreleri
- ✅ Güvenli veri saklama ve işleme
- ✅ Gerçek zamanlı güncellemeler

#### İş Hedefleri
- ✅ Şeffaf ücretlendirme modeli
- ✅ Güvenilir ödeme altyapısı
- ✅ Uluslararası kullanıcılar için çoklu dil desteği
- ✅ Sürdürülebilir iş modeli

---

## BÖLÜM 2: GEREKSİNİMLER

### 2.1 Fonksiyonel Gereksinimler

#### 2.1.1 Kullanıcı Yönetimi

**FR-1.1: Kayıt Olma (Registration)**
- Kullanıcılar Email + Şifre ile kayıt olabilir
- Google OAuth ile kayıt/giriş
- Apple Sign-In ile kayıt/giriş
- Zorunlu alanlar: Email, Şifre, Ad, Soyad
- Kullanım şartları ve gizlilik politikası kabulü

**FR-1.2: Giriş/Çıkış İşlemleri**
- Email + Şifre ile giriş
- OAuth ile giriş (Google, Apple)
- Şifre sıfırlama
- Oturum yönetimi (JWT token)

**FR-1.3: Profil Yönetimi**
- Temel Bilgiler:
  - Ad, Soyad (zorunlu)
  - Doğum tarihi (opsiyonel, ancak ödeme için önerilen)
  - Email (değiştirilemez)
- Kimlik Bilgileri:
  - TC Kimlik No (şifrelenmiş saklanır)
  - Doğrulama: 11 haneli, algoritma kontrolü
  - Zorunluluk: Ödeme için (cihaz sahibi), ödül almak için (bulan kişi)
- İletişim Bilgileri:
  - Telefon numarası (Türk formatı, zorunlu)
  - Adres (şifrelenmiş saklanır, ödeme için zorunlu)
- Banka Bilgileri:
  - IBAN (TR ile başlayan, 26 haneli, şifrelenmiş)
  - IBAN Validation: IBAN validation key (`IBAN_VALIDATION_API_KEY` veya `IBAN_VALIDATION_SERVICE_KEY`) ile gerçek zamanlı doğrulama yapılabilir (opsiyonel)
  - Format kontrolü: TR ile başlayan 26 haneli, Mod 97 checksum kontrolü
  - Zorunluluk: Sadece bulan kişi için (ödül almak için)
  - Cihaz sahibinden IBAN istenmez

#### 2.1.2 Cihaz Yönetimi

**FR-2.1: Kayıp Cihaz Ekleme (Owner)**
- Zorunlu Bilgiler:
  - Cihaz Modeli (dropdown)
  - Seri Numarası (12 haneli, manuel)
  - Kayıp Tarihi (tarih seçici)
  - Kayıp Yeri (serbest metin)
  - Satın Alma Kanıtı/Fatura (dosya yükleme)
- Opsiyonel Bilgiler:
  - Cihaz Rengi
  - Ek Detaylar/Açıklama
- Durum: `LOST` → Sistem eşleştirme bekler

**FR-2.2: Bulunan Cihaz Bildirme (Finder)**
- Zorunlu Bilgiler:
  - Cihaz Modeli (dropdown)
  - Seri Numarası (12 haneli, manuel)
  - Bulunma Tarihi (tarih seçici)
  - Bulunma Yeri (serbest metin)
  - Cihaz Fotoğrafları (ön ve arka, 2 fotoğraf)
- Opsiyonel Bilgiler:
  - Cihaz Rengi
  - Ek Detaylar
- Durum: `REPORTED` → Sistem eşleştirme bekler

**FR-2.3: Cihaz Listeleme**
- Kullanıcı kendi cihazlarını görüntüler
- Durum bazlı filtreleme:
  - Kayıp/Bildirildi (beklemede)
  - Eşleşti
  - Ödeme Bekleniyor
  - Ödeme Tamamlandı
  - Kargo Yolda
  - Teslim Edildi
  - Tamamlandı

**FR-2.4: Cihaz Detayları**
- Cihaz bilgileri (model, seri no, renk vb.)
- Süreç durumu (adım adım görsel gösterim)
- Ödeme detayları (varsa)
- Escrow durumu (varsa)
- Kargo bilgileri (varsa)
- İşlem geçmişi

#### 2.1.3 Eşleşme Motoru

**FR-3.1: Otomatik Eşleştirme**
- Kriterler:
  - Aynı model (büyük/küçük harf duyarsız)
  - Aynı seri numarası (büyük/küçük harf duyarsız)
  - Farklı kullanıcı (aynı kullanıcı kendi cihazı ile eşleşemez)
  - Biri `LOST`, diğeri `REPORTED` durumunda
- Eşleşme Bulunduğunda:
  - Her iki cihazın durumu `MATCHED` olur
  - Her iki tarafa bildirim gönderilir
  - E-posta bildirimi (opsiyonel)
  - In-app bildirim

**FR-3.2: Güvenlik Kontrolleri**
- Aynı kullanıcı, aynı model + seri numaralı cihazı hem kayıp hem bulunan olarak kaydedemez
- Günde 2'den fazla bulunan cihaz kaydı yapan hesaplar incelemeye alınır
- Sahte seri numarası kontrolü (fatura ile doğrulama)

#### 2.1.4 Takas ve Ödeme Süreci

**FR-4.1: Ücret Hesaplama**
- Hesaplama Yapısı:
  ```
  totalAmount = ifoundanapple_fee (device_models tablosundan)
  gatewayFee = totalAmount * 0.0343 (%3.43)
  cargoFee = 250.00 TL (sabit)
  rewardAmount = totalAmount * 0.20 (%20)
  serviceFee = totalAmount - gatewayFee - cargoFee - rewardAmount
  netPayout = rewardAmount (bulan kişiye gidecek net tutar)
  ```
- Database'den dinamik fiyatlandırma (`device_models` tablosu)

**FR-4.2: Ödeme Yapma**
- İki Adımlı Ödeme Süreci:
  1. **Ücret Detayları Ekranı**: Fiyat dökümü, güvenlik garantileri
  2. **Ödeme Yöntemi Ekranı**: Stripe/PAYNET seçimi, 3D Secure doğrulama
- Ödeme Sağlayıcıları:
  - Stripe (Önerilen)
  - PAYNET (Yakın zamanda)
- Ödeme Onayı:
  - Kullanım koşulları kabulü (zorunlu)
  - 3D Secure doğrulama
  - Ödeme başarılı → Status: `PAYMENT_COMPLETED`

**FR-4.3: Escrow (Emanet) Sistemi**
- Ödeme tamamlandığında escrow hesabı oluşturulur
- Durumlar:
  - `pending`: Ödeme bekleniyor
  - `held`: Para bloke edildi
  - `released`: Para serbest bırakıldı
  - `refunded`: İade edildi
- Serbest Bırakma Koşulları:
  - Manuel: Cihaz sahibi teslim onayı
  - Otomatik: Teslim edildikten 48 saat sonra (itiraz yoksa)
  - Admin: Manuel serbest bırakma

**FR-4.4: Kargo Süreci**
- Ödeme tamamlandıktan sonra kargo firması API'sine istek gönderilir
- Kargo firması API'si teslim kodunu (`code`) üretir
- Bulan kişi teslim kodu ile kargo firmasına cihazı teslim eder
- Kargo firması API'si takip numarası döndürür
- Status: `CARGO_SHIPPED` → `DELIVERED` → `CONFIRMED`

**FR-4.5: Teslim Onayı**
- Cihaz sahibi cihazı teslim aldığında onaylar
- Seri numarası kontrolü
- Onay butonu ile `delivery_confirmations` kaydı oluşturulur
- Escrow serbest bırakılır
- Ödemeler dağıtılır:
  - Bulan kişiye ödül transferi
  - Kargo firmasına ücret
  - Platform hizmet bedeli
  - Gateway komisyonu

#### 2.1.5 Bildirim Sistemi

**FR-5.1: Bildirim Türleri**
- In-app bildirimler (gerçek zamanlı)
- E-posta bildirimleri (opsiyonel)
- Push bildirimleri (iOS app için, gelecek)

**FR-5.2: Bildirim Senaryoları**
| Olay | Alıcı | Mesaj Anahtarı | Tip |
|------|-------|----------------|-----|
| Cihaz kaydedildi | Kayıt eden | `device_registered` | info |
| Eşleşme bulundu | Her iki taraf | `matchFoundOwner` / `matchFoundFinder` | success |
| Ödeme bekleniyor | Cihaz sahibi | `payment_reminder` | warning |
| Ödeme alındı | Bulan kişi | `payment_received_please_ship` | success |
| Teslim kodu oluşturuldu | Bulan kişi | `delivery_code_ready` | info |
| Kargoya verildi | Cihaz sahibi | `package_shipped` | info |
| Kargo yolda | Her iki taraf | `package_in_transit` | info |
| Teslim edildi | Cihaz sahibi | `package_delivered_confirm` | warning |
| Otomatik onay yaklaşıyor | Cihaz sahibi | `auto_confirm_reminder` | warning |
| Onay verildi | Bulan kişi | `reward_released` | success |
| Para transfer edildi | Bulan kişi | `reward_transferred` | success |

#### 2.1.6 Çoklu Dil Desteği

**FR-6.1: Desteklenen Diller**
- 🇹🇷 Türkçe (tr) - Ana dil
- 🇺🇸 English (en) - Varsayılan
- 🇫🇷 Français (fr)
- 🇯🇵 日本語 (ja)
- 🇪🇸 Español (es)

**FR-6.2: Çeviri Özellikleri**
- 200+ çeviri anahtarı
- Dinamik dil değiştirme (sayfa yenilemeden)
- Tutarlı terminoloji
- Form validasyon mesajları çevrilmiş

#### 2.1.7 Web Sayfası

**FR-7.1: Statik Sayfalar**
- Ana Sayfa (HomePage): Proje tanıtımı, nasıl çalışır
- SSS (FAQ): Sıkça sorulan sorular
- Kullanım Koşulları (Terms)
- Gizlilik Politikası (Privacy)
- İletişim (Contact)

**FR-7.2: Dinamik Sayfalar**
- Dashboard: Kullanıcı paneli
- Cihaz Detay: Süreç takibi
- Profil: Kullanıcı bilgileri
- Ödeme Sayfaları: Ücret detayları, ödeme yöntemi

#### 2.1.8 Admin Paneli

**FR-8.1: Admin Yetkileri**
- Tüm kullanıcıları görüntüleme
- Tüm cihazları görüntüleme
- Tüm ödemeleri görüntüleme
- Escrow hesaplarını yönetme
- İtirazları çözme
- İptal/iade işlemleri
- Audit log görüntüleme
- Sistem istatistikleri

### 2.2 Fonksiyonel Olmayan Gereksinimler

#### 2.2.1 Güvenlik

**NFR-1.1: Veri Güvenliği**

**At-Rest Encryption (Veritabanında Şifreleme):**
- **Algoritma:** AES-256-GCM (Galois/Counter Mode)
- **Şifrelenen Alanlar:**
  - TC Kimlik No (`userprofile.tc_kimlik_no`)
  - IBAN (`userprofile.iban`)
  - Telefon Numarası (`userprofile.phone_number`)
  - Adres (`userprofile.address`)
  - Kargo Gönderici Adresi (`cargo_shipments.sender_address_encrypted`)
  - Kargo Alıcı Adresi (`cargo_shipments.receiver_address_encrypted`)
- **Encryption Manager:** `utils/encryptionManager.ts` - Merkezi şifreleme yönetimi
- **Key Management:** Environment variable (`VITE_ENCRYPTION_KEY`) - 32 karakter hex (256-bit)
- **Unique IV:** Her kayıt için farklı initialization vector (replay attack koruması)
- **Authentication Tag:** GCM tag ile veri bütünlüğü kontrolü
- **Storage Format:** Base64 encoded (~48 karakter)
- **Backward Compatibility:** Mevcut plain text veriler otomatik okunur, sonraki kayıtta şifrelenir

**Güvenlik Katmanları:**
- ✅ Application-level encryption (AES-256-GCM)
- ✅ HTTPS/TLS 1.3 ile tüm iletişim şifrelenir
- ✅ JWT token ile kimlik doğrulama
- ✅ Row Level Security (RLS) ile veri izolasyonu
- ✅ Plain text görüntüleme sadece authenticated users için
- ✅ Masked display (opsiyonel) - UI'da hassas veriler maskelenir

**KVKK/GDPR Uyumluluk:**
- ✅ Hassas kişisel veriler şifrelenmiş saklanır
- ✅ Veri minimizasyonu prensibi uygulanır
- ✅ Kullanıcı veri erişim hakları desteklenir
- ✅ Veri saklama politikaları uygulanır

**NFR-1.2: Ödeme Güvenliği**
- PCI DSS uyumluluğu (Stripe entegrasyonu)
- 3D Secure doğrulama
- Fraud score hesaplama
- Risk seviyesi değerlendirmesi

**NFR-1.3: API Güvenliği**
- CORS kontrolü
- Rate limiting (gelecek)
- API key yönetimi
- Webhook signature doğrulama

#### 2.2.2 Kullanılabilirlik

**NFR-2.1: UI/UX**
- Apple İnsan Arayüzü Yönergeleri'ne (HIG) uygun tasarım
- Basit, sezgisel navigasyon
- Responsive tasarım (mobil, tablet, masaüstü)
- Erişilebilirlik (WCAG 2.1 Level AA hedef)

**NFR-2.2: Performans**
- Sayfa yükleme süresi < 3 saniye
- API yanıt süresi < 500ms (ortalama)
- Lazy loading ile kod bölümleme
- Image optimization

#### 2.2.3 Güvenilirlik

**NFR-3.1: Uptime**
- %99.5 uptime hedefi
- Otomatik failover (gelecek)
- Health check endpoints

**NFR-3.2: Hata Yönetimi**
- Kapsamlı error handling
- Kullanıcı dostu hata mesajları
- Hata loglama ve izleme
- Retry mekanizmaları

#### 2.2.4 Gizlilik

**NFR-4.1: Veri Koruma**
- GDPR uyumluluğu
- KVKK uyumluluğu (Türkiye)
- Kullanıcı verilerinin anonimleştirilmesi
- Veri saklama politikaları

**NFR-4.2: Anonimlik**
- Kullanıcılar birbirlerinin kimlik bilgilerine erişemez
- Anonim ID'ler ile kargo takibi
- Şifrelenmiş adres bilgileri

#### 2.2.5 Bakım ve Yönetilebilirlik

**NFR-5.1: Kod Kalitesi**
- TypeScript strict mode
- ESLint kuralları
- Code review süreci
- Documented API endpoints

**NFR-5.2: Monitoring**
- Audit log sistemi
- Error tracking (gelecek: Sentry)
- Performance monitoring
- Database query optimization

---

## BÖLÜM 3: TASARIM VE MİMARİ

### 3.1 Sistem Mimarisi

Proje, görevlerin net bir şekilde ayrıldığı, güvenliği ve ölçeklenebilirliği merkeze alan modern bir **üç katmanlı mimari** üzerine inşa edilmiştir. Bu mimari, **Frontend (Sunum Katmanı)**, **Backend (İş Mantığı Katmanı)** ve **Supabase (Veri ve Arka Plan Servisleri Katmanı)** olmak üzere üç ana bileşenden oluşur. Bileşenler, birbirinden bağımsız olarak geliştirilebilir, dağıtılabilir ve ölçeklenebilir olacak şekilde tasarlanmıştır.

#### 3.1.1 Genel Mimari Diyagramı

```
┌─────────────────────────────────────────────────────────────┐
│                    KULLANICI LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  Web Browser                                                 │
│  └── Modern SPA (React)                                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ HTTPS
                       │
┌──────────────────────▼──────────────────────────────────────┐
│          1. FRONTEND KATMANI (Sunum Katmanı)                 │
├─────────────────────────────────────────────────────────────┤
│  Teknoloji: React 19.1.0 + TypeScript 5.7.2                  │
│                                                              │
│  Sorumlulukları:                                             │
│  ├── UI/UX Sunumu                                            │
│  ├── Kullanıcı Etkileşimlerini Yakalama                     │
│  ├── Veri Görselleştirme                                    │
│  └── Durum Yönetimi (Context API, TanStack Query)            │
│                                                              │
│  İçerik:                                                     │
│  ├── Public Pages (Home, FAQ, Terms, Privacy)               │
│  ├── Auth Pages (Login, Register, Reset Password)           │
│  └── Protected Pages (Dashboard, Device, Profile, Payment)   │
│                                                              │
│  Önemli:                                                     │
│  ❌ Hassas iş mantığı barındırmaz                           │
│  ❌ API anahtarları içermez                                  │
│  ❌ Yönetici yetkileri yok                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ REST API / Supabase Client SDK
                       │
┌──────────────────────▼──────────────────────────────────────┐
│       2. BACKEND KATMANI (İş Mantığı Katmanı)              │
├─────────────────────────────────────────────────────────────┤
│  Teknoloji: Node.js + Express                               │
│  Dağıtım: Frontend'den bağımsız container                   │
│  Port: 3001 (Production)                                   │
│                                                              │
│  Sorumlulukları:                                             │
│  ├── 🔐 Hassas Operasyonlar                                │
│  │   └── Gizli API anahtarları burada yönetilir            │
│  │       (Stripe Secret Key, Cargo API Keys, vb.)         │
│  │                                                          │
│  ├── 💳 Ödeme Sistemi Entegrasyonu                         │
│  │   ├── Stripe Integration                                │
│  │   ├── PAYNET Integration                                │
│  │   ├── Payment Processing                                │
│  │   ├── Webhook Management                                │
│  │   └── 3D Secure Handling                                │
│  │                                                          │
│  ├── 📦 Kargo API Entegrasyonu                             │
│  │   ├── Cargo Company API Calls                           │
│  │   ├── Shipment Creation                                 │
│  │   ├── Tracking Management                               │
│  │   └── Webhook Processing                                │
│  │                                                          │
│  ├── 👨‍💼 Admin Konsolu Mantığı                           │
│  │   ├── Yüksek Yetki Gerektiren İşlemler                 │
│  │   ├── Kullanıcı Yönetimi                                │
│  │   ├── İşlem İptalleri                                   │
│  │   └── Raporlama                                         │
│  │                                                          │
│  └── ⚙️ Karmaşık İş Kuralları                             │
│      └── Supabase Edge Function'lara sığmayan              │
│          merkezi işlemler                                   │
│                                                              │
│  API Endpoints:                                             │
│  ├── POST /v1/payments/process                             │
│  ├── POST /v1/payments/complete-3d                         │
│  ├── GET /v1/payments/{paymentId}/status                  │
│  ├── GET /v1/payments/{paymentId}/webhook-data            │
│  ├── POST /v1/payments/release-escrow                      │
│  └── POST /v1/webhooks/paynet-callback                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Supabase Client SDK
                       │ (Backend → Supabase)
                       │
┌──────────────────────▼──────────────────────────────────────┐
│    3. SUPABASE KATMANI (Veri ve Arka Plan Servisleri)      │
├─────────────────────────────────────────────────────────────┤
│  Backend-as-a-Service (BaaS)                                 │
│  └── Projenin Veri ve Güvenlik Omurgası                     │
│                                                              │
│  Sorumlulukları:                                             │
│  ├── 🗄️ Veri Depolama ve Erişim                           │
│  │   └── PostgreSQL Database (Cloud-hosted)                │
│  │                                                          │
│  ├── 🔐 Kimlik Doğrulama (Authentication)                  │
│  │   ├── User Registration                                 │
│  │   ├── Login/Logout                                      │
│  │   ├── OAuth (Google, Apple)                             │
│  │   ├── Session Management (JWT)                         │
│  │   └── Password Reset                                    │
│  │                                                          │
│  ├── 🛡️ Yetkilendirme ve Veri Güvenliği                   │
│  │   ├── Row Level Security (RLS) Policies                │
│  │   ├── Role-Based Access Control                         │
│  │   └── Data Isolation (Her kullanıcı sadece kendi       │
│  │       verilerine erişir)                                 │
│  │                                                          │
│  ├── ⚡ Sunucusuz Arka Plan Görevleri                       │
│  │   ├── Edge Functions (Serverless)                      │
│  │   ├── Cron Jobs (Zamanlanmış Görevler)                 │
│  │   └── Örnek: 48 Saatlik Otomatik Onay                  │
│  │       (Teslim edildikten 48 saat sonra otomatik        │
│  │        escrow serbest bırakma)                          │
│  │                                                          │
│  ├── 📁 Dosya Depolama (Storage)                           │
│  │   ├── Invoice/Fatura Yüklemeleri                        │
│  │   ├── Device Photo Storage                             │
│  │   └── Secure File Access                                │
│  │                                                          │
│  └── 🔔 Real-time Subscriptions                           │
│      ├── Live Notifications                                │
│      ├── Status Updates                                    │
│      └── Device Matching Alerts                            │
│                                                              │
│  Frontend → Supabase:                                       │
│  └── Doğrudan güvenli erişim (RLS ile korumalı)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              EXTERNAL SERVICES                              │
├─────────────────────────────────────────────────────────────┤
│  ├── 💳 Payment Gateway                                     │
│  │   ├── Stripe (Production)                               │
│  │   ├── PAYNET (Planned)                                  │
│  │   └── Webhook Endpoints                                 │
│  │                                                          │
│  ├── 📦 Cargo Company APIs                                 │
│  │   ├── Aras Kargo                                        │
│  │   ├── Yurtiçi Kargo                                     │
│  │   ├── MNG Kargo                                         │
│  │   ├── PTT Kargo                                         │
│  │   └── Webhook (Status Updates)                          │
│  │                                                          │
│  └── 🤖 Google Gemini AI                                    │
│      ├── Reward Suggestions                                 │
│      └── Description Suggestions                            │
└─────────────────────────────────────────────────────────────┘
```

#### 3.1.2 Mimari Akış Özeti

**Veri Akışı:**
1. **Frontend** → Kullanıcı etkileşimlerini yakalar
2. **Frontend** → Supabase (güvenli veri erişimi, RLS ile korumalı)
3. **Frontend** → Backend (hassas işlemler için)
4. **Backend** → External Services (Stripe, Cargo APIs)
5. **Backend** → Supabase (veri güncellemeleri)
6. **Supabase** → Frontend (real-time updates)

**Güvenlik Akışı:**
- Frontend: Sadece public/anon key ile Supabase'e erişir
- Backend: Secret keys ile external services'e erişir
- Supabase: RLS politikaları ile veri erişimini kontrol eder

**Avantajlar:**
- ✅ **Bağımsız Geliştirme**: Her katman ayrı geliştirilebilir
- ✅ **Bağımsız Dağıtım**: Her katman ayrı container'da çalışabilir
- ✅ **Ölçeklenebilirlik**: Katmanlar bağımsız ölçeklenebilir
- ✅ **Güvenlik**: Hassas bilgiler backend'de izole
- ✅ **Bakım Kolaylığı**: Sorumluluklar net ayrılmış

#### 3.1.2 Kullanılan Teknolojiler

**1. Frontend Katmanı (Sunum):**
- **React 19.1.0**: Modern React hooks, Concurrent features
- **TypeScript 5.7.2**: Tip güvenliği, geliştirici deneyimi
- **Tailwind CSS**: Utility-first CSS framework (CDN)
- **React Router DOM 7.6.3**: Client-side routing
- **TanStack Query**: Server state management
- **Lucide React 0.525.0**: Modern icon library
- **Vite 6.2.0**: Build tool, dev server

**2. Backend Katmanı (İş Mantığı):**
- **Node.js**: Runtime environment
- **Express**: Web framework
- **@supabase/supabase-js**: Supabase client (backend için)
- **CORS**: Cross-origin resource sharing
- **Environment Variables**: Secret keys yönetimi

**3. Supabase (Veri ve Arka Plan Servisleri):**
- **Supabase 2.55.0**: Backend-as-a-Service
  - **PostgreSQL**: Cloud-hosted database
  - **Supabase Auth**: Authentication service
  - **Real-time**: Subscriptions API
  - **Row Level Security (RLS)**: Data access control
  - **Storage**: File storage API
  - **Edge Functions**: Serverless functions (gelecek)
  - **Database Functions**: PostgreSQL functions
  - **Cron Jobs**: Scheduled tasks

**4. External Services:**
- **Payment Gateways:**
  - **Stripe**: Payment processing (production)
  - **PAYNET**: Alternative payment provider (planned)
- **Cargo APIs:**
  - Aras Kargo API
  - Yurtiçi Kargo API
  - MNG Kargo API
  - PTT Kargo API
- **AI Services:**
  - **Google Gemini API**: AI-powered suggestions
    - Gemini 2.5 Flash model
    - Structured JSON responses

**5. DevOps ve Altyapı:**
- **Vite**: Frontend build tool
- **Express**: Backend server
- **Docker**: Containerization (gelecek)
- **Nginx**: Reverse proxy (production)
- **Environment Variables**: Configuration management

#### 3.1.3 API Tasarımı

**Backend API (Express Server):**
RESTful API prensipleri ile tasarlanmış, hassas işlemler için backend servisi.

**Endpoint Yapısı:**
```
Backend Server (Port 3001)
├── POST /v1/payments/process              # Ödeme başlatma (Paynet)
├── POST /v1/payments/complete-3d          # 3D Secure tamamlama
├── GET /v1/payments/{paymentId}/status   # Payment status kontrolü
├── GET /v1/payments/{paymentId}/webhook-data  # Webhook data çekme
├── POST /v1/payments/release-escrow       # Escrow serbest bırakma
└── POST /v1/webhooks/paynet-callback     # Paynet webhook receiver

NOT: Backend, Paynet API ile iletişim kurar ve webhook geldiğinde tüm veritabanı kayıtlarını oluşturur.
     Frontend/iOS, backend'den ödeme sonucunu alır ve sadece kullanıcıya gösterir - veritabanına yazmaz.
```

**Supabase API (Direct Client Access):**
Frontend ve Backend'den direkt Supabase Client SDK ile erişim.

**Frontend → Supabase:**
- Database queries (RLS ile korumalı)
- Authentication operations
- Real-time subscriptions
- File uploads (Storage)

**Backend → Supabase:**
- Database operations (service role key ile)
- Batch operations
- Admin operations

**API Güvenlik:**
- **Frontend API Calls**: Supabase anon key (RLS korumalı)
- **Backend API Calls**: Secret keys (Stripe, Cargo APIs)
- **Webhook Verification**: Signature validation
- **CORS**: Backend'de yapılandırılmış

### 3.2 Veritabanı Tasarımı

#### 3.2.1 Ana Tablolar

**1. `userprofile` - Kullanıcı Profilleri**
- Temel kullanıcı bilgileri
- Kimlik bilgileri (şifrelenmiş)
  - `tc_kimlik_no`: TEXT (AES-256-GCM encrypted)
  - `iban`: TEXT (AES-256-GCM encrypted)
  - `phone_number`: TEXT (AES-256-GCM encrypted)
  - `address`: TEXT (AES-256-GCM encrypted)
- İletişim bilgileri
- Banka bilgileri

**Not:** Şifrelenen alanlar `TEXT` tipinde saklanır (encrypted data için sınırsız uzunluk). Format constraint'leri (`check_tc_kimlik_format`, `check_iban_format`) kaldırılmıştır çünkü encrypted data format kontrolüne uygun değildir.

**2. `devices` - Cihaz Kayıtları**
- Kayıp/bulunan cihaz bilgileri
- Status enum ile süreç takibi
- Model, seri numarası, renk vb.
- `device_role` kolonu ile owner/finder ayrımı ('owner' veya 'finder')

**3. `payments` - Ödeme İşlemleri**
- Ödeme kayıtları
- Ödeme durumu
- Gateway bilgileri

**4. `escrow_accounts` - Escrow Hesapları**
- Emanet hesapları
- Tutar bilgileri
- Serbest bırakma koşulları

**5. `cargo_shipments` - Kargo Gönderileri**
- Kargo kayıtları
- Teslim kodu ve takip numarası
- Kargo durumu
- Şifrelenmiş adres bilgileri:
  - `sender_address_encrypted`: TEXT (AES-256-GCM encrypted)
  - `receiver_address_encrypted`: TEXT (AES-256-GCM encrypted)

**6. `delivery_confirmations` - Teslimat Onayları**
- Teslim onay kayıtları
- Onay tipi ve verileri

**7. `notifications` - Bildirimler**
- Kullanıcı bildirimleri
- Okunma durumu

**8. `audit_logs` - Denetim Kayıtları**
- Tüm sistem olayları
- Güvenlik ve compliance

Detaylı şema: [COMPLETE_DATABASE_SCHEMA.md](database/COMPLETE_DATABASE_SCHEMA.md)

#### 3.2.2 İlişkiler

```
userprofile (1) ──→ (N) devices
devices (1) ──→ (N) payments
payments (1) ──→ (1) escrow_accounts
payments (1) ──→ (N) cargo_shipments
cargo_shipments (1) ──→ (N) delivery_confirmations
devices (1) ──→ (N) notifications
```

### 3.3 Kullanıcı Arayüzü (UI) ve Kullanıcı Deneyimi (UX) Tasarımı

#### 3.3.1 Tasarım Prensipleri

**Apple HIG Uyumluluğu:**
- Minimalist tasarım
- Büyük, okunabilir fontlar
- Yeterli boşluklar
- Tutarlı renk paleti
- Smooth animations

**Responsive Tasarım:**
- Mobile-first yaklaşım
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Touch-friendly butonlar
- Optimized images

**Erişilebilirlik:**
- WCAG 2.1 Level AA hedef
- Keyboard navigation
- Screen reader support
- Color contrast

#### 3.3.2 Temel Kullanıcı Akışları

**Akış 1: Kayıt ve İlk Kullanım**
```
Ana Sayfa → Kayıt Ol → Email/Şifre/OAuth → Profil Tamamlama → Dashboard
```

**Akış 2: Kayıp Cihaz Bildirme**
```
Dashboard → Cihaz Ekle → "Kaybettim" → Form Doldur → Fatura Yükle → Kaydet → Eşleşme Bekle
```

**Akış 3: Bulunan Cihaz Bildirme**
```
Dashboard → Cihaz Ekle → "Buldum" → Form Doldur → Fotoğraf Yükle → Kaydet → Eşleşme Bekle
```

**Akış 4: Eşleşme ve Ödeme (Sahip)**
```
Eşleşme Bildirimi → Cihaz Detay → "Ödemeyi Güvenle Yap" → Ücret Detayları → Ödeme Yöntemi → 3D Secure → Ödeme Başarılı → Kargo Bekle
```

**Akış 5: Kargo ve Teslim (Sahip)**
```
Kargo Bekle → Kargo Yola Çıktı → Teslim Edildi Bildirimi → Cihaz Kontrol → "Onayla" → İşlem Tamamlandı
```

**Akış 6: Ödeme ve Kargo (Bulan)**
```
Ödeme Alındı Bildirimi → Cihaz Detay → Teslim Kodu Görüntüle → Kargo Firmasına Teslim Et → Onay Bekle → Ödül Alındı
```

#### 3.3.3 Sayfa Yapıları

**Ana Sayfa (HomePage.tsx)**
- Hero section
- Nasıl çalışır (4 adım)
- Özellikler
- CTA butonları

**Dashboard (DashboardPage.tsx)**
- Cihaz listesi (kart görünümü)
- Durum filtreleri
- Hızlı işlemler
- Bildirimler

**Cihaz Detay (DeviceDetailPage.tsx)**
- Cihaz bilgileri kartı
- İşlem durumu kartı
- Adım adım durum gösterimi
- İşlem butonları
- Ödeme/Escrow bilgileri (varsa)
- Kargo takibi (varsa)

**Ödeme Sayfaları**
- MatchPaymentPage: Ücret detayları, ödeme yöntemi seçimi
- PaymentFlowPage: Ödeme akışı yönetimi
- PaymentSuccessPage: Başarılı ödeme onayı

### 3.4 Güvenlik Tasarımı

#### 3.4.1 Veri Şifreleme

**At Rest (Veritabanında):**

Sistemde hassas kullanıcı verileri AES-256-GCM algoritması ile şifrelenerek saklanır. Bu yaklaşım KVKK/GDPR uyumluluğu sağlar ve veri güvenliğini maksimize eder.

**Şifrelenen Veriler:**
- `tc_kimlik_no` - TC Kimlik Numarası (userprofile tablosu)
- `iban` - IBAN numarası (userprofile tablosu)
- `phone_number` - Telefon numarası (userprofile tablosu)
- `address` - Adres bilgisi (userprofile tablosu)
- `sender_address_encrypted` - Gönderen adresi (cargo_shipments tablosu)
- `receiver_address_encrypted` - Alıcı adresi (cargo_shipments tablosu)

**Şifreleme Teknik Detayları:**
- **Algoritma:** AES-256-GCM (Galois/Counter Mode)
- **Key Management:** Environment variable (`VITE_ENCRYPTION_KEY`)
- **IV (Initialization Vector):** Her kayıt için unique 96-bit IV
- **Authentication Tag:** GCM tag (128-bit) ile veri bütünlüğü kontrolü
- **Storage Format:** Base64 encoded string (~48 karakter)
- **Encryption Manager:** `utils/encryptionManager.ts` dosyasında merkezi yönetim

**Veritabanı Yapısı:**
- Şifrelenen alanlar `TEXT` tipinde saklanır (sınırsız uzunluk için)
- Format constraint'leri kaldırılmıştır (encrypted data için uygun değil)
- Backward compatibility: Mevcut plain text veriler otomatik okunur ve sonraki kayıtta şifrelenir

**Şifreleme Akışı:**

**Kaydetme (Encrypt):**
```
Kullanıcı Input: "12345678901" (plain text)
     ↓
encryptUserProfile() fonksiyonu
     ↓
AES-256-GCM Encryption (unique IV ile)
     ↓
Veritabanı: "aXc9kL2mN3pQr5s..." (encrypted, ~48 chars)
```

**Okuma (Decrypt):**
```
Veritabanı: "aXc9kL2mN3pQr5s..." (encrypted)
     ↓
decryptUserProfile() fonksiyonu
     ↓
AES-256-GCM Decryption + GCM Tag Verification
     ↓
Kullanıcı Görünümü: "12345678901" (plain text)
```

**Güvenlik Özellikleri:**
- ✅ **At-rest encryption**: Veritabanında şifrelenmiş saklanır
- ✅ **Application-level protection**: Şifreleme/çözme uygulama katmanında
- ✅ **Unique IV**: Her şifreleme için farklı IV (replay attack koruması)
- ✅ **Authentication Tag**: Veri bütünlüğü ve authenticity kontrolü
- ✅ **Key Security**: Encryption key environment variable'da, asla kod içinde değil
- ✅ **Backward Compatible**: Mevcut plain text veriler sorunsuz okunur

**Performans:**
- Encryption süresi: ~1-2ms per field
- Kullanıcı deneyimi: Minimal impact (fark edilmez)
- Database storage: ~48 karakter per encrypted field

**Key Management:**
- Key oluşturma: `scripts/generate-encryption-key.js` script'i ile
- Key format: 32 karakter hex string (64 karakter hex = 256-bit)
- Key storage: `.env` dosyasında (`VITE_ENCRYPTION_KEY`)
- **Kritik:** Key asla git repository'ye commit edilmemelidir
- Production: Production ortamında farklı key kullanılmalıdır

**Migration Stratejisi:**
- Lazy migration: Kullanıcı profil güncellemesinde otomatik şifreleme
- Mevcut plain text veriler: İlk okumada plain text döner, sonraki kayıtta encrypted olur
- Geçiş sorunsuz: Kullanıcı deneyimi etkilenmez

**In Transit (İletimde):**
- HTTPS/TLS 1.3
- TLS certificate validation
- Secure cookies

#### 3.4.2 Kimlik Doğrulama

**Supabase Auth:**
- JWT token tabanlı
- OAuth providers (Google, Apple)
- Email verification
- Password reset flow
- Session management

**JWT Token Yapısı:**
- Access token (kısa süreli)
- Refresh token (uzun süreli)
- Token expiration handling

#### 3.4.3 Yetkilendirme

**Row Level Security (RLS):**
- Kullanıcılar sadece kendi verilerini görebilir
- Admin'ler tüm verileri görebilir
- Role-based access control

**API Yetkilendirme:**
- JWT token validation
- User ID verification
- Resource ownership checks

### 3.5 Ödeme Sistemi Entegrasyonu

#### 3.5.1 Seçilen Ödeme Sağlayıcıları

**Stripe (Önerilen):**
- PCI DSS compliant
- 3D Secure desteği
- Webhook entegrasyonu
- Multiple currencies

**PAYNET (Yakın Zamanda):**
- Türkiye odaklı
- Yerel ödeme yöntemleri

#### 3.5.2 Escrow Mantığı

**Akış:**
1. Ödeme yapılır → Stripe hesabına gider
2. Escrow account oluşturulur → Status: `held`
3. Para bloke edilir → Cihaz sahibine geri dönmez
4. Cihaz teslim edilir → Kullanıcı onaylar
5. Escrow serbest bırakılır → Status: `released`
6. Ödemeler dağıtılır:
   - Bulan kişiye ödül (IBAN transfer)
   - Kargo firmasına ücret
   - Platform hizmet bedeli

#### 3.5.3 Ödeme Akış Diyagramı

```
Kullanıcı Ödeme Sayfası
    ↓
Ücret Detayları Görüntüle
    ↓
Ödeme Yöntemi Seç (Stripe)
    ↓
Kart Bilgileri Gir
    ↓
3D Secure Doğrulama
    ↓
Stripe API → Ödeme İşle
    ↓
Webhook → Ödeme Başarılı
    ↓
Database: payment.status = 'completed'
    ↓
Escrow Account Oluştur
    ↓
Kargo Firması API → Teslim Kodu Üret
    ↓
Bulan Kişiye Teslim Kodu Göster
```

### 3.6 Kargo Sistemi Entegrasyonu

#### 3.6.1 Kargo Firması API Entegrasyonu

**Desteklenen Firmalar:**
- Aras Kargo
- Yurtiçi Kargo
- MNG Kargo
- PTT Kargo

**API İşlemleri:**
1. **Gönderi Oluşturma** (`create-shipment`)
   - Gönderici bilgileri (anonim, şifrelenmiş)
   - Alıcı bilgileri (anonim, şifrelenmiş)
   - Cihaz bilgileri
   - API Response: `code` (teslim kodu), `tracking_number` (opsiyonel)

2. **Takip Bilgisi** (`get-tracking`)
   - Tracking number ile durum sorgulama
   - Real-time güncellemeler

3. **Webhook** (`webhook-status`)
   - Kargo durumu güncellemeleri
   - Teslim edildi bildirimi
   - Başarısız teslimat bildirimi

#### 3.6.2 Kargo Süreci

```
Ödeme Tamamlandı
    ↓
Kargo Firması API: create-shipment
    ↓
API Response: code (teslim kodu)
    ↓
cargo_shipments tablosuna kaydet
    ↓
Bulan Kişiye Teslim Kodu Göster
    ↓
Bulan Kişi Kargo Firmasına Gider
    ↓
Teslim Kodu ile Cihazı Teslim Eder
    ↓
Kargo Firması API: tracking_number döner
    ↓
Webhook: cargo_status = 'picked_up'
    ↓
Kargo Yolda → cargo_status = 'in_transit'
    ↓
Teslim Edildi → cargo_status = 'delivered'
    ↓
Kullanıcı Onayı Bekle
```

---

## BÖLÜM 4: KULLANICI DOKÜMANTASYONU

### 4.1 Web Sitesi İçeriği

#### 4.1.1 Nasıl Çalışır?

**Adım 1: Kayıt Ol**
- Email ve şifre ile kayıt ol
- Profil bilgilerini tamamla
- Kullanım şartlarını kabul et

**Adım 2: Cihaz Bildir**
- Kayıp cihaz için: Model, seri numarası, fatura yükle
- Bulunan cihaz için: Model, seri numarası, fotoğraf yükle

**Adım 3: Eşleşme Bekle**
- Sistem otomatik eşleştirme yapar
- Eşleşme bulunduğunda bildirim gelir

**Adım 4: Ödeme Yap (Sadece Cihaz Sahibi)**
- Ücret detaylarını görüntüle
- Güvenli ödeme yap
- Para escrow sisteminde tutulur

**Adım 5: Kargo ile Teslim**
- Bulan kişi teslim kodu ile kargo firmasına teslim eder
- Kargo takip numarası ile takip edilir
- Cihaz sahibine teslim edilir

**Adım 6: Onayla ve Ödül Al**
- Cihaz sahibi teslim almayı onaylar
- Bulan kişiye ödül transfer edilir
- İşlem tamamlanır

#### 4.1.2 Ücretlendirme

**Ücret Yapısı:**
- Toplam tutar cihaz modeline göre değişir
- Gateway komisyonu: %3.43
- Kargo ücreti: 250.00 TL (sabit)
- Bulan kişi ödülü: %20
- Platform hizmet bedeli: Kalan tutar

**Örnek Hesaplama:**
- Toplam: 2,000.00 TL
- Gateway: 68.60 TL (%3.43)
- Kargo: 250.00 TL
- Ödül: 400.00 TL (%20)
- Hizmet: 1,281.40 TL (geriye kalan)

#### 4.1.3 Güvenlik ve Gizlilik Taahhüdü

- **Anonimlik**: Kullanıcılar birbirlerinin kimlik bilgilerine erişemez
- **Şifreleme**: Hassas bilgiler şifreli saklanır
- **Escrow**: Ödeme güvenli sistemde tutulur
- **GDPR/KVKK**: Veri koruma yasalarına uyumluluk

#### 4.1.4 SSS (Sıkça Sorulan Sorular)

**Genel Sorular:**
- Nasıl çalışır?
- Güvenli mi?
- Ücretlendirme nasıl?

**Eşleşme Soruları:**
- Eşleşme ne kadar sürer?
- Eşleşme garantisi var mı?
- Sahte cihaz kontrolü var mı?

**Ödeme Soruları:**
- Ödeme nasıl yapılır?
- İade politikası nedir?
- Ödül ne zaman alınır?

**Kargo Soruları:**
- Hangi kargo firmaları destekleniyor?
- Teslim süresi ne kadar?
- Takip nasıl yapılır?

#### 4.1.5 Kullanım Koşulları

- Hizmet şartları
- Kullanıcı sorumlulukları
- Platform sorumlulukları
- İptal ve iade politikası
- Fikri mülkiyet hakları

#### 4.1.6 Gizlilik Politikası

- Veri toplama
- Veri kullanımı
- Veri paylaşımı
- Çerez politikası
- Kullanıcı hakları

#### 4.1.7 Destek Bilgileri

- Email: support@ifoundanapple.com
- Yanıt süresi: 24 saat
- Diller: Türkçe, İngilizce

### 4.2 Web Platformu Kullanım Kılavuzu

#### 4.2.1 Kurulum ve İlk Açılış

1. Web sitesine git: https://ifoundanapple.com
2. Ana sayfayı incele
3. "Kayıt Ol" butonuna tıkla

#### 4.2.2 Hesap Oluşturma

**Kayıt Seçenekleri:**
- Email + Şifre
- Google ile Giriş
- Apple ile Giriş

**Gerekli Bilgiler:**
- Email (zorunlu)
- Şifre (min. 8 karakter)
- Ad (zorunlu)
- Soyad (zorunlu)
- Kullanım şartları kabulü (zorunlu)

#### 4.2.3 Kayıp Cihaz Ekleme

**Adımlar:**
1. Dashboard → "Cihaz Ekle" butonu
2. "Kaybettim" seçeneğini seç
3. Formu doldur:
   - Cihaz Modeli (dropdown)
   - Seri Numarası (12 haneli)
   - Kayıp Tarihi
   - Kayıp Yeri
   - Cihaz Rengi (opsiyonel)
   - Ek Detaylar (opsiyonel)
4. Fatura yükle (PDF/JPG)
5. "Kaydet" butonuna tıkla

**Önemli Notlar:**
- Fatura doğruluğu kontrol edilir
- Seri numarası doğruluğu önemlidir
- Eşleşme bulunana kadar bekleyin

#### 4.2.4 Bulunan Cihaz Bildirme

**Adımlar:**
1. Dashboard → "Bulunan Cihaz Bildir" butonu
2. Formu doldur:
   - Cihaz Modeli
   - Seri Numarası
   - Bulunma Tarihi
   - Bulunma Yeri
   - Cihaz Rengi (opsiyonel)
   - Ek Detaylar (opsiyonel)
3. Cihaz fotoğrafları yükle (ön ve arka, 2 fotoğraf)
4. "Kaydet" butonuna tıkla

**Önemli Notlar:**
- Fotoğraflar net olmalı
- Seri numarası görünür olmalı
- Eşleşme bulunana kadar bekleyin

#### 4.2.5 Bildirimleri Anlama ve Yönetme

**Bildirim Türleri:**
- ✅ Başarı: Yeşil (eşleşme, ödeme, tamamlandı)
- ⚠️ Uyarı: Turuncu (hatırlatma, onay bekleniyor)
- ℹ️ Bilgi: Mavi (güncellemeler)

**Bildirim Yönetimi:**
- Bildirim listesi: Header'da bildirim ikonu
- Bildirim okundu işaretleme
- Bildirim linklerine tıklama

#### 4.2.6 Eşleşme Sonrası Süreç (Cihaz Sahibi)

**Ödeme Süreci:**
1. Eşleşme bildirimi al
2. Cihaz detay sayfasına git
3. "Ödemeyi Güvenle Yap" butonuna tıkla
4. Ücret detaylarını kontrol et
5. "Ödemeye Geç" butonuna tıkla
6. Ödeme yöntemini seç (Stripe)
7. Kart bilgilerini gir
8. 3D Secure doğrulama yap
9. Ödeme başarılı → Kargo bekleniyor

**Teslim Süreci:**
1. Kargo takip numarası ile takip et
2. Teslim edildi bildirimi al
3. Cihazı kontrol et (seri numarası)
4. "Onayla" butonuna tıkla
5. İşlem tamamlandı

#### 4.2.7 Eşleşme Sonrası Süreç (Bulan Kişi)

**Ödeme Bekleme:**
1. Eşleşme bildirimi al
2. Cihaz sahibinin ödeme yapmasını bekle
3. Profil bilgilerini tamamla (IBAN, TC Kimlik)

**Kargo Süreci:**
1. Ödeme alındı bildirimi al
2. Teslim kodunu görüntüle
3. Kargo firmasına git
4. Teslim kodu ile cihazı teslim et
5. Takip numarası ile takip et

**Ödül Alma:**
1. Cihaz sahibinin onayını bekle
2. Ödül serbest bırakıldı bildirimi al
3. IBAN'a ödül transfer edilir (1-3 iş günü)

#### 4.2.8 Profil Yönetimi

**Profil Sayfası:**
- Kişisel bilgileri güncelle
- Kimlik bilgilerini ekle/düzenle
- İletişim bilgilerini güncelle
- Banka bilgilerini ekle/düzenle

**Önemli Notlar:**
- IBAN sadece bulan kişi için zorunlu
- TC Kimlik ödeme için zorunlu
- Adres kargo için zorunlu
- **Güvenlik:** Tüm hassas bilgiler (TC, IBAN, Telefon, Adres) veritabanında AES-256-GCM ile şifrelenmiş olarak saklanır
- **Encryption Key Backup:** Encryption key (`VITE_ENCRYPTION_KEY`) **manuel olarak** yedeklenmelidir. Key kaybı durumunda şifrelenmiş tüm veriler kalıcı olarak kaybolur. Detaylı backup stratejisi için yukarıdaki "Encryption Key Oluşturma" bölümüne bakın.
- **Görüntüleme:** Kullanıcıya plain text olarak gösterilir (otomatik decrypt)
- **Key Güvenliği:** Encryption key asla git repository'ye commit edilmemelidir

#### 4.2.9 Sorun Giderme

**Sık Karşılaşılan Sorunlar:**
- Eşleşme bulunamadı → Bekleyin veya seri numarasını kontrol edin
- Ödeme başarısız → Kart bilgilerini kontrol edin
- Kargo takip edilemiyor → Kargo firmasıyla iletişime geçin
- Ödül gelmedi → IBAN bilgilerini kontrol edin

**Destek:**
- Email: support@ifoundanapple.com
- FAQ sayfasını kontrol edin

---

## BÖLÜM 5: GELİŞTİRİCİ DOKÜMANTASYONU

### 5.1 README.md

Detaylı README içeriği için: [README.md](README.md)

**Özet:**
- Proje özeti
- Teknoloji yığını
- Kurulum adımları
- Proje yapısı
- Çoklu dil desteği
- Deployment bilgileri

### 5.2 API Referansı

#### 5.2.1 Ücret Hesaplama API

**Endpoint:** `/api/calculate-fees`

**Request:**
```typescript
interface FeeCalculationRequest {
  deviceModel: string;
  deviceCategory?: string;
}
```

**Response:**
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

#### 5.2.2 Ödeme İşleme API

**Endpoint:** `/api/process-payment`

**Request:**
```typescript
interface PaymentRequest {
  deviceId: string;
  payerId: string;
  receiverId?: string;
  feeBreakdown: FeeBreakdown;
  paymentProvider: 'stripe' | 'paynet' | 'test';
  paymentMethod: string;
}
```

**Response:**
```typescript
interface PaymentResponse {
  success: boolean;
  paymentId: string;
  status: 'pending' | 'completed' | 'failed';
  providerPaymentId?: string;
  providerResponse?: any;
}
```

#### 5.2.3 Escrow Serbest Bırakma API

**Endpoint:** `POST /v1/payments/release-escrow`

**ÖNEMLİ:** Backend sadece Paynet API'ye escrow release isteği gönderir. Veritabanı güncellemeleri frontend/iOS tarafından yapılır.

**Request:**
```typescript
interface EscrowReleaseRequest {
  paymentId: string;
  deviceId: string;
  releaseReason: string;
  confirmationType: 'device_received' | 'timeout_release' | 'manual_release';
  confirmedBy: string;
}
```

**Response:**
```typescript
interface EscrowReleaseResponse {
  success: boolean;
  escrowId: string;
  releasedAt: string;
  distributionId?: string;
}
```

### 5.3 Mimari Detayları

#### 5.3.1 Frontend Mimarisi

**Component Hiyerarşisi:**
```
App.tsx
├── Header
├── Routes
│   ├── Public Routes
│   ├── Protected Routes
│   └── Admin Routes
└── Footer
```

**State Management:**
- React Context API (AppContext.tsx)
- TanStack Query (Server state)
- Local state (Component level)

**Routing:**
- React Router DOM 7.6.3
- Lazy loading (code splitting)
- Protected routes
- Admin routes

#### 5.3.2 Backend Mimarisi

**Backend Servis (Node.js/Express):**
- **Port**: 3001 (production)
- **Framework**: Express.js
- **Purpose**: Hassas işlemler, external API entegrasyonları

**Backend Sorumlulukları:**

**1. Ödeme Süreci:**
- Paynet ile ödeme haberleşmesini üstlenir
- Frontend/iOS'tan gelen ödeme talebini alır
- Paynet API ile haberleşerek başarılı/başarısız ödeme sürecini frontend/iOS'a bildirir
- Webhook'ları alır, doğrular ve saklar
- **Ödeme başlatıldığında payment ID oluşturur ve veritabanına yazar** (`payments` tablosuna `status = 'pending'` ile)
- **Webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true) tüm veritabanı kayıtlarını oluşturur:**
  - `payments` tablosunu günceller
  - `escrow_accounts` tablosuna kayıt oluşturur
  - `devices` tablosunda status'u `payment_completed` yapar
  - `audit_logs` tablosuna kayıt oluşturur
  - `notifications` tablosuna bildirim kayıtları oluşturur
- Veritabanından **okuma** yapar (kontrol amaçlı: device status, user kontrolü, tutar doğrulama)

**2. Kargo Süreci:**
- Kargo firması ile haberleşmeyi sağlar
- Kargo firmasından alınan takip numarasını (`tracking_number`) ve teslim kodunu (`code`) veritabanına yazar
- Kargo firmasından süreç bilgilerini alıp ilgili tablolara (`cargo_shipments`) yazar

**3. Diğer:**
- Webhook yönetimi
- Admin işlemleri
- Secret key yönetimi

**Supabase Yapısı (BaaS):**
- **PostgreSQL Database**: Cloud-hosted
- **Real-time Subscriptions**: Live updates
- **Row Level Security (RLS)**: Data access control
- **Storage API**: File management
- **Edge Functions**: Serverless functions (gelecek)
- **Cron Jobs**: Scheduled tasks (48 saatlik otomatik onay)

**Database Operations:**
- Frontend: Supabase Client SDK (anon key, RLS korumalı)
- Backend: Supabase Client SDK (service role key)
- Type-safe queries
- Error handling
- Transaction support

**Hassas Veri Şifreleme:**
- Encryption Manager: `utils/encryptionManager.ts`
- Şifreleme: `encryptUserProfile()` fonksiyonu ile kaydetme
- Şifre Çözme: `decryptUserProfile()` fonksiyonu ile okuma
- AppContext entegrasyonu: `fetchUserProfile` ve `updateUserProfile` fonksiyonlarında otomatik şifreleme/çözme
- Backward compatibility: Plain text veriler otomatik okunur, sonraki kayıtta şifrelenir
- Performance: ~1-2ms per field encryption/decryption (minimal impact)

#### 5.3.3 Modüller Arası Etkileşimler

**Authentication Flow:**
```
User → LoginPage → Supabase Auth → JWT Token → AppContext → Protected Routes
```

**Device Matching Flow:**
```
AddDevice → Supabase Insert → Trigger/Function → Match Check → Update Status → Notify Users
```

**Payment Flow:**
```
MatchPaymentPage (Frontend/iOS) 
  → Backend API (POST /v1/payments/process) 
  → Backend Payment ID oluşturur ve veritabanına yazar (payments tablosuna status='pending' ile)
  → Paynet API (3D Secure başlatma)
  → 3D Secure Doğrulama
  → Backend API (POST /v1/payments/complete-3d)
  → Paynet Webhook (POST /v1/webhooks/paynet-callback)
  → Backend webhook'u alır, doğrular, saklar ve **tüm veritabanı kayıtlarını oluşturur** (payments, escrow_accounts, devices, audit_logs, notifications)
  → Frontend/iOS polling yapar (GET /v1/payments/{paymentId}/status)
  → Frontend/iOS ödeme sonucunu alır ve kullanıcıya gösterir (veritabanına yazmaz)
  → Frontend/iOS (Real-time update)
```

**ÖNEMLİ MİMARİ PRENSİPLER:**
- **Backend:** Paynet API ile iletişim kurar, webhook'u alır, doğrular, saklar ve **eğer ödeme başarılı (is_succeed: true) ise tüm veritabanı kayıtlarını oluşturur** (payments, escrow_accounts, devices, audit_logs, notifications).
- **Frontend/iOS:** Backend'den ödeme sonucunu alır ve sadece kullanıcıya gösterir. **Veritabanına YAZMAZ** - Tüm veritabanı işlemleri backend tarafından yapılır.
- **Güvenlik:** Ödeme tamamlanmadan (webhook gelmeden) veritabanına kayıt oluşturulmaz. Backend, webhook geldiğinde tüm işlemleri güvenli şekilde yönetir.

### 5.4 Veritabanı Şeması

Detaylı şema: [COMPLETE_DATABASE_SCHEMA.md](database/COMPLETE_DATABASE_SCHEMA.md)

**Ana Tablolar:**
- `userprofile` - Kullanıcı profilleri
- `devices` - Cihaz kayıtları
- `payments` - Ödeme işlemleri
- `escrow_accounts` - Escrow hesapları
- `cargo_shipments` - Kargo gönderileri
- `delivery_confirmations` - Teslimat onayları
- `notifications` - Bildirimler
- `audit_logs` - Denetim kayıtları

**İlişkiler:**
- One-to-Many: userprofile → devices
- One-to-One: payments → escrow_accounts
- One-to-Many: payments → cargo_shipments
- One-to-Many: cargo_shipments → delivery_confirmations

### 5.5 Kod Standartları ve Yönergeler

#### 5.5.1 TypeScript Standartları

- **Strict Mode:** Aktif
- **Type Definitions:** Tüm fonksiyonlar tip tanımlı
- **Interface vs Type:** Interface tercih edilir
- **Naming:** PascalCase (components), camelCase (functions)

#### 5.5.2 React Standartları

- **Functional Components:** Tüm componentler functional
- **Hooks:** useState, useEffect, useCallback, useMemo
- **Props:** Interface ile tanımlı
- **Error Boundaries:** Hata yakalama

#### 5.5.3 Styling Standartları

- **Tailwind CSS:** Utility-first
- **Responsive:** Mobile-first yaklaşım
- **Colors:** Brand colors (constants.ts)

#### 5.5.4 Naming Conventions

- **Files:** PascalCase (components), camelCase (utilities)
- **Variables:** camelCase
- **Constants:** UPPER_SNAKE_CASE
- **Types/Interfaces:** PascalCase

### 5.6 Dağıtım (Deployment) Süreci

#### 5.6.1 Geliştirme Ortamı

**Yerel Geliştirme:**
```bash
npm install
npm run dev
```

**Environment Variables:**
```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
VITE_ENCRYPTION_KEY=your-32-character-hex-key  # AES-256 encryption key (256-bit)
```

**Encryption Key Oluşturma:**
```bash
# Key oluşturma script'i ile
node scripts/generate-encryption-key.js

# Veya manuel
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**ÖNEMLİ - Encryption Key Backup Stratejisi:**

`VITE_ENCRYPTION_KEY` environment variable'ı kritik öneme sahiptir. Bu key olmadan şifrelenmiş veriler (TC Kimlik No, IBAN, adres bilgileri vb.) çözülemez ve kalıcı olarak kaybolur.

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

#### 5.6.2 Production Build

**Build Komutu:**
```bash
npm run build
```

**Build Output:**
- `dist/` klasörü
- Optimized assets
- Code splitting
- Minification

#### 5.6.3 Deployment Platformları

**Desteklenen Platformlar:**
- **Coolify** (Önerilen)
- **Vercel**
- **Railway**
- **Render**

**Deployment Adımları:**
1. Repository'yi bağla
2. Environment variables'ı ayarla
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Port: `3001`

#### 5.6.4 CI/CD (Gelecek)

- GitHub Actions
- Automated tests
- Automated deployment
- Rollback mechanism

### 5.7 Çeviri (Localization) Süreci

#### 5.7.1 Yeni Dil Ekleme

**Adımlar:**
1. `constants.ts` dosyasına yeni dil çevirilerini ekle
2. `AppContext.tsx` içinde `Language` tipini güncelle
3. Header bileşenindeki dil seçicisine yeni seçeneği ekle
4. Tüm çeviri anahtarlarının eksiksiz olduğundan emin ol

**Çeviri Dosyası Yapısı:**
```typescript
export const translations = {
  en: { ... },
  tr: { ... },
  fr: { ... },
  ja: { ... },
  es: { ... },
  newLang: { ... } // Yeni dil
};
```

#### 5.7.2 Çeviri Formatı

- **Key-Value:** `{ key: 'value' }`
- **Nested Objects:** Kategorilere göre organize
- **Replacements:** `{name}` placeholder'ları

#### 5.7.3 Çeviri Süreci Yönetimi

- Tüm çeviriler `constants.ts` içinde
- Çeviri anahtarları TypeScript ile tip güvenli
- Eksik çeviri tespiti (development mode)

---

## BÖLÜM 6: TEST DOKÜMANTASYONU

### 6.1 Test Planı

#### 6.1.1 Test Stratejisi

**Test Türleri:**
1. **Birim Testleri (Unit Tests)**
   - Utility fonksiyonları
   - Hesaplama fonksiyonları
   - Validation fonksiyonları

2. **Entegrasyon Testleri (Integration Tests)**
   - API endpoints
   - Database operations
   - External service integrations

3. **E2E Testleri (End-to-End Tests)**
   - Kullanıcı akışları
   - Ödeme süreçleri
   - Eşleşme süreçleri

4. **Kullanıcı Kabul Testleri (UAT)**
   - Beta test kullanıcıları
   - Gerçek senaryolar

#### 6.1.2 Test Ortamları

**Development:**
- Local environment
- Mock services
- Test database

**Staging:**
- Production-like environment
- Real services (test mode)
- Test data

**Production:**
- Monitoring
- Error tracking
- Performance metrics

### 6.2 Test Senaryoları

#### 6.2.1 Kullanıcı Kaydı

**Test Case 1.1: Başarılı Kayıt**
1. Email ve şifre gir
2. Ad ve soyad gir
3. Kullanım şartlarını kabul et
4. "Kayıt Ol" butonuna tıkla
5. **Beklenen:** Dashboard'a yönlendirme

**Test Case 1.2: Geçersiz Email**
1. Geçersiz email formatı gir
2. **Beklenen:** Hata mesajı

**Test Case 1.3: Zayıf Şifre**
1. 8 karakterden az şifre gir
2. **Beklenen:** Hata mesajı

#### 6.2.2 Cihaz Ekleme

**Test Case 2.1: Kayıp Cihaz Ekleme**
1. Dashboard → "Cihaz Ekle"
2. "Kaybettim" seç
3. Formu doldur
4. Fatura yükle
5. "Kaydet" butonuna tıkla
6. **Beklenen:** Cihaz kaydedildi, status: `LOST`

**Test Case 2.2: Bulunan Cihaz Bildirme**
1. Dashboard → "Bulunan Cihaz Bildir"
2. Formu doldur
3. Fotoğraf yükle
4. "Kaydet" butonuna tıkla
5. **Beklenen:** Cihaz kaydedildi, status: `REPORTED`

#### 6.2.3 Eşleşme

**Test Case 3.1: Başarılı Eşleşme**
1. Kayıp cihaz ekle (Model: iPhone 15, Seri: ABC123)
2. Bulunan cihaz ekle (Model: iPhone 15, Seri: ABC123)
3. **Beklenen:** Her iki cihazın status'u `MATCHED`, bildirim gönderildi

**Test Case 3.2: Eşleşmeyen Cihazlar**
1. Kayıp cihaz ekle (Model: iPhone 15, Seri: ABC123)
2. Bulunan cihaz ekle (Model: iPhone 14, Seri: ABC123)
3. **Beklenen:** Eşleşme yok, status'lar değişmez

#### 6.2.4 Ödeme Süreci

**Test Case 4.1: Başarılı Ödeme**
1. Eşleşmiş cihaz detay sayfasına git
2. "Ödemeyi Güvenle Yap" butonuna tıkla
3. Ücret detaylarını kontrol et
4. Stripe ile ödeme yap
5. 3D Secure doğrulama
6. **Beklenen:** Ödeme başarılı, status: `PAYMENT_COMPLETED`, escrow oluşturuldu

**Test Case 4.2: Başarısız Ödeme**
1. Geçersiz kart bilgileri gir
2. **Beklenen:** Hata mesajı, ödeme yapılmadı

#### 6.2.5 Kargo Süreci

**Test Case 5.1: Kargo Oluşturma**
1. Ödeme tamamlandıktan sonra
2. **Beklenen:** Kargo firması API'sine istek gönderildi, teslim kodu oluşturuldu

**Test Case 5.2: Kargo Takibi**
1. Takip numarası ile sorgula
2. **Beklenen:** Güncel durum bilgisi

#### 6.2.6 Güvenlik Testleri

**Test Case 6.1: RLS Kontrolü**
1. User A, User B'nin cihazını görmeye çalışır
2. **Beklenen:** Erişim reddedildi

**Test Case 6.2: Şifreleme Kontrolü**
1. Database'de hassas bilgileri kontrol et
2. **Beklenen:** Şifrelenmiş formatta (Base64 encoded, ~48 karakter)

**Test Case 6.3: Şifre Çözme Kontrolü**
1. Şifrelenmiş veriyi oku
2. `decryptUserProfile()` fonksiyonu ile çöz
3. **Beklenen:** Plain text formatında doğru veri

**Test Case 6.4: Backward Compatibility**
1. Eski plain text veriyi oku
2. **Beklenen:** Sorunsuz okunur, sonraki kayıtta şifrelenir

### 6.3 Performans Testleri

#### 6.3.1 Yük Testleri

- Eş zamanlı kullanıcı sayısı
- API yanıt süreleri
- Database query performansı

#### 6.3.2 Ölçümler

- Sayfa yükleme süresi: < 3 saniye
- API yanıt süresi: < 500ms
- Database query: < 100ms

---

## BÖLÜM 7: SÜRÜM NOTLARI

### 7.1 Versiyon 2.1 (2025-11-04)

#### Yeni Özellikler
- ✅ `device_role` kolonu eklendi (`devices` tablosuna)
- ✅ `financial_transactions` tablosuna escrow alanları eklendi (`escrow_id`, `confirmed_by`, `confirmation_type`)
- ✅ `transaction_type` CHECK constraint güncellendi (`escrow_release` değeri eklendi)
- ✅ STATUS_TEST_YOL_HARITASI.md dokümantasyonu eklendi
- ✅ **Hassas Veri Şifreleme Sistemi** implementasyonu tamamlandı
  - AES-256-GCM encryption algoritması
  - TC Kimlik No, IBAN, Telefon, Adres şifreleme
  - Encryption Manager (`utils/encryptionManager.ts`)
  - AppContext entegrasyonu
  - Backward compatibility (plain text → encrypted geçiş)

#### İyileştirmeler
- ✅ UI rendering mantığı iyileştirildi - `device_role` kolonu ile owner/finder ayrımı
- ✅ DeviceDetailPage.tsx güncellendi - her status için owner ve finder ekranları ayrı implement edildi
- ✅ AppContext.tsx güncellendi - `addDevice` fonksiyonu `device_role` set ediyor
- ✅ Ödeme tutarları formatlandı (`Intl.NumberFormat` ile Türk Lirası formatı)
- ✅ Database schema dokümantasyonu güncellendi
- ✅ **Güvenlik İyileştirmeleri:**
  - Hassas veriler için AES-256-GCM encryption implementasyonu
  - Database column type'ları TEXT'e çevrildi (encrypted data için)
  - Format constraint'leri kaldırıldı (encrypted data için uygun değil)
  - Encryption key management sistemi kuruldu
  - KVKK/GDPR uyumluluk sağlandı

#### Düzeltmeler
- ✅ PAYMENT_COMPLETED ekranı düzeltildi - cihaz sahibi için doğru ekran gösterilmesi
- ✅ CARGO_SHIPPED ekranı düzeltildi - Satın Alma Kanıtı ve formatlanmış tutarlar eklendi
- ✅ DELIVERED ekranı düzeltildi - Durum Bilgisi, Ödeme Detayları ve Escrow Durumu kartları eklendi
- ✅ ADIM 6 SQL sorguları düzeltildi ve sadeleştirildi
- ✅ Financial Transactions constraint hatası düzeltildi

### 7.2 Versiyon 2.0 (2025-01-15)

#### Yeni Özellikler
- ✅ Kargo firması API entegrasyonu
- ✅ Teslim kodu sistemi
- ✅ Otomatik escrow serbest bırakma (48 saat)
- ✅ Gelişmiş bildirim sistemi
- ✅ Admin paneli temel özellikler

#### İyileştirmeler
- ✅ Ücret hesaplama optimizasyonu
- ✅ Database schema güncellemeleri
- ✅ UI/UX iyileştirmeleri
- ✅ Performans optimizasyonları

#### Düzeltmeler
- ✅ Eşleşme algoritması bug fix
- ✅ Ödeme webhook handling
- ✅ Kargo durumu güncellemeleri

### 7.2 Versiyon 1.0 (2024-12-01)

#### İlk Sürüm
- ✅ Temel kayıt/giriş sistemi
- ✅ Cihaz ekleme/bildirme
- ✅ Otomatik eşleştirme
- ✅ Ödeme sistemi (Stripe)
- ✅ Escrow sistemi
- ✅ Çoklu dil desteği (5 dil)
- ✅ Web platformu

---

## EK: SÜREÇ AKIŞ DETAYLARI

### Süreç Akış Diyagramı

Detaylı süreç akışı: [PROCESS_FLOW.md](PROCESS_FLOW.md)

**Özet:**
1. Cihaz kaydı (LOST/REPORTED)
2. Otomatik eşleştirme (MATCHED)
3. Ödeme yapma (PAYMENT_COMPLETED)
4. Kargo oluşturma (CARGO_SHIPPED)
5. Teslim edilme (DELIVERED)
6. Onay (CONFIRMED)
7. İşlem tamamlama (COMPLETED)

---

## İLETİŞİM VE DESTEK

- **Email:** support@ifoundanapple.com
- **GitHub:** https://github.com/trgysvc/iFoundAnApple-Web
- **Website:** https://ifoundanapple.com

---

**Bu dokümantasyon sürekli güncellenmektedir. Son güncelleme: 2025-01-15**

