# iFoundAnApple - Tam Süreç Akışı

Bu dosya, platformun tüm süreç akışını detaylı olarak açıklar ve hangi bilginin hangi tabloya yazılacağını gösterir. Lütfen eksik veya yanlış kısımları düzeltin.

---

## TAM SÜREÇ ADIMLARI

1.  Cihaz kaybeden kayıt yapıyor. 
2.  Cihazı bulan kayıt yapıyor
3.  Cihaz eşleşiyor
4.  Cihazı kaybeden ödemesini yapıyor.
5.  Ödeme alınıp sistemnde bekletiliyor.
6.  Ödeme alındıktan sonra kargo firması teslim-takip numarası üretiliyor. 
7.  Cihazı bulan kargo firmasına teslim-takip numarası ile cihazı teslim ediyor. (kargo firmasının ekranında kimlik bilgileri gizli)
8.  Kargo firması cihazı sahibine teslim ediliyor
9.  Cihazın sahibi cihaz eline geçince onaylıyor
10. Sistemde bekletilen para para serbest bırakılarak ödeme altyapıcının işlem ücreti + kargo firması ücreti + bulan kişinin hediye Ücreti + iFoundAnApple servis ücreti ödeniyor. 
11. İşlem tamamlanıyor.
---

## 🔄 **DEVICE STATUS ENUM**

```typescript
export enum DeviceStatus {
  LOST = "lost",            // Cihaz sahibi kayıp bildirimi
  REPORTED = "reported",    // Bulan kişi buldu bildirimi  
  MATCHED = "matched",      // Cihaz eşleşiyor
  PAYMENT_PENDING = "payment_pending",   // Cihazı kaybeden ödemesini yapıyor
  PAYMENT_COMPLETED = "payment_completed", // Ödeme emanet sisteminde bekletiliyor
  CARGO_SHIPPED = "cargo_shipped",   // Cihazı bulan kargo firmasına kod ile teslim ediyor
  DELIVERED = "delivered",           // Kargo firması cihazı sahibine teslim ediyor
  CONFIRMED = "confirmed",           // Cihazın sahibi cihaz eline geçince onaylıyor
  EXCHANGE_PENDING = "exchange_pending", // Fiziksel takas sürecinde
  COMPLETED = "completed",           // İşlem tamamlanıyor
  DISPUTED = "disputed",	           // İptal-iade bölümü
   // --- Yeni Eklenen İstisnai Durumlar ---
  CANCELLED = "cancelled",       // İşlem, kargoya verilmeden taraflardan biri veya sistem tarafından iptal edildi
  RETURNED = "returned",         // Cihaz, alıcıya teslim edilemediği için göndericiye iade sürecinde/edildi
  FAILED_DELIVERY = "failed_delivery" // Kargo firması teslimatı denedi ancak başarısız oldu (adres yanlış, alıcı yok vb.)
}
```
## 📦 **KARGO STATUS ENUM**

```typescript
export type CargoStatus =
  | "created"           // Kargo kaydı oluşturuldu
  | "label_printed"     // Kargo etiketi yazdırıldı
  | "picked_up"         // Bulan kişi cihazı kargo firmasına teslim etti
  | "in_transit"        // Cihaz kargo firması ile yolda, sahibine doğru gidiyor
  | "out_for_delivery"  // Teslimata çıktı
  | "delivered"         // Kargo firması cihazı sahibinin adresine teslim etti, sahibinin onayı bekleniyor
  | "failed_delivery"   // Teslimat denendi, başarısız
  | "returned"          // Göndericiye iade ediliyor/edildi
  | "cancelled";        // Kargo işlemi iptal edildi
```

**Not:** `cargo_shipments` tablosunda iki farklı status sütunu bulunur:

1. **`status` sütunu:** Teslim kodunun durumunu takip eder (constraint gereği: 'active', 'used', 'expired')
   - "active" - Teslim kodu aktif, kullanıma hazır
   - "used" - Teslim kodu kullanıldı (kargo firmasına teslim edildi)
   - "expired" - Teslim kodu süresi doldu

2. **`cargo_status` sütunu:** Kargo sürecinin detaylı durumunu takip eder (CargoStatus enum ile uyumlu):
   - "pending" - Kargo kaydı oluşturuldu, teslim kodu üretildi, bulan kişinin kargoya teslim etmesi bekleniyor
- "picked_up" - Bulan kişi cihazı kargo firmasına teslim etti
- "in_transit" - Cihaz kargo firması ile yolda
   - "delivered" - Kargo firması cihazı sahibine teslim etti, sahibinin onayı bekleniyor
   - "confirmed" - Cihaz sahibi teslim aldığını onayladı (delivery_confirmed_by_receiver = true olduğunda)
- "failed_delivery" - Teslimat başarısız
- "returned" - Göndericiye iade edildi
- "cancelled" - İptal edildi

**BACKEND SORUMLULUĞU (Kargo Süreci):**
- Backend, kargo firması ile haberleşmeyi sağlar
- Frontend/iOS'tan gelen kargo gönderi talebini alır
- Kargo firması API'si ile haberleşir ve takip numarası (`tracking_number`), teslim kodu (`code`) ve süreç bilgilerini alır
- Kargo firmasından alınan bilgileri `cargo_shipments` tablosuna **yazar**
- Kargo durumu güncellemelerini yapar
- Frontend/iOS'a kargo bilgilerini döner

**FRONTEND/IOS SORUMLULUĞU (Kargo Süreci):**
- Backend'den gelen kargo bilgileri ile süreci işler
- Kullanıcı ekranlarını düzenleyerek kullanıcıyı bilgilendirir

**Teknik Detaylar:**
- `cargo_shipments` tablosunda `code` sütunu bulunur (teslim kodu) ve bu kod **kargo firmasının API'si tarafından üretilir**
- `tracking_number` (takip numarası) **kargo firmasının API'si tarafından üretilir** ve backend tarafından veritabanına yazılır
- `cargo_status` sütunu kargo sürecinin detaylı durumunu takip eder

**Önemli:** 
- **UI / Mobil Geliştirme Notu:** Cihaz sahibi (owner) ile cihazı bulan (finder) kullanıcı arayüzlerini ayırırken `status` alanına göre değil `devices.device_role` sütununa göre ayrımı yapın. Bir kullanıcı aynı anda her iki rolü de üstlenebileceği için, doğru ekran akışlarını seçmek için mutlaka `devices.device_role` sütununu (`'owner' | 'finder'`) temel alın. tüm süreç ekranlarında ve iOS gibi sonraki uygulamalarda da bu sütun, dinamik rol ayrımı için ana referans olmalıdır.


## 📊 VERİTABANI TABLOLARI VE SÜREÇ İLİŞKİSİ

Ana İşlem Tabloları:
devices - Cihaz kayıtları (LOST/FOUND, DeviceStatus durumunu içerir)
payments - Ödeme işlemleri
escrow_accounts - Escrow hesapları
financial_transactions - Mali işlemler
cargo_shipments  -  Kargo gönderi kayıtları. Bizim ürettiğimiz teslim kodunu, kargo firmasının takip numarasını, kargo şirketini ve CargoStatus ENUM'u ile kargonun detaylı durumunu içerir.
notifications - Bildirimler
userprofile - Kullanıcı profilleri
device_models - Cihaz modelleri ve fiyatlandırma
cargo_companies - Kargo şirketleri
audit_logs - Denetim kayıtları
invoice_logs - Fatura yükleme ve doğrulama logları

Süreç Tabloları :
delivery_confirmations - Teslimat onay sistemi
final_payment_distributions - Son ödeme dağıtım sistemi
payment_transfers - Ödeme transfer kayıtları

View/Summary Tabloları:
payment_summaries - Ödeme özetleri
user_escrow_history - Kullanıcı escrow geçmişi
user_transaction_history - Kullanıcı işlem geçmişi
financial_audit_trail - Mali denetim izi
security_audit_events - Güvenlik denetim olayları




## 🔴 CİHAZ SAHİBİ (DEVICE OWNER) - KAYIP CİHAZ SÜRECİ

### **Adım 1: Kayıt ve Giriş**
```
Kullanıcı → Ana Sayfa → "Kayıt Ol" ; Ad + Soyad + Email + Şifre + Hizmet ŞArtları ve Gizlilik Politikası Kabulü → Giriş
Kullanıcı → Ana Sayfa → "Kayıt Ol" ; Google ile Giriş Yap veya Apple ile Giriş Yap → Giriş
```
Kayıt Formu (RegisterPage.tsx)
Kullanıcı kayıt formunda şu bilgiler toplanır:
Email (zorunlu)
Şifre (zorunlu)
Ad (firstName) (zorunlu)
Soyad (lastName) (zorunlu)
Kullanım şartları onayı (zorunlu)

Kayıt İşlemi (AppContext.tsx - register fonksiyonu)
const register = async (userData, pass: string): Promise<boolean> => {
  // Supabase Auth'a kayıt
  const { data: signUpData, error } = await supabase.auth.signUp({
    email: userData.email,
    password: pass,
    options: {
      data: {
        first_name: userData.firstName,
        last_name: userData.lastName,
        full_name: userData.fullName,
      },
    },
  });
  
  // Profil tablosuna kayıt
  await createUserProfile(signUpData.user.id, {
    firstName: userData.firstName,
    lastName: userData.lastName,
  });
}
---
Veri Yazılan Tablolar
A. Supabase Auth Tablosu (auth.users)
id (UUID) - Otomatik oluşturulan kullanıcı ID'si
email - Kullanıcı email adresi
encrypted_password - Şifrelenmiş şifre
user_metadata (JSONB) - İsim bilgileri:
first_name
last_name
full_name
created_at - Kayıt tarihi
email_confirmed_at - Email onay tarihi
B. userprofile Tablosu
INSERT INTO userprofile (
  user_id,           -- auth.users.id'ye referans
  first_name,        -- Ad
  last_name,         -- Soyad
  created_at,        -- Oluşturulma tarihi
  updated_at         -- Güncellenme tarihi
)
---
Profil Bilgileri Yönetimi
1. Profil Sayfası (ProfilePage.tsx)
Kullanıcı profil sayfasında şu bilgiler yönetilir:
Kişisel Bilgiler:
Ad (firstName) - zorunlu
Soyad (lastName) - zorunlu
Email - değiştirilemez
Doğum tarihi (dateOfBirth) - opsiyonel
TC Kimlik No (tcKimlikNo) - opsiyonel
Telefon numarası (phoneNumber) - opsiyonel
Adres (address) - opsiyonel
Banka Bilgileri:
IBAN (iban) - opsiyonel (ödül ödemeleri için)
2. Profil Güncelleme Süreci (AppContext.tsx - updateUserProfile)
const updateUserProfile = async (profileData) => {
  // 1. Supabase Auth metadata güncelleme
  await supabase.auth.updateUser({
    data: {
      first_name: profileData.firstName,
      last_name: profileData.lastName,
      full_name: fullName,
    },
  });

  // 2. userprofile tablosu güncelleme/ekleme
  await supabase.from("userprofile").upsert({
    user_id: currentUser.id,
    first_name: profileData.firstName,
    last_name: profileData.lastName,
    date_of_birth: profileData.dateOfBirth,
    tc_kimlik_no: profileData.tcKimlikNo,
    phone_number: profileData.phoneNumber,
    address: profileData.address,
    iban: profileData.iban,
    bank_info: profileData.iban, // Geriye uyumluluk için
    updated_at: new Date().toISOString(),
  });
}
---
3. Güncellenen Tablolar
A. Supabase Auth Tablosu (auth.users)
user_metadata güncellenir:
first_name
last_name
full_name
B. userprofile Tablosu
UPDATE userprofile SET
  first_name = ?,
  last_name = ?,
  date_of_birth = ?,
  tc_kimlik_no = ?,
  phone_number = ?,
  address = ?,
  iban = ?,
  bank_info = ?,  -- IBAN ile aynı değer
  updated_at = NOW()
WHERE user_id = ?
---


