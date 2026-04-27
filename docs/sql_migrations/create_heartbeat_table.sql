-- Tablo oluşturma: Supabase projesinin uyku moduna geçmesini engellemek için heartbeat (kalp atışı) verisi tutar.
CREATE TABLE IF NOT EXISTS public._heartbeat (
    id TEXT PRIMARY KEY,
    last_ping TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) ayarları: Sadece admin (service_role) erişebilir.
ALTER TABLE public._heartbeat ENABLE ROW LEVEL SECURITY;

-- Service role için tam yetki (Backend service role key kullanıyor)
CREATE POLICY "Service role has full access to heartbeat" 
ON public._heartbeat 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

-- Açıklama: Bu tablo her 2 günde bir backend tarafından güncellenerek veritabanının aktif kalmasını sağlar.
COMMENT ON TABLE public._heartbeat IS 'Supabase hibernation prevention table.';
