ALTER TABLE objednavky ADD COLUMN email_n TEXT;
ALTER TABLE objednavky ADD COLUMN telefon_n TEXT;
ALTER TABLE objednavky ADD COLUMN ip_h TEXT;
ALTER TABLE objednavky ADD COLUMN novy_ok INTEGER DEFAULT 0;
UPDATE objednavky SET email_n = lower(trim(email)) WHERE email_n IS NULL;
CREATE INDEX IF NOT EXISTS idx_obj_email_n ON objednavky(email_n);
CREATE INDEX IF NOT EXISTS idx_obj_tel_n ON objednavky(telefon_n);
CREATE INDEX IF NOT EXISTS idx_obj_ip_h ON objednavky(ip_h);