**Detaylar:**
Ad/Soyad: Zorunlu, text sanitization
Eposta: Zorunlu, e-mail formatı
Doğum tarihi: Geçerli tarih, gelecek tarih kontrolü, minimum 13 yaş (COPPA uyumu), Boş ise ödemeyi güvenle yap butonu pasif
TC Kimlik: 11 haneli, algoritma doğrulaması, Boş ise ödemeyi güvenle yap butonu pasif. veritabanında şifrelenerek (encryption at rest) sakla
Telefon: Zorunlu, Türk telefon numarası formatı
IBAN: TR ile başlayan 26 haneli format, Mod 97 checksum kontrolü, IBAN validation key ile gerçek zamanlı doğrulama yapılabilir (opsiyonel). Boş ise ödemeyi güvenle yap butonu pasif (Bu kural sadece Cihazı Bulan (Finder) kullanıcılar için geçerli olmalıdır. Cihaz Sahibi'nden IBAN istenmemeli veya zorunlu tutulmamalıdır.)
Adres: Boş ise ödemeyi güvenle yap butonu pasif. veritabanında şifrelenerek (encryption at rest) sakla

**ÖNEMLİ - Encryption Key Backup:**
Encryption key (`VITE_ENCRYPTION_KEY`) **manuel olarak** yedeklenmelidir. Key kaybı durumunda şifrelenmiş tüm veriler (TC Kimlik No, IBAN, adres bilgileri) kalıcı olarak kaybolur. Detaylı backup stratejisi için `BACKEND_INTEGRATION.md` ve `PROJECT_DESIGN_DOCUMENTATION.md` dosyalarına bakın.

---

### **Adım 2: Kayıp Cihaz Ekleme**
```
Dashboard → "Cihaz Ekle" → "Kaybettim" Seçeneği
```

**Girilen Bilgiler:**
- Seri Numarası: Manuel giriş (12 haneli)
- Cihaz Modeli: Dropdown'dan seçim (iPhone 15 Pro Max, vb.)
- Renk: Dropdown'dan seçim 
- Satın Alma Kanıtı (Fatura) : Dosya Ekleme (isteğe bağlı)
- Kayıp Tarihi: Tarih seçici
- Kayıp Yeri: Serbest metin
- Ek detaylar (isteğe bağlı): Opsiyonel


**Database Kayıtları:**

**1. `devices` tablosuna kayıt:**
```sql
INSERT INTO devices (
  id,                    -- gen_random_uuid()
  "userId",             -- Cihaz sahibinin ID'si (auth.users.id)
  model,                -- Cihaz modeli (text)
  "serialNumber",       -- Seri numarası (text)
  status,               -- 'lost' (text)
  color,                -- Cihaz rengi (text, nullable)
  description,          -- Açıklama (text, nullable)
  "rewardAmount",       -- Ödül miktarı (numeric, nullable)
  "invoice_url",        -- Fatura URL'si (text, nullable) - Kayıp cihaz için fatura, bulunan cihaz için fotoğraf URL'leri (virgülle ayrılmış)
  "exchangeConfirmedBy", -- Onaylayanlar array (uuid[], default '{}')
  created_at,           -- now()
  updated_at,           -- now()
  lost_date,            -- Kayıp tarihi (date, nullable)
  lost_location,        -- Kayıp yeri (text, nullable)
  device_role           -- 'owner' (cihaz sahibi)
);
```

**2. `audit_logs` tablosuna kayıt:**
```sql
INSERT INTO audit_logs (
  id,                    -- gen_random_uuid()
  event_type,           -- 'device_registration'
  event_category,       -- 'device'
  event_action,         -- 'create'
  event_severity,       -- 'info'
  user_id,              -- Cihaz sahibinin ID'si
  resource_type,        -- 'device'
  resource_id,          -- Oluşturulan device ID'si
  event_description,    -- 'Lost device registered'
  event_data,           -- JSON: {model, serialNumber, lost_date, lost_location, found_date, found_location, invoice_url}
  created_at            -- now()
);
```

**3. `notifications` tablosuna kayıt:**
```sql
INSERT INTO notifications (
  id,                    -- gen_random_uuid()
  user_id,              -- Cihaz sahibinin ID'si
  message_key,          -- 'device_registered_successfully'
  type,                 -- 'info'
  is_read,              -- false
  created_at            -- now()
);
```

### **Adım 3: Eşleşme Bekleme**
```
Status: LOST → Sistem otomatik eşleştirme yapıyor
```

**Dashboard'da Görünen:**
- Cihaz kartı: "Eşleşme Bekleniyor"
- Durum rengi: Turuncu/Sarı
- Bildirim: Var mı? VAR

**DeviceDetailPage (Cihaz Detay Sayfası):**
```
Dashboard → Cihaz Kartına Tıkla → DeviceDetailPage açılır
```
DeviceDetailPage içeriği

-Başlık:
✅
Cihazınızın Kaydı Başarıyla Tamamlandı!
Kayıp cihazınız sisteme kaydedildi. Eşleşme bulunduğunda size bildirim gönderilecektir.
-"Kayıp Cihaz Detayları" Kartı
Kayıp Tarihi:
Kayıp Yeri:
Cihaz Modeli:
Cihaz Seri Numarası:
Cihaz Rengi:
Ek Detaylar:
Satın Alma Kanıtı (Fatura) Dosyası:
-"İşlem Durumu" Kartı
Durum:  Kayıtlı XXX seri numaralı YYY cihazı eşleşme bekleniyor.
-"Durum Bilgisi" Kartı (1 numarası seçenek aktif turuncu renk. diğerleri pasif durumda.)
1 Cihaz için eşleşme bekleniyor
2 Cihazınız bulundu
    Ödemenizi yapmak ve takas sürecini tamamlamak için "Ödemeyi güvenle yap Butonu"
3 Cihazınızın kargo ile teslim edilmesi bekleniyor
    Teslim/Takip için kargo numaranız: XXX
4 Cihaz Teslim Alındığında
    Cihazın seri numarasını kontrol edip teslim aldığınızı onaylayın "Onay Butonu"
5 İşlem Tamamlandı
    Cihazınıza kavuştuğunuz için mutluyuz.
---

**Eşleştirme Mantığı:**
- Model ve Seri Numarasına göre eşleştirme yapılır. 
- Sahte seri numaralı cihazlar için inceleme yapılacak farklı bir strateji ile daha sonra şekillenecek. 
---

### **Adım 4: Eşleşme Bulundu**
```
Sistem → Eşleşme buldu → Status: MATCHED → Supabase veritabanı kontrolü → Owner için status: PAYMENT_PENDING
```

**Eşleşme Kontrol Süreci:**
1. Supabase veritabanı, iki tarafın (owner ve finder) eşleştiğini kontrol eder
2. Eşleşme bulunduğunda, owner'ın device kaydının `status` değeri `'payment_pending'` olarak güncellenir
3. Finder'ın device kaydının `status` değeri `'matched'` olarak kalır (ödeme bekleniyor)
4. Owner ekranı `payment_pending` durumunu görünce ödeme yapma adımına geçer

**Database Değişiklikleri:**

**1. `devices` tablosunda güncelleme (Owner için):**
```sql
UPDATE devices 
SET 
  status = 'payment_pending',  -- Owner için ödeme bekleniyor durumu
  updated_at = now()
WHERE id = [owner_device_id] AND device_role = 'owner';
```

**2. `devices` tablosunda güncelleme (Finder için):**
```sql
UPDATE devices 
SET 
  status = 'matched',  -- Finder için eşleşme bulundu durumu
  updated_at = now()
WHERE id = [finder_device_id] AND device_role = 'finder';
```

**2. `audit_logs` tablosuna kayıt:**
```sql
INSERT INTO audit_logs (
  id,                    -- gen_random_uuid()
  event_type,           -- 'device_matching'
  event_category,       -- 'device'
  event_action,         -- 'match'
  event_severity,       -- 'info'
  user_id,              -- Cihaz sahibinin ID'si
  resource_type,        -- 'device'
  resource_id,          -- Device ID'si
  event_description,    -- 'Device matched with finder'
  event_data,           -- JSON: {matched_at, finder_user_id}
  created_at            -- now()
);
```

**3. `notifications` tablosuna kayıtlar:**
```sql
-- Cihaz sahibine bildirim
INSERT INTO notifications (
  id,                    -- gen_random_uuid()
  user_id,              -- Cihaz sahibinin ID'si
  message_key,          -- 'matchFoundOwner'
  link,                 -- '/device/[device_id]'
  is_read,              -- false
  created_at,           -- now()
  replacements          -- JSON: {model: device_model}
);

-- Bulan kişiye bildirim
INSERT INTO notifications (
  id,                    -- gen_random_uuid()
  user_id,              -- Bulan kişinin ID'si
  message_key,          -- 'matchFoundFinder'
  link,                 -- '/device/[device_id]'
  is_read,              -- false
  created_at,           -- now()
  replacements          -- JSON: {model: device_model}
);
```

**Bildirimler:**
- In-app notification 
- e-posta : (Supabase Edge Functions kullanarak Resend veya SendGrid gibi popüler e-posta servisleriyle çok kolay bir entegrasyon kurabilirsiniz)

**Dashboard'da Görünen:**
- Cihaz kartı mesajı: Eşleşti! Ödeme yapmanız gerekiyor.
- Durum rengi: Turuncu/Sarı
- Buton: "Ödemeyi Güvenle Yap"

**Önemli:** Supabase veritabanı, eşleşme bulunduğunda owner'ın device kaydının `status` değerini `'payment_pending'` olarak günceller. Owner ekranı bu durumu görünce ödeme yapma adımına geçer.

**DeviceDetailPage (Cihaz Detay Sayfası):**
```
Dashboard → Cihaz Kartına Tıkla → DeviceDetailPage açılır
```
DeviceDetailPage içeriği

-Başlık:
✅
Eşleşme Bulundu!
Eşleşme Bulundu!, Ödeme Bekleniyor
-"Kayıp Cihaz Detayları" Kartı
Kayıp Tarihi:
Kayıp Yeri:
Cihaz Modeli:
Cihaz Seri Numarası:
Cihaz Rengi:
Ek Detaylar:
Satın Alma Kanıtı (Fatura) Dosyası:
-"İşlem Durumu" Kartı
Durum:  Kayıtlı XXX seri numaralı YYY cihazı için eşleşme bulundu. Ödeme Bekleniyor.
-"Durum Bilgisi" Kartı (2 numarası seçenek aktif turuncu renk. diğerleri pasif durumda.)
1 Cihaz için eşleşme bekleniyor
2 Cihazınız bulundu
    Ödemenizi yapmak ve takas sürecini tamamlamak için "Ödemeyi güvenle yap Butonu"
3 Cihazınızın kargo ile teslim edilmesi bekleniyor
    Teslim/Takip için kargo numaranız: XXX
4 Cihaz Teslim Alındığında
    Cihazın seri numarasını kontrol edip teslim aldığınızı onaylayın "Onay Butonu"
5 İşlem Tamamlandı
    Cihazınıza kavuştuğunuz için mutluyuz.
---


  
  ---

### **Adım 5: Ödeme Yapma**
```
Dashboard → Cihaz Detay → "Ödeme Yap" → Ödeme Sayfası
```
**İşlem Mantığı:**
  - Buton: "Ödemeyi Güvenle Yap" - Bu butona tıklayınca match-payment sayfasına gidiyor
---

#### **Sayfa Yapısı: İki Adımlı Ödeme Süreci**

---

### **📍 ADIM 1: Ücret Detayları (match-paymentPage - Detay Ekranı)**

**Sayfa Başlığı:** 
```
Eşleşme Ödemesi
Güvenli ödeme garantisi
```

**Sol Panel - Ücret Döküm Kartı:**

**"Ücret Detayları" Kartı (Mavi-Mor Gradient Arka Plan)**
```
Ücret Detayları
iPhone 17 Pro Max
```

**Detaylı Fiyatlandırma Listesi:**
```
✓ Bulan Kişiye Ödül
  Cihazı bulan kişiye ödenecek    ₺XXX

✓ Kargo Ücreti
  Hızlı karşılaştırma             ₺YYY

✓ Hizmet bedeli
  Platform hizmet bedeli          ₺ZZZ

✓ Ödeme komisyonu
  Güvenli ödeme işlem ücreti      ₺KKK
  
─────────────────────────────────
Toplam Ödenecek
(Güvenli emanet ile tutulan)     ₺TTT
```

**Alt Bilgilendirme Kartları:**

 **"Güvenli Emanet (Escrow) Sistemi" Kartı (Mavi)**
```
   Ödemeniz güvenli escrow hesabımızda tutulur ve 
   cihaz teslim edilip onaylanana kadar karşı tarafa aktarılmaz. 
   Ödeme altyapısı güvencesiyle iptal ve iade hakkınız saklıdır.
```

**Sağ Panel - Kayıp Cihaz Detayları:**
```
Kayıp Cihaz Detayları

Kaybeden Zaman:      Belirtilmemiş
Kayıp Lokasyon:      Belirtilmemiş
Cihaz Modeli:        iPhone 17 Pro Max
Cihaz Seri:          Gizli bilgi
Cihaz Rengi:         Belirtilmemiş
Ek Detaylar:         Belirtilmemiş

[Ödemeye Geç →]  (Mavi Buton, tüm genişlik)
```

**Alt Bilgilendirme Paneli - Güvenlik Garantileri:**
```
✓   iFoundAnApple'da ödeme sürecin tamamen 
      güvenliğinizi düşünerek tasarlandı.

🔒 Güvenli Emanet (Escrow) Sistemi:
    Ödemeniz, doğrudan cihaz sahibine veya bulan kişiye iletilmez. 
    Takas süreci tamamlanana kadar güvenli 
    emanet (escrow) hesabımızda tutulur. Cihazınız size 
    ulaşmadan ve takas işlemini onaylamadan hiçbir ödeme 
    karşı tarafa aktarılmaz.

✓  Ödeme Altyapısı Güvencesiyle:
    Tüm finansal işlemleriniz Türkiye'nin önde gelen güvenli 
    ödeme sistemlerinden PAYNET güvencesi altındadır. Kart 
    bilgileriniz ve ödeme detaylarınız PAYNET'in yüksek 
    güvenlik standartları ile korunmaktadır.

⚖️ İptal Hakkınız Saklıdır:
    Takas süreci başlamadan veya cihaz size ulaşmadan önce 
    herhangi bir nedenle işlemden vazgeçmeniz durumunda, 
    ödemeyi iptal etme hakkınız bulunmaktadır.

↩️ Şeffaf İade Politikası:
    İşlem iptali talep etmeniz halinde, 
    ödediğiniz tüm ücret anında tarafınıza iade edilecektir.
```

**Yasal Uyarı (Footer):**
```
    iFoundAnApple olarak amacımız, kayıp eşyaların güvenli, 
    şeffaf ve sorunsuz bir şekilde sahipleriyle buluşmasını 
    sağlamaktır. Ödemenizi güvenle tamamlayabilirsiniz.
```

---

### **📍 ADIM 2: Ödeme Yöntemi (match-paymentPage - Ödeme Ekranı)**

**Sayfa Başlığı:**
```
Eşleşme Ödemesi
Güvenli ödeme seçenekleri
[← Geri Dön]
```

**Sol Panel - Ödeme Yöntemleri:**

**"Ödeme Yöntemi" Kartı (Yeşil-Mavi Gradient)**
```
Ödeme Yöntemi
Güvenli ödeme seçenekleri
```

**Ödeme Seçenekleri:**

1. **PAYNET (Kredi Kartı)**
```
   ○ PAYNET
     Tüm kartlarınızla güvenle ödeme
     🔒 SSL Güvenli Ödeme
     ✅ 3D Secure Doğrulama
```

**Önemli Not:**
- Kart bilgileri PAYNET ödeme sürecinde girilir
- Kart bilgileri sistemde veya veritabanında **ASLA TUTULMAZ**
- Tüm kart bilgileri doğrudan PAYNET API'sine gönderilir

**Güvenlik Rozetleri:**
```
✓ Güvenilir Ödeme      ✓ PCI DSS Uyumluluğu
✓ 256-bit SSL Şifreleme  ✓ Hızlı İşlem Onaylama
✓ Kişisel Güvenliğiniz
```

---

**Sağ Panel - Ödeme Özeti:**
```
Ödeme Özeti

Device Model:        
Bulan Kişiye ödül:          
Kargo:               
Hizmet Bedeli:       
Ödeme Komisyonu:      
TOPLAM:              

─────────────────────────────────

Ödeme Onayı

☐ Kullanım Koşulları ve Gizlilik Politikası'nı okudum ve kabul 
  ediyorum. Ödememin güvenli escrow sisteminde tutulacağını ve 
  cihaz tarafıma teslim edildikten sonra alınacağını anlıyorum.

[Ücret Detaylarına Dön]  (Gri Buton)

[🔒 Güvenli Ödeme Yap (449,09 TL)]  (Mavi Buton)
```

**Alt Bilgilendirme:**
```
🔒 Bu ödeme SSL ile korunmaktadır. 
Kart bilgileriniz güvenli şekilde şifrelenir ve saklanmaz.
```

---

### **Ödeme Akışı Sonrası:**

**Başarılı Ödeme:**
1. PAYNET → 3D Secure doğrulama
2. Ödeme onaylandı (webhook: `is_succeed: true`)
3. Backend: Webhook'u alır, doğrular ve işler
4. Backend: Tüm veritabanı kayıtlarını oluşturur (payments, escrow_accounts, devices, audit_logs, notifications)
5. Backend: Payment kaydını günceller (`status = 'completed'`)
6. Frontend/iOS: Backend'den ödeme sonucunu alır (polling ile)
7. Yönlendirme → **DeviceDetailPage** (status: `payment_completed`)

**Başarısız Ödeme:**
1. PAYNET → 3D Secure doğrulama
2. Ödeme başarısız (webhook: `is_succeed: false` veya 3D Secure başarısız)
3. Backend: Payment kaydını günceller (`status = 'failed'`)
4. Backend: Webhook payload'ını veritabanında saklar (hata analizi için)
5. Frontend/iOS: Hata mesajını gösterir
6. Yönlendirme → **Ödeme Sayfası** (tekrar deneme için)

**Başarısız Ödeme Senaryoları:**
- **3D Secure Başarısız:** Kullanıcı SMS kodunu yanlış girer veya işlemi iptal eder
- **Yetersiz Bakiye:** Kartta yeterli bakiye yok
- **Kart Reddedildi:** Banka tarafından işlem reddedildi
- **Zaman Aşımı:** 3D Secure işlemi zaman aşımına uğradı
- **Teknik Hata:** PAYNET API hatası veya ağ sorunu

**Başarısız Ödeme İşlemleri:**
```sql
-- Backend, başarısız ödeme durumunda payment kaydını günceller:
UPDATE payments 
SET 
  payment_status = 'failed',
  failed_reason = [webhook_error_message],
  failed_at = now(),
  updated_at = now()
WHERE id = [payment_id];
```

**Kullanıcı Deneyimi (Başarısız Ödeme):**
- Hata mesajı gösterilir: "Ödeme başarısız oldu. Lütfen tekrar deneyin."
- "Tekrar Dene" butonu ile ödeme sayfasına geri dönülür
- Kullanıcı kart bilgilerini tekrar girebilir

**Database Kayıtları (Ödeme Tamamlandıktan Sonra):**

Mevcut database kayıtları aynen devam eder (payments, escrow_accounts, devices, financial_transactions, audit_logs, notifications, cargo_shipments tabloları).

---

### **Kullanıcı Deneyimi Akışı:**
```
Cihaz Detay Sayfası (MATCHED durumu)
      ↓
"Ödemeyi Güvenle Yap" Butonu
      ↓
ADIM 1: Ücret Detayları Ekranı
  - Fiyat döküm
  - Güvenlik garantileri
  - "Ödemeye Geç" butonu
      ↓
ADIM 2: Ödeme Yöntemi Ekranı
  - Stripe/Kart seçimi
  - Onay checkbox
  - "Güvenli Ödeme Yap" butonu
      ↓
3D Secure Doğrulama (PAYNET)
      ↓
Ödeme Başarılı
      ↓
Yönlendirme → DeviceDetailPage
  - Status: payment_completed
  - "Kargo Bekleniyor" mesajı
---


**Ödeme Detayları:**
```
Toplam Tutar: 2,000.00 TL (ifoundanapple_fee)
├── Gateway Komisyonu: 68.60 TL (%3.43)
├── Kargo Ücreti: 250.00 TL (sabit)
├── Bulan Kişi Ödülü: 400.00 TL (%20)
└── Hizmet Bedeli: 1,281.40 TL (geriye kalan)
─────────────────────────────────────────
TOPLAM: 2,000.00 TL
```

**Ücret Yapısı:**
- **Ücretler Frontend/iOS tarafından hesaplanır** ve `feeBreakdown` olarak backend'e gönderilir
- Gateway komisyonu: %3.43 (toplam üzerinden)
- Kargo ücreti: 250.00 TL (sabit)
- Bulan kişi ödülü: %20 (toplam üzerinden)
- Hizmet bedeli: Geriye kalan tutar
- Backend, frontend/iOS'tan gelen `feeBreakdown`'ı doğrular ancak hesaplamaz
---

**Ödeme Akışı:**
1. Ödeme yöntemi seçimi (PAYNET - Kredi Kartı)
2. Frontend/iOS: Ücretleri hesaplar (`feeBreakdown`) ve Backend API'ye `POST /v1/payments/process` isteği gönderir (feeBreakdown ile)
3. Backend: Payment ID oluşturur ve veritabanına yazar (`payments` tablosuna `status = 'pending'` ile)
4. Backend: Kullanıcıdan kart bilgilerini alır (PAN, ay, yıl, CVC, kart sahibi adı)
5. Backend: Paynet API'ye ödeme başlatma isteği gönderilir (`POST /v2/transaction/tds_initial`) - kart bilgileri ve escrow parametresi ile
6. Backend: Paynet'ten dönen `post_url` ve `html_content` frontend'e döner
7. Frontend/iOS: `deviceId` ve `feeBreakdown`'ı localStorage/UserDefaults'a kaydeder
8. Frontend/iOS: PAYNET'in döndüğü `post_url` veya `html_content` ile 3D Secure doğrulama ekranına yönlendirilir
9. Kullanıcı: 3D Secure doğrulama işlemini tamamlar (SMS kodu girer)
10. Bank: `return_url`'e `session_id` ve `token_id` POST eder
11. Frontend/iOS: `POST /v1/payments/complete-3d` ile 3D Secure sonucu (`session_id`, `token_id`) backend'e iletilir
12. Backend: Paynet API'ye 3D Secure sonucu gönderilir (`POST /v2/transaction/tds_charge`)
13. Backend: Paynet webhook'u beklenir
14. PAYNET → Backend: Webhook (ödeme başarılı/başarısız)
15. Backend: Webhook'u doğrular (IP whitelist, signature) ve **veritabanına saklar** (`webhook_storage` veya benzeri tablo)
16. Backend: Webhook'tan gelen `reference_no` ile payment ID'yi eşleştirir ve payment kaydını günceller
17. Backend: Webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true) **tüm veritabanı kayıtlarını oluşturur:**
    - `payments` tablosunda mevcut kaydı günceller (status, provider bilgileri, fee breakdown vb.)
    - `escrow_accounts` tablosuna kayıt oluşturur
    - `devices` tablosunda status'u `payment_completed` yapar
    - `audit_logs` tablosuna kayıt oluşturur
    - `notifications` tablosuna bildirim kayıtları oluşturur
18. Frontend/iOS: Polling yapar (`GET /v1/payments/{paymentId}/status`) - webhook işlenene kadar (30 deneme, 10 saniye aralık)
19. Frontend/iOS: `paymentStatus: 'completed'` olduğunda ödeme başarılı sayfasına yönlendirilir

**ÖNEMLİ NOT:**
- **Backend, ödeme başlatıldığında payment ID oluşturur ve veritabanına yazar** (`payments` tablosuna `status = 'pending'` ile)
- Backend, webhook geldiğinde `reference_no` ile payment ID'yi eşleştirir ve **tüm veritabanı kayıtlarını oluşturur**
- Backend, webhook payload'ını **veritabanında saklar** (ileride referans için)
- **Backend, webhook geldiğinde tüm ilgili tablolara (payments, escrow_accounts, devices, audit_logs) yazar**
- Bu yaklaşım, güvenli ve merkezi ödeme yönetimi sağlar

**Backend Sorumluluğu (Ödeme Süreci):**
- Backend, Paynet ile ödeme haberleşmesini üstlenir
- Frontend/iOS'tan gelen ödeme talebini alır
- **Payment ID oluşturur ve veritabanına yazar** (`payments` tablosuna `status = 'pending'` ile)
- Kullanıcıdan kart bilgilerini alır (PAN, ay, yıl, CVC, kart sahibi adı)
- Paynet API ile haberleşerek başarılı/başarısız ödeme sürecini yönetir
- Webhook'u alır, doğrular ve **veritabanında saklar**
- Webhook geldiğinde `reference_no` ile payment ID'yi eşleştirir
- **Webhook başarılı olduğunda (is_succeed: true) backend tüm veritabanı kayıtlarını oluşturur:**
  - `payments` tablosunu günceller (status, provider bilgileri, fee breakdown vb.)
  - `escrow_accounts` tablosuna kayıt oluşturur
  - `devices` tablosunda status'u `payment_completed` yapar
  - `audit_logs` tablosuna kayıt oluşturur
  - `notifications` tablosuna bildirim kayıtları oluşturur
- Payment status kontrolü için endpoint sağlar (`GET /v1/payments/{paymentId}/status`)
- Ödeme sonucunu frontend/iOS'a bildirir

**Frontend/iOS Sorumluluğu (Ödeme Süreci):**
- Ödeme başlatma isteğini backend'e gönderir (deviceId, totalAmount, feeBreakdown ile)
- 3D Secure sonucunu backend'e iletir (session_id, token_id)
- Backend'den ödeme sonucunu alır (polling veya webhook notification ile)
- **SADECE** kullanıcı ekranlarını düzenleyerek kullanıcıyı bilgilendirir
- **Frontend/iOS veritabanına YAZMAZ** - Tüm veritabanı işlemleri backend tarafından yapılır

### **Adım 6: Ödeme Tamamlandı - Kargo Kodu Oluşturma ve Kargo Bekleme**
```
Status: payment_completed → Kargo firması API'sine gönderi bilgileri gönderilir → Cargo kodu alınır → Bulan kişi cihazı kargolayacak
```

**Dashboard'da Görünen:**
- Cihaz kartı mesajı: Ödeme alındı! Kargo bekleniyor.
- Durum rengi: Mavi


**DeviceDetailPage (Cihaz Detay Sayfası):**
```

Dashboard → Cihaz Kartına Tıkla → DeviceDetailPage açılır
```
DeviceDetailPage içeriği

-Başlık:
✅
Ödemeniz Başarıyla Tamamlandı!
Cihazınızın kargo firmasına teslim edilmesi bekleniliyor.
-"Kayıp Cihaz Detayları" Kartı
Kayıp Tarihi:
Kayıp Yeri:
Cihaz Modeli:
Cihaz Seri Numarası:
Cihaz Rengi:
Ek Detaylar:
Satın Alma Kanıtı (Fatura) Dosyası:
-"İşlem Durumu" Kartı
Durum:  Kayıtlı XXX seri numaralı YYY cihaz ödemesi alındı. Kargo firmasına teslimi bekleniliyor. 
-"Ödeme Detayları" Kartı
Ödeme ID:
Toplam Tutar:
Ödeme Durumu: Tamamlandı
Ödeme Sağlayıcı:
Ödeme Tarihi:
-"Escrow Durumu" Kartı
Escrow ID:
Durum: Beklemede
Escrow Tutarı:
-"Durum Bilgisi" Kartı (3 numaralı seçenek aktif turuncu renk. diğerleri pasif durumda.)
1 Cihaz için eşleşme bekleniyor
2 Cihazınız bulundu
    Ödemenizi yapmak ve takas sürecini tamamlamak için "Ödemeyi güvenle yap Butonu"
3 Cihazınızın kargo ile teslim edilmesi bekleniyor
    Kargoya verildiğinde takip numaranız burada görünecektir.
4 Cihaz Teslim Alındığında
    Cihazın seri numarasını kontrol edip teslim aldığınızı onaylayın "Onay Butonu"
5 İşlem Tamamlandı
    Cihazınıza kavuştuğunuz için mutluyuz.
---

**Bildirimler:**
- In-app: 
---
**Database Güncellemeleri (Backend Tarafından Yapılır):**

**ÖNEMLİ:** Tüm veritabanı kayıtları **webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true)** backend tarafından oluşturulur. Bu, güncel mimari standartlarına ve güvenliğe uygun olan yöntemdir.

**Webhook İşleme Süreci:**
1. Backend Paynet'ten webhook alır (`POST /v1/webhooks/paynet-callback`)
2. Backend webhook'u doğrular (IP whitelist, signature)
3. Backend webhook payload'ını **veritabanında saklar** (`webhook_storage` veya benzeri tablo)
4. Backend webhook'tan gelen `reference_no` ile payment ID'yi eşleştirir
5. Backend, webhook'tan gelen `is_succeed` değerini kontrol eder
6. **Eğer ödeme başarılı (is_succeed: true) ise, backend tüm veritabanı kayıtlarını oluşturur:**
   - `payments` tablosunda mevcut kaydı günceller (status, provider bilgileri, fee breakdown vb.)
   - `escrow_accounts` tablosuna kayıt oluşturur
   - `devices` tablosunda status'u `payment_completed` yapar
   - `audit_logs` tablosuna kayıt oluşturur
   - `notifications` tablosuna bildirim kayıtları oluşturur
7. Frontend/iOS polling yaparak ödeme durumunu kontrol eder (`GET /v1/payments/{paymentId}/status`) - 30 deneme, 10 saniye aralık
8. Frontend/iOS: `paymentStatus: 'completed'` olduğunda ödeme başarılı sayfasına yönlendirilir

**1. `payments` tablosuna kayıt oluşturma (Backend tarafından - Ödeme başlatıldığında):**
```sql
-- Backend, ödeme başlatıldığında payment ID oluşturur ve veritabanına yazar:
INSERT INTO payments (
  id,                    -- Backend tarafından generate edilen payment ID (UUID)
  device_id,             -- Device ID'si
  payer_id,              -- Cihaz sahibinin ID'si (ödemeyi yapan)
  total_amount,          -- Frontend/iOS'tan gelen totalAmount
  payment_provider,      -- 'paynet'
  payment_status,        -- 'pending' (ödeme başlatıldı, webhook bekleniyor)
  escrow_status,         -- 'pending'
  currency,              -- 'TRY'
  created_at,            -- now()
  updated_at             -- now()
);
```

**2. `payments` tablosunda güncelleme (Backend tarafından - Webhook geldiğinde):**
```sql
-- Backend, webhook geldiğinde reference_no ile payment ID'yi eşleştirir ve günceller:
UPDATE payments 
SET 
  receiver_id = [bulan_kişi_user_id],  -- Matched device'ın user_id'si
  total_amount = [webhook_amount],      -- Webhook'tan gelen amount
  payment_gateway_fee = [webhook_comission],  -- Webhook'tan gelen comission
  payment_status = 'completed',        -- Webhook'tan gelen is_succeed=true ise
  escrow_status = 'held',               -- Escrow ile ödeme yapıldığı için
  provider_payment_id = [webhook_order_id],   -- Webhook'tan gelen order_id
  provider_transaction_id = [webhook_reference_no],  -- Webhook'tan gelen reference_no
  authorization_code = [webhook_authorization_code],  -- Webhook'tan gelen authorization_code
  completed_at = [webhook_xact_date],   -- Webhook'tan gelen xact_date
  updated_at = now()
WHERE id = [payment_id] AND provider_transaction_id IS NULL;
```

**3. `payments` tablosunda güncelleme (Backend tarafından - Webhook geldiğinde, ödeme başarılı olduğunda):**
```sql
-- Backend, webhook geldiğinde ve ödeme başarılı olduğunda fee breakdown bilgilerini ekler:
UPDATE payments 
SET 
  reward_amount = [fee_breakdown_reward_amount],  -- Frontend/iOS'tan gelen feeBreakdown'dan
  cargo_fee = [fee_breakdown_cargo_fee],
  service_fee = [fee_breakdown_service_fee],
  net_payout = [fee_breakdown_net_payout],
  updated_at = now()
WHERE id = [payment_id];
```

**2. `escrow_accounts` tablosuna kayıt oluşturma (Backend tarafından - Webhook geldiğinde, ödeme başarılı olduğunda):**
```sql
-- Backend, webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true) escrow kaydını oluşturur:
INSERT INTO escrow_accounts (
  id,                    -- gen_random_uuid()
  payment_id,            -- Payment ID'si
  device_id,             -- Device ID'si
  holder_user_id,        -- Cihaz sahibinin ID'si (parayı yatıran)
  beneficiary_user_id,   -- Bulan kişinin ID'si (parayı alacak)
  total_amount,          -- Fee breakdown'tan (Frontend/iOS'tan gelen feeBreakdown)
  reward_amount,         -- Fee breakdown'tan
  service_fee,           -- Fee breakdown'tan
  gateway_fee,           -- Fee breakdown'tan
  cargo_fee,             -- Fee breakdown'tan
  net_payout,            -- Fee breakdown'tan
  status,                -- 'held' (escrow ile ödeme yapıldığı için)
  escrow_type,           -- 'standard'
  auto_release_days,     -- 30
  release_conditions,    -- JSON array: [{type: 'device_received', met: false}, ...]
  confirmations,         -- '[]' (JSON array)
  held_at,               -- now()
  created_at,            -- now()
  updated_at             -- now()
);
```

**3. `devices` tablosunda güncelleme (Backend tarafından - Webhook geldiğinde, ödeme başarılı olduğunda):**
```sql
-- Backend, webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true) device status'u günceller:
UPDATE devices 
SET 
  status = 'payment_completed',
  updated_at = now()
WHERE id = [device_id];
```

**4. `audit_logs` tablosuna kayıt (Backend tarafından - Webhook geldiğinde, ödeme başarılı olduğunda):**
```sql
-- Backend, webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true) audit log kaydı oluşturur:
INSERT INTO audit_logs (
  id,                    -- gen_random_uuid()
  event_type,           -- 'payment_completed'
  event_category,       -- 'payment'
  event_action,         -- 'complete'
  event_severity,       -- 'info'
  user_id,              -- Cihaz sahibinin ID'si
  resource_type,        -- 'payment'
  resource_id,          -- Payment ID'si
  event_description,    -- 'Payment completed successfully via PAYNET'
  event_data,           -- JSON: {amount, provider, authorization_code}
  created_at            -- now()
);
```

**5. `notifications` tablosuna kayıt (Backend tarafından - Webhook geldiğinde, ödeme başarılı olduğunda):**
```sql
-- Backend, webhook geldiğinde ve ödeme başarılı olduğunda (is_succeed: true) bildirim kayıtları oluşturur:
-- Cihaz sahibine bildirim
INSERT INTO notifications (
  id,                    -- gen_random_uuid()
  user_id,              -- Cihaz sahibinin ID'si
  message_key,          -- 'payment_completed_owner'
  type,                 -- 'success'
  is_read,              -- false
  created_at            -- now()
);

-- Bulan kişiye bildirim
INSERT INTO notifications (
  id,                    -- gen_random_uuid()
  user_id,              -- Bulan kişinin ID'si
  message_key,          -- 'payment_received_finder'
  type,                 -- 'payment_success'
  is_read,              -- false
  created_at            -- now()
);
```

**ÖNEMLİ NOTLAR:** 
- **Backend, ödeme başlatıldığında payment ID oluşturur ve veritabanına yazar** (`payments` tablosuna `status = 'pending'` ile)
- **Backend, webhook geldiğinde payload'ı veritabanında saklar ve tüm veritabanı kayıtlarını oluşturur**
- **Backend, webhook'tan gelen `reference_no` ile payment ID'yi eşleştirir**
- **Backend, webhook başarılı olduğunda (is_succeed: true) tüm tablolara yazar: payments, escrow_accounts, devices, audit_logs, notifications**
- **Frontend/iOS, backend'den ödeme sonucunu alır ve sadece kullanıcıya gösterir - veritabanına YAZMAZ**
- Bu yaklaşım, güvenli ve merkezi ödeme yönetimi sağlar ve güncel mimari standartlarına uygundur

**4. Kargo Firması API Çağrısı ve `cargo_shipments` Kaydı:**
```sql
-- ÖNEMLİ: Backend'de kargo firması ile iletişim kuran ayrı bir API servisi bulunur.
-- Bu API sadece kargo süreçlerini yönetir ve kargo firmasından aldığı takip numarasını veritabanına yazma yetkisine sahiptir.

-- Frontend/iOS: Backend kargo API'sine gönderi oluşturma isteği gönderir
-- POST /api/cargo/create-shipment (Backend kargo API endpoint)
-- Request Body:
-- {
--   "device_id": "...",
--   "payment_id": "...",
--   "cargo_company": "aras",
--   "sender_info": { ... },
--   "receiver_info": { ... },
--   ...
-- }
--
-- Backend Kargo API: Kargo firmasının API'sine istek gönderir
-- Backend Kargo API: Kargo firmasından gelen yanıtı alır:
-- {
--   "code": "ABC12345",              // Kargo firması tarafından üretilen teslim kodu
--   "tracking_number": "123456789",   // Kargo firması tarafından üretilen takip numarası
--   "estimated_delivery": "2025-01-15",
--   ...
-- }
--
-- Backend Kargo API: Kargo firmasından aldığı bilgileri cargo_shipments tablosuna yazar:
INSERT INTO cargo_shipments (
  id,
  device_id,
  payment_id,
  cargo_company,
  code,                        -- Kargo firması API'sinden dönen teslim kodu
  tracking_number,             -- Kargo firması API'sinden dönen takip numarası (opsiyonel)
  cargo_service_type,
  estimated_delivery_days,
  sender_anonymous_id,
  receiver_anonymous_id,
  sender_user_id,
  receiver_user_id,
  sender_address_encrypted,
  receiver_address_encrypted,
  status,                      -- 'active'
  cargo_status,                -- 'pending'
  cargo_fee,
  declared_value,
  generated_by,                -- Bulan kişinin user ID'si
  expires_at,                  -- Kargo firması API'sinden dönen veya 7 gün sonra
  created_at,
  updated_at
) VALUES (...);
```

**Önemli Not:** 
- **Backend'de kargo firması ile iletişim kuran ayrı bir API servisi bulunur.**
- **Bu API sadece kargo süreçlerini yönetir ve kargo firmasından aldığı takip numarasını veritabanına yazma yetkisine sahiptir.**
- Teslim kodu (`code`) ve takip numarası (`tracking_number`) **kargo firmasının API'si tarafından üretilir**, sistem tarafından değil.
- Kargo firması API'sine gönderi oluşturma isteği gönderilirken, bulan kişinin ve cihaz sahibinin adres bilgileri şifrelenmiş halde gönderilir (kimlik bilgileri gizli kalır).
- Backend kargo API'si, kargo firmasından aldığı `code` ve `tracking_number` bilgilerini `cargo_shipments` tablosuna yazar.
- API yanıtında dönen `code` değeri bulan kişiye gösterilir ve bulan kişi bu kod ile kargo firmasına gidip cihazı teslim edecektir.


**7. `cargo_shipments` tablosuna kayıt (Backend Kargo API tarafından oluşturulur):**
```sql
-- ÖNEMLİ: Backend kargo API'si, kargo firması API'si ile iletişim kurar ve aldığı bilgileri veritabanına yazar.
-- Kargo firması API'sine gönderi bilgileri gönderildiğinde, API code ve tracking_number döndürür
-- Backend kargo API'si bu bilgileri cargo_shipments tablosuna yazar
INSERT INTO cargo_shipments (
  id,                          -- gen_random_uuid()
  device_id,                   -- Cihaz ID'si (owner'ın device ID'si)
  payment_id,                  -- Payment ID'si
  cargo_company,               -- Kargo firması (örn: 'aras', 'yurtici', 'mng', 'ptt')
  code,                        -- Kargo firması API'sinden dönen teslim kodu (kargo firması tarafından üretilir)
  cargo_service_type,          -- 'standard' veya 'express'
  estimated_delivery_days,     -- Tahmini teslimat günü (örn: 2)
  sender_anonymous_id,         -- Bulan kişi için anonim ID (örn: 'FND123456')
  receiver_anonymous_id,       -- Cihaz sahibi için anonim ID (örn: 'OWN789012')
  sender_user_id,              -- Bulan kişinin user ID'si
  receiver_user_id,            -- Cihaz sahibinin user ID'si
  sender_address_encrypted,    -- Bulan kişinin adresi (şifrelenmiş)
  receiver_address_encrypted,  -- Cihaz sahibinin adresi (şifrelenmiş)
  status,                      -- 'active' (teslim kodu aktif, kargoya teslim bekleniyor)
  cargo_status,                -- 'pending' (kargo durumu: bekleniyor)
  cargo_fee,                   -- Kargo ücreti (örn: 250.00)
  declared_value,              -- Bildirilen değer (örn: 1000.00)
  generated_by,                 -- Bulan kişinin user ID'si (kargo firması API çağrısını yapan kullanıcı)
  expires_at,                  -- Kargo firması API'sinden dönen veya 7 gün sonra (kodun son kullanma tarihi)
  created_at,                  -- now()
  updated_at                   -- now()
);
```

**ÖNEMLİ - Kargo API Backend Yetkileri:**
- **Backend'de kargo firması ile iletişim kuran ayrı bir API servisi bulunur.**
- **Bu API sadece kargo süreçlerini yönetir ve kargo firmasından aldığı takip numarasını veritabanına yazma yetkisine sahiptir.**
- `code` (teslim kodu) ve `tracking_number` (takip numarası) **kargo firmasının API'si tarafından üretilir** ve API yanıtında döner.
- Frontend/iOS, backend kargo API'sine gönderi oluşturma isteği gönderir.
- Backend kargo API'si, kargo firması API'si ile iletişim kurar ve yanıtı alır.
- Backend kargo API'si, kargo firmasından aldığı `code` ve `tracking_number` bilgilerini `cargo_shipments` tablosuna yazar.
- Bu kod ve takip numarası bulan kişiye gösterilir ve bulan kişi bu kod ile kargo firmasına gidip cihazı teslim edecektir.
- `cargo_status` sütunu kargo sürecinin detaylı durumunu takip eder.

### **Adım 7: Kargo Gönderildi**
```
Bulan kişi teslim kodu ile kargo firmasına teslim etti → Kargo API'si tracking_number döndürdü → Status: cargo_shipped
```

**Süreç Analizi:**
1. Ödeme tamamlandıktan sonra, Frontend/iOS backend kargo API'sine gönderi oluşturma isteği gönderir
2. Backend kargo API'si, kargo firması API'si ile iletişim kurar
3. Kargo firması API'si gönderi bilgilerini işler ve:
   - `code` (teslim kodu) üretir
   - `tracking_number` (takip numarası) üretir (kargo firması tarafından üretilir)
   - Bu bilgileri API yanıtında döndürür
4. Backend kargo API'si, kargo firmasından aldığı `code` ve `tracking_number` bilgilerini `cargo_shipments` tablosuna yazar
5. Bulan kişi `cargo_shipments.code` (teslim kodu) ile kargo firmasına gider ve cihazı teslim eder
6. Kargo firması şubesinde işlem tamamlandığında, kargo firması API'si backend kargo API'sine webhook gönderir
7. Backend kargo API'si webhook'u alır ve `cargo_shipments` tablosunu günceller (tracking_number, cargo_status vb.)
8. Backend kargo API'si, webhook'tan gelen `tracking_number` (eğer henüz yoksa) ve kargo durumu güncellemesi ile `cargo_shipments` kaydını günceller:
   - `cargo_shipments.status` → 'used' olur (kod kullanıldı)
   - `cargo_shipments.cargo_status` → 'picked_up' olur
   - `cargo_shipments.used_at` → now() olur
   - `cargo_shipments.picked_up_at` → now() olur
   - `cargo_shipments.tracking_number` → Kargo firmasından gelen takip numarası (güncellenir veya eklenir)
10. Backend kargo API'si, `devices.status` → 'cargo_shipped' olarak günceller

**Database Güncellemeleri (Backend Kargo API Tarafından Yapılır):**

**1. `cargo_shipments` tablosunda güncelleme:**
```sql
-- Backend kargo API'si, kargo firması API'sinden tracking_number geldiğinde
UPDATE cargo_shipments 
SET 
  tracking_number = [kargo_firmasından_gelen_takip_numarası],
  status = 'used',                    -- Teslim kodu kullanıldı
  cargo_status = 'picked_up',         -- Kargo alındı
  used_at = now(),                    -- Kod kullanıldı tarihi
  picked_up_at = now(),                -- Kargo alındı tarihi
  updated_at = now()
WHERE device_id = [device_id] AND code = [teslim_kodu];
```

**2. `devices` tablosunda güncelleme (Backend Kargo API tarafından):**
```sql
-- Backend kargo API'si, kargo firması webhook'u geldiğinde devices status'u günceller:
UPDATE devices 
SET 
  status = 'cargo_shipped',
  updated_at = now()
WHERE id = [device_id];
```

**4. `audit_logs` tablosuna kayıt:**
```sql
INSERT INTO audit_logs (
  id,                    -- gen_random_uuid()
  event_type,           -- 'cargo_shipment_created'
  event_category,       -- 'cargo'
  event_action,         -- 'create'
  event_severity,       -- 'info'
  user_id,              -- Bulan kişinin ID'si
  resource_type,        -- 'cargo_shipment'
  resource_id,          -- cargo_shipments.id
  event_description,    -- 'Device shipped by finder'
  event_data,           -- JSON: {tracking_number, cargo_company, device_id}
  created_at            -- now()
);
```

**4. `notifications` tablosuna kayıtlar:**
```sql
-- Cihaz sahibine bildirim
INSERT INTO notifications (
  id,                    -- gen_random_uuid()
  user_id,              -- Cihaz sahibinin ID'si
  message_key,          -- 'package_shipped'
  link,                 -- '/device/[device_id]'
  is_read,              -- false
  created_at            -- now()
);

-- Bulan kişiye bildirim
INSERT INTO notifications (
  id,                    -- gen_random_uuid()
  user_id,              -- Bulan kişinin ID'si
  message_key,          -- 'package_shipped'
  link,                 -- '/device/[device_id]'
  is_read,              -- false
  created_at            -- now()
);
```

**Dashboard'da Görünen:**
- Cihaz kartı mesajı: Cihaz kargo firmasına teslim edildi. 
- Durum rengi: Mavi

**DeviceDetailPage (Cihaz Detay Sayfası):**
```
Dashboard → Cihaz Kartına Tıkla → DeviceDetailPage açılır
```

DeviceDetailPage içeriği
✅
Cihazınız Kargo Firmasına Teslim Edildi!
Cihazınız yolda! Lütfen takip numarası ile kontrol edin. 
-"Kayıp Cihaz Detayları" Kartı
Kayıp Tarihi:
Kayıp Yeri:
Cihaz Modeli:
Cihaz Seri Numarası:
Cihaz Rengi:
Ek Detaylar:
Satın Alma Kanıtı (Fatura) Dosyası:
-"İşlem Durumu" Kartı
Durum:  Kayıtlı XXX seri numaralı YYY cihaz yolda. Kargo firması cihazı teslim edecek.
-"Ödeme Detayları" Kartı
Ödeme ID:
Toplam Tutar:
Ödeme Durumu: Tamamlandı
Ödeme Sağlayıcı:
Ödeme Tarihi:
-"Escrow Durumu" Kartı
Escrow ID:
Durum: Beklemede
Escrow Tutarı:
-"Durum Bilgisi" Kartı (3 numaralı seçenek aktif turuncu renk. diğerleri pasif durumda.)
1 Cihaz için eşleşme bekleniyor
2 Cihazınız bulundu
    Ödemenizi yapmak ve takas sürecini tamamlamak için "Ödemeyi güvenle yap Butonu"
3 Cihazınızın size teslim edilmesi bekleniyor
    Teslim/Takip için kargo numaranız: XXX
4 Cihaz Teslim Alındığında
    Cihazın seri numarasını kontrol edip teslim aldığınızı onaylayın "Onay Butonu"
5 İşlem Tamamlandı
    Cihazınıza kavuştuğunuz için mutluyuz.

**Bildirimler:**
- In-APP

---

### **Adım 8: Kargo Teslim Alındı**
```
Kargo firması API'si "teslim edildi" bildirimi gönderir → devices.status: 'delivered' → Kullanıcıdan manuel onay bekleniyor
```
Süreç Analizi: Bu adım, kargo firması API'sinden "teslim edildi" bilgisi geldiğinde tetiklenir. Bu anda sistemin durumu değişir ve kullanıcıdan bir eylem beklenir.

**Durum Güncellemeleri:**
- `cargo_shipments.cargo_status` → 'delivered'
- `cargo_shipments.delivered_at` → now()
- `devices.status` → 'delivered'

**Database Güncellemeleri:**

**1. `cargo_shipments` tablosunda güncelleme:**
```sql
UPDATE cargo_shipments 
SET 
  cargo_status = 'delivered',    -- Kargo durumu: teslim edildi
  delivered_at = now(),
  updated_at = now()
WHERE device_id = [device_id];
```

**2. `devices` tablosunda güncelleme:**
```sql
UPDATE devices 
SET 
  status = 'delivered',
  updated_at = now()
WHERE id = [device_id];
```

**3. `notifications` tablosuna kayıt:**
```sql
INSERT INTO notifications (
  id,                    -- gen_random_uuid()
  user_id,              -- Cihaz sahibinin ID'si
  message_key,          -- 'package_delivered_confirm' (NOT: Bu anahtar constants.ts'de yok, eklenmesi gerekir)
  link,                 -- '/device/[device_id]'
  is_read,              -- false
  created_at            -- now()
);
```

**5. `audit_logs` tablosuna kayıt:**
```sql
INSERT INTO audit_logs (
  id,                    -- gen_random_uuid()
  event_type,           -- 'cargo_delivered'
  event_category,       -- 'cargo'
  event_action,         -- 'deliver'
  event_severity,       -- 'info'
  user_id,              -- Sistem (null) veya kargo API webhook'u
  resource_type,        -- 'cargo_shipment'
  resource_id,          -- cargo_shipments.id
  event_description,    -- 'Package delivered by cargo company'
  event_data,           -- JSON: {tracking_number, delivered_at, device_id}
  created_at            -- now()
);
```
---

**Dashboard'da Görünen:**
- Mesaj: Cihazınız teslim edildi. Lütfen kontrol edip onaylayın.
- Butonlar:
  - "Cihazımı Teslim Aldım, Onayla" 
  - "Sorun Var, İtiraz Et" 

**DeviceDetailPage (Cihaz Detay Sayfası):**
```
Dashboard → Cihaz Kartına Tıkla → DeviceDetailPage açılır
```
DeviceDetailPage içeriği
✅
Cihazınız Size Teslim Edildi!
Cihazınız teslim edildi. Lütfen Seri Numarasını Kontrol Edin ve Onaylayın. 
-"Kayıp Cihaz Detayları" Kartı
Kayıp Tarihi:
Kayıp Yeri:
Cihaz Modeli:
Cihaz Seri Numarası:
Cihaz Rengi:
Ek Detaylar:
Satın Alma Kanıtı (Fatura) Dosyası:
-"İşlem Durumu" Kartı
Durum:  Kayıtlı XXX seri numaralı YYY cihaz teslim edildi. Teslim almayı onaylayın.
-"Ödeme Detayları" Kartı
Ödeme ID:
Toplam Tutar:
Ödeme Durumu: Tamamlandı
Ödeme Sağlayıcı:
Ödeme Tarihi:
-"Escrow Durumu" Kartı
Escrow ID:
Durum: Beklemede
Escrow Tutarı:
-"Durum Bilgisi" Kartı (4 numaralı seçenek aktif turuncu renk. diğerleri pasif durumda.)
1 Cihaz için eşleşme bekleniyor
2 Cihazınız bulundu
    Ödemenizi yapmak ve takas sürecini tamamlamak için "Ödemeyi güvenle yap Butonu"
3 Cihazınızın size teslim edilmesi bekleniyor
    Teslim/Takip için kargo numaranız: XXX
4 Cihaz Teslim Alındığında
    Cihazın seri numarasını kontrol edip teslim aldığınızı onaylayın "Onay Butonu"
5 İşlem Tamamlandı
    Cihazınıza kavuştuğunuz için mutluyuz.
---

### **Adım 9: Onay Verme**
```
Cihaz sahibi → "Onayla" butonu → delivery_confirmations kaydı → Escrow serbest bırakılıyor ve ödemeler yapılıyor → devices.status: 'completed'
```
Süreç Analizi: Kullanıcı "Onayla" butonuna bastığında, sürecin en kritik otomasyonu tetiklenir: paranın serbest bırakılması ve dağıtımı.

**Durum Güncellemesi:**
1. Kullanıcı onayıyla `delivery_confirmations` kaydı oluşturulur
2. `cargo_shipments.delivery_confirmed_by_receiver` → true
3. `cargo_shipments.delivery_confirmation_date` → now()
4. `cargo_shipments.delivery_confirmation_id` → delivery_confirmations.id
5. `devices.status` → 'confirmed' (geçici)
6. **Backend: PAYNET API'ye escrow release isteği gönderilir** (`POST /v1/transaction/escrow_status_update`)
7. `escrow_accounts.status` → 'released'
8. `financial_transactions` kaydı oluşturulur (ödeme transferi)
9. `devices.status` → 'completed' (final)
10. `payments.status` → 'completed'

**Database Güncellemeleri:**

**1. `delivery_confirmations` tablosuna kayıt:**
```sql
INSERT INTO delivery_confirmations (
  id,                    -- gen_random_uuid()
  device_id,            -- Device ID'si
  payment_id,           -- Payment ID'si
  cargo_shipment_id,    -- cargo_shipments.id
  confirmed_by,         -- Cihaz sahibinin user ID'si
  confirmation_type,    -- 'device_received'
  confirmation_data,    -- JSON: {serial_number_verified: true, condition: 'good'}
  confirmed_at,         -- now()
  created_at            -- now()
);
```

**2. `cargo_shipments` tablosunda güncelleme:**
```sql
UPDATE cargo_shipments 
SET 
  delivery_confirmed_by_receiver = true,
  delivery_confirmation_date = now(),
  delivery_confirmation_id = [delivery_confirmations.id],
  cargo_status = 'confirmed',          -- Kargo durumu: onaylandı
  updated_at = now()
WHERE device_id = [device_id];
```

**3. Backend: PAYNET API'ye Escrow Release İsteği:**
```javascript
// Backend, onay sonrası PAYNET API'ye escrow release isteği gönderir:
POST /v1/transaction/escrow_status_update
{
  "xact_id": "[paynet_transaction_id]",  // PAYNET işlem ID'si
  "status": 2,                            // 2 = Onay (Release)
  "note": "Device received and confirmed by owner"
}
```

**4. `escrow_accounts` tablosunda güncelleme:**
```sql
UPDATE escrow_accounts 
SET 
  status = 'released',
  released_at = now(),
  release_reason = 'Device received and confirmed by owner',
  released_by = [cihaz_sahibi_user_id],
  updated_at = now()
WHERE payment_id = [payment_id] AND status = 'held';
```

**4. `financial_transactions` tablosuna kayıt:**
```sql
INSERT INTO financial_transactions (
  id,                    -- gen_random_uuid()
  escrow_id,            -- escrow_accounts.id
  payment_id,           -- Payment ID'si
  device_id,            -- Device ID'si
  transaction_type,     -- 'escrow_release'
  amount,               -- Net payout tutarı (reward_amount)
  currency,             -- 'TRY'
  status,               -- 'completed'
  description,          -- 'Escrow release: Device received and confirmed'
  from_user_id,         -- NULL (Platform/Escrow hesabı)
  to_user_id,          -- Bulan kişinin user ID'si
  confirmed_by,        -- Cihaz sahibinin user ID'si
  confirmation_type,    -- 'device_received'
  completed_at,         -- now()
  created_at            -- now()
);
```

**6. `payments` tablosunda güncelleme:**
```sql
UPDATE payments 
SET 
  status = 'completed',
  completed_at = now(),
  updated_at = now()
WHERE id = [payment_id];
```

**7. `devices` tablosunda güncelleme:**
```sql
UPDATE devices 
SET 
  status = 'completed',
  delivery_confirmed_at = now(),
  final_payment_distributed_at = now(),
  updated_at = now()
WHERE id = [device_id];
```

**8. `notifications` tablosuna kayıtlar:**
```sql
-- Bulan kişiye bildirim (ödül serbest bırakıldı)
INSERT INTO notifications (
  id,                    -- gen_random_uuid()
  user_id,              -- Bulan kişinin ID'si
  message_key,          -- 'reward_released'
  link,                 -- '/device/[device_id]'
  is_read,              -- false
  created_at            -- now()
);

-- Cihaz sahibine bildirim (işlem tamamlandı)
INSERT INTO notifications (
  id,                    -- gen_random_uuid()
  user_id,              -- Cihaz sahibinin ID'si
  message_key,          -- 'transactionCompletedOwner'
  link,                 -- '/device/[device_id]'
  is_read,              -- false
  created_at            -- now()
);
```

**9. `audit_logs` tablosuna kayıt:**
```sql
INSERT INTO audit_logs (
  id,                    -- gen_random_uuid()
  event_type,           -- 'escrow_released'
  event_category,       -- 'financial'
  event_action,         -- 'release'
  event_severity,       -- 'info'
  user_id,              -- Cihaz sahibinin ID'si
  resource_type,        -- 'escrow'
  resource_id,          -- escrow_accounts.id
  event_description,    -- 'Escrow released after device confirmation'
  event_data,           -- JSON: {payment_id, device_id, net_payout, released_at}
  created_at            -- now()
);
```
---


**DeviceDetailPage (Cihaz Detay Sayfası):**
```
Dashboard → Cihaz Kartına Tıkla → DeviceDetailPage açılır
```

DeviceDetailPage içeriği
✅
Cihazınıza Kavuştuğunuz için Çok Mutluyuz!
Süreci başarı ile tamamladık. 
-"Kayıp Cihaz Detayları" Kartı
Kayıp Tarihi:
Kayıp Yeri:
Cihaz Modeli:
Cihaz Seri Numarası:
Cihaz Rengi:
Ek Detaylar:
Satın Alma Kanıtı (Fatura) Dosyası:
-"İşlem Durumu" Kartı
Durum:  Kayıtlı XXX seri numaralı YYY cihaz teslim edildi. Teslim almaa onaylandı.
-"Ödeme Detayları" Kartı
Ödeme ID:
Toplam Tutar:
Ödeme Durumu: Tamamlandı
Ödeme Sağlayıcı:
Ödeme Tarihi:
-"Escrow Durumu" Kartı
Escrow ID:
Durum: Serbest Bırakıldı.
Escrow Tutarı:
-"Durum Bilgisi" Kartı (5 numaralı seçenek aktif turuncu renk. diğerleri pasif durumda.)
1 Cihaz için eşleşme bekleniyor
2 Cihazınız bulundu
    Ödemenizi yapmak ve takas sürecini tamamlamak için "Ödemeyi güvenle yap Butonu"
3 Cihazınızın size teslim edilmesi bekleniyor
    Teslim/Takip için kargo numaranız: XXX
4 Cihaz Teslim Alındığında
    Cihazın seri numarasını kontrol edip teslim aldığınızı onaylayın "Onay Butonu"
5 İşlem Tamamlandı
    Cihazınıza kavuştuğunuz için mutluyuz.
---

**Bildirimler:**
- Cihaz sahibine: EVET
- Bulan kişiye: EVET
- In-App
---

## 🟢 CİHAZ BULAN (FINDER) - BULUNAN CİHAZ SÜRECİ

### **Adım 1: Kayıt ve Giriş**
```
Kullanıcı → Ana Sayfa → "Kayıt Ol" → Email + Şifre → Giriş
```

**Sorular:**
IBAN: Kayıt sırasında değil, eşleşme bulunduktan ve cihaz sahibi ödemeyi yaptıktan sonra zorunlu olmalıdır. Kullanıcıyı henüz bir ödül kazanmamışken IBAN girmeye zorlamak, kayıt oranını düşürebilir. Ödeme yapıldığı anda sistem, bulan kişiye "Ödülünüzü alabilmek ve kargo sürecini başlatmak için lütfen IBAN bilgilerinizi tamamlayın" uyarısını göstermelidir.
Kimlik Doğrulama: Güvenlik ve yasal sebeplerle, özellikle ödeme alacak (bulan) kişi için kimlik doğrulaması (TC Kimlik No doğrulaması gibi) yapılması şiddetle tavsiye edilir.

---

### **Adım 2: Bulunan Cihaz Ekleme**
```
Dashboard → "Bulunan Cihaz Bildir
```

**Girilen Bilgiler:**
- Seri Numarası: Manuel giriş [zorunlu alan]
- Renk: Dropdown [zorunlu alan]
- Cihaz Modeli: Dropdown [zorunlu alan]
- Bulunma Tarihi: Tarih seçici [zorunlu alan]
- Bulunma Yeri: Serbest metin [zorunlu alan]
- Ek Detaylar: Opsiyonel
- Bulunan Cihazın Fotoğrafı: "Dosya Ekle Butonu" (Ön ve Arka İki Fotoğraf Kaydı) [zorunlu alan]

**Dashboard'da Görünen:**
- Cihaz kartı: "Bulunan Cihaz için Eşleşme Bekleniyor"
- Durum rengi: Turuncu/Sarı
- Bildirim: Var mı? VAR

**DeviceDetailPage (Cihaz Detay Sayfası):**
```
Dashboard → Cihaz Kartına Tıkla → DeviceDetailPage açılır
```

DeviceDetailPage içeriği
✅
Cihazın Kaydı Başarıyla Tamamlandı!
Bulduğun cihaz sisteme kaydedildi. Eşleşme bulunduğunda size bildirim gönderilecektir.
-"Bulunan Cihaz Detayları" Kartı
Bulunma Tarihi:
Bulunma Yeri:
Cihaz Modeli:
Cihaz Seri Numarası:
Cihaz Rengi:
Ek Detaylar:
Bulunan Cihaz Fotoğrafı (Ön ve Arka):
-"İşlem Durumu" Kartı
Durum:  Kayıtlı XXX seri numaralı YYY cihaz için eşleşme bekleniyor.
-"Durum Bilgisi" Kartı (1 numaralı seçenek aktif turuncu renk. diğerleri pasif durumda.)
1 Cihaz için eşleşme bekleniyor
2 Eşleşme bulundu
    Cihazın sahibinin ödeme yapması bekleniyor.
3 Cihazın Kargo Firmasına Teslim Edilmesi
    Teslim/Takip için kargo numaranız: XXX
4 Cihaz Sahibi Teslim Alındığında
    Kargo firması cihazı sahibine teslim etti. Onay bekleniyor. 
5 İşlem Tamamlandı
    Takas tamamlandığında ödülünüz hesabınıza aktarılacak.

🎁
ÇOK TEŞEKKÜR EDERİZ!
iFoundAnApple olarak, dürüstlüğünüzü ve yardımseverliğinizi yürekten takdir eder, bu nazik davranışınız için teşekkür ederiz!

Değerli eşyaların sahiplerine ulaşması için şeffaf ve güvenilir bir platform sunmaya özen gösteriyoruz. Senin gibi insanların varlığı, dünyayı daha iyi bir yer yapıyor.

Bulduğunuz cihaz sahibine teslim edildiğinde, gösterdiğiniz çaba ve örnek davranış karşılığında küçük bir hediye almanızı sağlıyoruz.

💡 Önemli: Cihaz eşleşmesi gerçekleştiği zaman lütfen kimlik ve IBAN bilgilerinizin doğruluğunu profil sayfasından kontrol ediniz.
---


**Database Kayıtları:**

**1. `devices` tablosuna kayıt:**
```sql
INSERT INTO devices (
  id,                    -- gen_random_uuid()
  "userId",             -- Bulan kişinin ID'si (auth.users.id)
  model,                -- Cihaz modeli (text)
  "serialNumber",       -- Seri numarası (text)
  status,               -- 'reported' (text)
  color,                -- Cihaz rengi (text, nullable)
  description,          -- Açıklama (text, nullable)
  "exchangeConfirmedBy", -- Onaylayanlar array (uuid[], default '{}')
  created_at,           -- now()
  updated_at,           -- now()
  found_date,           -- Bulunma tarihi (date, nullable)
  found_location,       -- Bulunma yeri (text, nullable)
  "invoice_url",        -- Bulunan cihaz fotoğrafı URL'leri (text, nullable) - Virgülle ayrılmış fotoğraf URL'leri (önceki ve arka)
  device_role           -- 'finder' (cihazı bulan kişi)
);
```

**2. `audit_logs` tablosuna kayıt:**
```sql
INSERT INTO audit_logs (
  id,                    -- gen_random_uuid()
  event_type,           -- 'device_registration'
  event_category,       -- 'device'
  event_action,         -- 'create'
  event_severity,       -- 'info'
  user_id,              -- Bulan kişinin ID'si
  resource_type,        -- 'device'
  resource_id,          -- Oluşturulan device ID'si
  event_description,    -- 'Found device reported'
  event_data,           -- JSON: {model, serialNumber, found_date, found_location, invoice_url}
  created_at            -- now()
);
```

**3. `notifications` tablosuna kayıt:**
```sql
INSERT INTO notifications (
  id,                    -- gen_random_uuid()
  user_id,              -- Bulan kişinin ID'si
  message_key,          -- 'deviceReportedConfirmation'
  link,                 -- '/device/[device_id]'
  is_read,              -- false
  created_at,           -- now()
  replacements          -- JSON: {model: device_model}
);
```

### **Adım 3: Eşleşme Bulundu**
```
Sistem → Eşleşme buldu → Status: MATCHED
```

**Database:**
```typescript
devices {
  status: "MATCHED"
  matched_with_user_id: UUID  // Cihaz sahibinin ID'si mi?
  matched_at: timestamp
}
```

**Dashboard'da Görünen:**
- Mesaj: Eşleşme Bulundu! Cihaz Sahibi Ödemesi Bekleniyor.

**DeviceDetailPage (Cihaz Detay Sayfası):**
```
Dashboard → Cihaz Kartına Tıkla → DeviceDetailPage açılır
```
DeviceDetailPage içeriği
✅
Eşleşme Bulundu!
Cihaz sahibinin ödeme yapması bekleniyor.
-"Bulunan Cihaz Detayları" Kartı
Bulunma Tarihi:
Bulunma Yeri:
Cihaz Modeli:
Cihaz Seri Numarası:
Cihaz Rengi:
Ek Detaylar:
Bulunan Cihaz Fotoğrafı (Ön ve Arka):
-"İşlem Durumu" Kartı
Durum:  Kayıtlı XXX seri numaralı YYY cihaz için eşleşme bulundu.
-"Durum Bilgisi" Kartı (2 numaralı seçenek aktif turuncu renk. diğerleri pasif durumda.)
1 Cihaz için eşleşme bekleniyor
2 Eşleşme bulundu
    Cihazın sahibinin ödeme yapması bekleniyor.
3 Cihazın Kargo Firmasına Teslim Edilmesi
    Teslim/Takip için kargo numaranız: XXX
4 Cihaz Sahibi Teslim Alındığında
    Kargo firması cihazı sahibine teslim etti. Onay bekleniyor. 
5 İşlem Tamamlandı
    Takas tamamlandığında ödülünüz hesabınıza aktarılacak.

**Bildirimler:**
- In-app: evet
---

### **Adım 4: Ödeme Tamamlandı**
```
Cihaz sahibi ödeme yaptı → Status: PAYMENT_COMPLETED
```

**Database:**
```typescript
payments {
  receiver_id: UUID  // BULAN KİŞİNİN ID'Sİ güncellendi
}

escrow_accounts {
  beneficiary_user_id: UUID  // BULAN KİŞİNİN ID'Sİ
  status: "held"
}

devices {
  status: "payment_completed"
}
```

**Dashboard'da Görünen:**
- Mesaj: "Ödeme alındı, cihazı kargo firmasına teslim edin.


**DeviceDetailPage (Cihaz Detay Sayfası):**
```
Dashboard → Cihaz Kartına Tıkla → DeviceDetailPage açılır
```

DeviceDetailPage içeriği
✅
Ödeme Süreci Tamamlandı!
Lütfen en kısa sürede cihazı kargo firmasına teslim edin.
⚠️ Ödülünüzü alabilmek için lütfen profil bilgilerinizi tamamlayın:
   [ ] TC Kimlik Numaranızı girin
   [ ] IBAN bilgilerinizi ekleyin

-"Bulunan Cihaz Detayları" Kartı
Bulunma Tarihi:
Bulunma Yeri:
Cihaz Modeli:
Cihaz Seri Numarası:
Cihaz Rengi:
Ek Detaylar:
Bulunan Cihaz Fotoğrafı (Ön ve Arka):
-"İşlem Durumu" Kartı
Durum:  Kayıtlı XXX seri numaralı YYY cihaz için ödeme tamamlandı.
-"Durum Bilgisi" Kartı (3 numaralı seçenek aktif turuncu renk. diğerleri pasif durumda.)
1 Cihaz için eşleşme bekleniyor
2 Eşleşme bulundu
    Cihazın sahibinin ödeme yapması bekleniyor.
3 Cihazın Kargo Firmasına Teslim Edilmesi
    Kargo firmasına vereceğiniz **Teslim Kodunuz:** `cargo_shipments.code` değeri gösterilecek (kargo firması API'si tarafından üretilen kod)
4 Cihaz Sahibi Teslim Aldığında
    Kargo firması cihazı sahibine teslim edecek. Onay bekleniyor. 
5 İşlem Tamamlandı
    Takas tamamlandığında ödülünüz hesabınıza aktarılacak.

**Bildirimler:**
- In-app: evet
---

### **Adım 7: Kargonun Firmaya Teslim Edilmesi**
```
Kargo Firması API → "Kargo Bilgilerini Gir" → Form

> 1.  Bulan kişi formu doldurmaz.
> 2.  Bulan kişi sadece **Teslim Kodu** ile kargo şubesine gider ve cihazı verir.
> 3.  Formu aslında kargo görevlisi (kendi ekranında) doldurur veya API otomatik olarak halleder.
> 4.  Kargo firması API'si bizim sistemimize "Teslim alındı, yeni takip numarası: 123456" bilgisini gönderir.
>
> Dolayısıyla bu adımda bulan kişinin yapacağı bir "veri girişi" yoktur, sadece fiziksel bir eylem (cihazı teslim etme) vardır.
```

**Girilen Bilgiler:**
- Kargo Şirketi: Dropdown (Aras, Yurtiçi, MNG, PTT)
- Kargo Takip Numarası: Manuel giriş
- Gönderinin alındığı tarih
- Gönderinin alındığı şube
- Kargo Takip Numarası: Manuel giriş
- Gönderinin teslim edildiği tarih:
---

### **Adım 8: Kargo Yolda**
```
Status: cargo_shipped → Teslimat bekleniyor
```

**Dashboard'da Görünen:**
- Mesaj: "Kargo Yolda"
---
DeviceDetailPage (Cihaz Detay Sayfası):
Dashboard → Cihaz Kartına Tıkla → DeviceDetailPage açılır

DeviceDetailPage içeriği
✅
Cihaz Yola Çıktı!
Cihazı başarıyla kargoya teslim ettin. Sahibine ulaşması bekleniyor.
-"Bulunan Cihaz Detayları" Kartı
Bulunma Tarihi:
Bulunma Yeri:
... (diğer detaylar)
-"İşlem Durumu" Kartı
Durum: Cihaz kargoya verildi. Sahibine teslim edilmesi bekleniyor.
-"Durum Bilgisi" Kartı (4 numaralı seçenek aktif turuncu renk. diğerleri pasif durumda.)
1 Cihaz için eşleşme bekleniyor
2 Eşleşme bulundu
3 Cihazın Kargo Firmasına Teslim Edilmesi
4 Cihaz Sahibi Teslim Alındığında
Kargo firması cihazı sahibine teslim edecek. Onay bekleniyor.
5 İşlem Tamamlandı
---


### **Adım 9: Teslimat ve Onay Bekleme**
```
Cihaz sahibi teslim aldı → Onay veriyor
```

**Dashboard'da Görünen:**
- Mesaj: "Onay bekleniyor"
---
DeviceDetailPage (Cihaz Detay Sayfası):
Dashboard → Cihaz Kartına Tıkla → DeviceDetailPage açılır
DeviceDetailPage içeriği
✅
Teslimat Tamamlandı! Onay Bekleniyor.
Kargo firması cihazı sahibine teslim etti. Ödülünün serbest bırakılması için cihaz sahibinin teslimatı onaylaması bekleniyor.
(Not: Cihaz sahibi 48 saat içinde onaylamazsa, sistem işlemi otomatik olarak onaylayacaktır.)
-"Bulunan Cihaz Detayları" Kartı
Bulunma Tarihi:
Bulunma Yeri:
... (diğer detaylar)
-"İşlem Durumu" Kartı
Durum: Cihaz sahibine teslim edildi. Onay bekleniyor.
-"Durum Bilgisi" Kartı (4 numaralı seçenek aktif turuncu renk. diğerleri pasif durumda.)
1 Cihaz için eşleşme bekleniyor
2 Eşleşme bulundu
3 Cihazın Kargo Firmasına Teslim Edilmesi
4 Cihaz Sahibi Teslim Alındığında
Kargo firması cihazı sahibine teslim etti. Onay bekleniyor.
5 İşlem Tamamlandı
---

### **Adım 10: Ödül Alma**
```
Cihaz sahibi onayladı → Escrow released → Para transfer
```
Status: completed → Ödül transfer edildi
---

**Dashboard'da Görünen:**
- Mesaj: "Ödülünüz hesabınıza aktarıldı" 
---
DeviceDetailPage (Cihaz Detay Sayfası):
Dashboard → Cihaz Kartına Tıkla → DeviceDetailPage açılır
DeviceDetailPage içeriği
✅
İşlem Başarıyla Tamamlandı!
Yardımın için teşekkür ederiz! Ödülün, belirttiğin IBAN adresine transfer edildi.
-"Bulunan Cihaz Detayları" Kartı
Bulunma Tarihi:
Bulunma Yeri:
... (diğer detaylar)
-"İşlem Durumu" Kartı
Durum: İşlem tamamlandı. Ödülün gönderildi.
-"Durum Bilgisi" Kartı (5 numaralı seçenek aktif yeşil renk. diğerleri pasif durumda.)
1 Cihaz için eşleşme bekleniyor
2 Eşleşme bulundu
3 Cihazın Kargo Firmasına Teslim Edilmesi
4 Cihaz Sahibi Teslim Aldığında
5 İşlem Tamamlandı
Takas tamamlandığında ödülünüz hesabınıza aktarılacak. (Metin "aktarıldı" olarak güncellenebilir)
---

**Transfer Süreci:**
- IBAN'a otomatik transfer 
- Ödeme sağlayıcı ile yapılıyor
- Transfer süresi: Anında mı, 1-3 iş günü mü?

**Bildirimler:**
- In-APP

---




## ❓ EKSİK DETAYLAR VE SORULAR

### **1. Profil Bilgileri**
- IBAN bulunan cihaz kaydı esnasında zorunlu
Cevap: Hayır, zorunlu olmamalı. IBAN bilgisi, cihazı bulan kullanıcı için, cihaz sahibi ödemeyi yaptıktan sonra (payment_completed durumunda) kargo sürecine geçmeden hemen önce zorunlu hale getirilmelidir. Cihaz sahibinden IBAN istenmesi gerekmez.
- Kimlik doğrulama var mı?
Olması şiddetle tavsiye edilir. Özellikle ödeme alacak olan cihazı bulan kişi için dolandırıcılığı önlemek ve yasal uyumluluk (KYC) amacıyla TC Kimlik No doğrulaması yapılmalıdır. Bu da IBAN gibi, ödeme yapıldıktan sonra istenebilir.
- TC Kimlik zorunlu
Cevap: Evet. Cihaz sahibi için ödeme güvenliği, cihazı bulan için ise ödül ödemesinin doğruluğu için zorunlu olmalıdır. Cihaz sahibi için ödeme adımından önce, bulan için ise ödeme alındıktan sonra zorunlu kılınmalıdır.
- Telefon zorunlu
- Adres bulunan cihaz kaydı için zorunlu değil. 

### **2. Kargo Detayları**
- Kargo ücreti ifoundanapple a ait
- Kargo adresi kargo firması ile şifreli olarak api üzerinden kimlik bilgileri ve adres gizli kalmak koşulu ile  paylaşılıyor. 
- Kargo takip entegrasyonunu API sağlayacak.

### **3. İletişim**
- cihaz sahibi ve bulan kişi kişisel bilgileri gizlenir. Asla paylaşılmaz. 
- Tamamen anonim.

### **4. Zaman Sınırları**
- Ödeme için zaman sınırı Sürecin kilitlenmemesi için 72 saat gibi bir zaman sınırı konulması, cihazı bulan kişinin mağduriyetini önler. Süre dolduğunda eşleşme iptal edilebilir.
- Kargo için zaman sınırı 3 gün
- Onay için otomatik onay süresi 2 gün
Kargo API'sinden "teslim edildi" bilgisi geldikten 48 saat sonra, eğer kullanıcı itiraz etmezse sistemin işlemi otomatik olarak CONFIRMED durumuna geçirmesi, bulan kişinin ödülünü almasını garanti altına alır.

### **5. İptal/İade ve İstisnai Durum Yönetimi**
Platform, sürecin sorunsuz ilerlemediği durumlar için aşağıdaki senaryoları yönetir:

A) Kullanıcı Kaynaklı İptal (Kargo Öncesi)
Senaryo: Cihaz sahibi ödeme yaptıktan sonra ama cihaz henüz kargoya verilmeden önce fikrini değiştirir.
Akış:
Cihaz sahibi "İşlemi İptal Et" talebinde bulunur.
devices.status -> CANCELLED olarak güncellenir.
Escrow'daki para, hizmet bedeli kesintisi yapılarak veya yapılmadan (iş kurallarına göre) cihaz sahibine tam iade edilir.
Cihazı bulan kişiye bildirim gönderilir.

B) Kargo Sürecindeki Sorunlar
Senaryo 1: Teslimat Başarısız (FAILED_DELIVERY)
Neden: Kargo firması API'sinden "adreste bulunamadı", "yanlış adres" gibi bir durum bildirimi gelir.
Akış:
shipments.status -> failed_delivery olarak güncellenir.
devices.status -> FAILED_DELIVERY olarak güncellenir.
Cihaz sahibine "Teslimat Başarısız" bildirimi gönderilir ve adresini kontrol etmesi veya kargo şubesiyle iletişime geçmesi istenir.
Belirli bir süre (örn: 24 saat) içinde sorun çözülmezse, süreç "İade" senaryosuna dönüşebilir.
Senaryo 2: Kargonun İade Edilmesi (RETURNED)
Neden: Teslimat birkaç denemeden sonra başarısız oldu veya alıcı kargoyu kabul etmedi. Kargo firması API'si "iade sürecinde" bilgisi geçer.
Akış:
shipments.status -> returned olarak güncellenir.
devices.status -> RETURNED olarak güncellenir.
Bu, bir admin müdahalesi gerektiren ciddi bir durumdur. Admin paneline bildirim düşer.
Admin, durumu inceledikten sonra paranın kısmi veya tam iadesine karar verir. Genellikle kargo ücreti kesilerek iade yapılır. Cihaz, bulan kişiye geri gönderilir.

C) Cihaz Sahibinin İtirazı (DISPUTED)
Senaryo: Cihaz teslim edildi (delivered) ancak cihaz sahibi "Sorun Var, İtiraz Et" butonuna bastı (yanlış cihaz, hasarlı vb.).
Akış:
devices.status -> DISPUTED olarak güncellenir.
Escrow'daki para kilitli kalır.
Admin incelemesi başlar ve süreci karara bağlar.

### **6. Güvenlik**
- Kimlik doğrulama zorunlu mu?
- Dolandırıcılık önleme var mı?
- Sahte cihaz kontrolü: kayıp cihaz kaydı sırasında cihazın faturası isteniliyor. 
- Sahte seri numarası kontrolü: Kayıp ilanı sırasında istenilen fatura ile kontrol sağlanacak. 
- Aynı kullanıcı, aynı model seri numaralı cihazı hem kayıp hem bulunan cihaz olarak kaydedemez.
- Aynı kullanıcı bir günde 2 den fazla bulunan cihaz kaydedemez. Sürekli bulunan cihaz kaydı gerçekleştiren hesaplar incelemeye alınır. 

### **7. Ödeme Transfer**
- Bulan kişiye para nasıl transfer ediliyor?
- Ödeme sağlayıcı ile yapılıyor
- IBAN'a otomatik transfer
- Transfer süresi Bu, kullanılan ödeme sağlayıcısına bağlıdır. Genellikle "1-3 iş günü" sürer. Kullanıcıya bu yönde bir bilgilendirme yapılmalıdır.
- Transfer ücreti yok

### **8. Bildirimler**
Hangi aşamalarda hangi bildirimler gidiyor?
- In-app notification
- Push notification (mobil için)

Bildirim Matrisi, süreç kontrol edilip onaylanacak

Olay	                                      Alıcı	Mesaj             Anahtarı	                                Tip
Cihaz kaydedildi	                          Kayıt eden	        device_registered	                            info
Eşleşme bulundu	                            Her iki taraf	      device_matched_owner / device_matched_finder	success
Ödeme bekleniyor	                          Cihaz sahibi	      payment_reminder	                            warning
Ödeme alındı	                              Bulan kişi	        payment_received_please_ship	                success
Teslim kodu oluşturuldu	                    Bulan kişi	        delivery_code_ready	                          info
Kargoya verildi	                            Cihaz sahibi	      package_shipped	                              info
Kargo yolda	                                Her iki taraf	      package_in_transit	                          info
Teslim edildi	                              Cihaz sahibi	      package_delivered_confirm	                    warning
Otomatik onay yaklaşıyor (24 saat kaldı)	  Cihaz sahibi	      auto_confirm_reminder	                        warning
Onay verildi	                              Bulan kişi	        reward_released	                              success
Para transfer edildi	                      Bulan kişi	        reward_transferred	                          success


### **9. Ücret Hesaplama** 
- Gateway komisyonu: %3.43 (toplam üzerinden)
- Kargo ücreti sabit: 250.00 TL
- Bulan kişi ödülü: %20 (toplam üzerinden)
- Hizmet bedeli: Geriye kalan tutar
- Net payout hesaplama formülü:
  ```
  totalAmount = ifoundanapple_fee (müşteriden alınacak toplam)
  gatewayFee = totalAmount * 0.0343
  cargoFee = 250.00 TL
  rewardAmount = totalAmount * 0.20
  serviceFee = totalAmount - gatewayFee - cargoFee - rewardAmount
  netPayout = rewardAmount

### **10. Escrow Release Conditions**
Escrow'u serbest bırakacak koşullar:

**A. Manuel Onay:**
- Cihaz sahibinin "Onayla" butonuna basması
- `delivery_confirmations` kaydı oluşturulması
- `confirmation_type` = 'device_received'

**B. Otomatik Onay:**
- Kargonun teslim edilmesinden (`cargo_shipments.delivered_at`) itibaren 48 saat geçmesi
- Bu süre içinde kullanıcıdan itiraz gelmemesi (`devices.status` != 'disputed')
- Sistem otomatik olarak `delivery_confirmations` kaydı oluşturur
- `confirmation_type` = 'timeout_release'

**C. Admin Manuel Serbest Bırakma:**
- Admin panelinden manuel olarak escrow serbest bırakılabilir
- `confirmation_type` = 'manual_release'
- Sadece admin kullanıcılar bu işlemi yapabilir

**Release API Çağrısı:**
```typescript
await releaseEscrowAPI({
  paymentId: string,
  deviceId: string,
  releaseReason: string,
  confirmationType: 'device_received' | 'timeout_release' | 'manual_release',
  confirmedBy: string, // User ID
  additionalNotes?: string
});
```

### **11. Eşleşme Mantığı**

**Eşleştirme Kriterleri:**
- Aynı `model` (büyük/küçük harf duyarsız)
- Aynı `serialNumber` (büyük/küçük harf duyarsız)
- Farklı `userId` (aynı kullanıcı kendi cihazı ile eşleşemez)
- Biri `status = 'lost'`, diğeri `status = 'reported'` olmalı

**Güvenlik Kısıtlamaları:**
- Aynı kullanıcı, aynı model ve seri numaralı cihazı hem kayıp hem bulunan olarak kaydedemez (uygulama seviyesinde kontrol)
- Veritabanı seviyesinde `UNIQUE` constraint önerilmez çünkü aynı cihaz hem kayıp hem bulunan olarak kaydedilebilir (farklı kullanıcılar tarafından)
- Sistem, eşleşme bulunduğunda her iki cihazın `status`'unu `'matched'` olarak günceller

**Eşleştirme Kodu (AppContext.tsx - addDevice fonksiyonu):**
```typescript
// Yeni cihaz LOST ise, REPORTED olanı ara
if (newDevice.status === DeviceStatus.LOST) {
  const { data: matchedData } = await supabase
    .from("devices")
    .select("*")
    .eq("status", DeviceStatus.REPORTED)
    .eq("serialNumber", newDevice.serialNumber)
    .eq("model", newDevice.model)
    .neq("userId", newDevice.userId)
    .maybeSingle();
}

// Yeni cihaz REPORTED ise, LOST olanı ara
if (newDevice.status === DeviceStatus.REPORTED) {
  const { data: matchedData } = await supabase
    .from("devices")
    .select("*")
    .eq("status", DeviceStatus.LOST)
    .eq("serialNumber", newDevice.serialNumber)
    .eq("model", newDevice.model)
    .neq("userId", newDevice.userId)
    .maybeSingle();
}
```


### **12. Admin Paneli**
- Admin hangi aşamalara müdahale edebiliyor?
- Manuel escrow release yapabiliyor mu?
- İtirazları admin çözüyor
- İptal/iade işlemlerini admin yapıyor

---


## 🔄 SÜREÇ AKIŞ DİYAGRAMI


CİHAZ SAHİBİ                           SİSTEM                           CİHAZ BULAN
   ─────────────                          ──────                           ───────────

Cihaz Ekle (Kaybettim)                                                  		Cihaz Ekle (Buldum)
      ↓                                                                  		      ↓
     LOST ───────────────────────→   Eşleştirme Yap   ←────────────────────── REPORTED
      ↓                                    	  ↓                                		 ↓
   MATCHED  ←────────────────────────── Eşleşme Bildir ──────────────────────→ MATCHED
      ↓                                                                     			 ↓
  Ödeme Yap                                                            			 Ödeme Bekleniyor
      ↓                                                                     		         ↓
      └────────────────────────→   Ödemeyi Escrow'a Al   ───────────────────────┘
                                         	  ↓
payment_completed ←────────────────── Escrow'da Tutuluyor ─────────────────→ payment_completed
      ↓                                		  ↓                              	         ↓
 Kargo Bekleniyor                 	   Kargo Firması API → Teslim Kodu Oluştur → Teslim Kodu Alındı
      ↓                                   	   ↓                            	         ↓
      └───────────────────────   Kargoya Verilmesini Bekle   ────────────────→ Cihazı Kargola
                              		  (Kargo API'si dinleniyor)                 	         ↓
                                        	   ↓
 CARGO_SHIPPED ←────────────────── Kargo Takip Numarası Alındı ──────────────→ CARGO_SHIPPED
      ↓                              		     ↓                       		         ↓
  Kargo Takip Ediliyor                  Teslimat Takip Ediliyor            		  Teslimat Bekleniyor
      ↓                                		      ↓                        		         ↓
  DELIVERED ←─────────────────────── Teslim Edildi Bildirimi ────────────────→ DELIVERED
      ↓                                                                    			 ↓
   Onay Ver                                                               		    Onay Bekleniyor
      ↓
      └──────────────────────────┐
                               		  ↓
   CONFIRMED ←──────────────── Onay Alındı
                              	          ↓
                      	         Escrow Serbest Bırak
                                          ↓
                         Ödemeleri Dağıt (Ödül, Komisyon...)
                                          ↓
   COMPLETED ←────────────────── İşlem Tamamlandı ───────────────────────→ COMPLETED

