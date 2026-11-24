CREATE TABLE IF NOT EXISTS chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cas TEXT NOT NULL, zid TEXT, ip_h TEXT, zdroj TEXT, stranka TEXT,
  otazka TEXT, odpoved TEXT, akcie TEXT, tok_in INTEGER DEFAULT 0, tok_out INTEGER DEFAULT 0, chyba TEXT
);
CREATE INDEX IF NOT EXISTS chat_cas ON chat(cas);
CREATE INDEX IF NOT EXISTS chat_ip ON chat(ip_h, cas);
CREATE INDEX IF NOT EXISTS chat_zid ON chat(zid, cas);
CREATE TABLE IF NOT EXISTS chat_kontakty (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cas TEXT NOT NULL, zid TEXT, ip_h TEXT, zdroj TEXT, meno TEXT, email TEXT, telefon TEXT, sprava TEXT
);
CREATE INDEX IF NOT EXISTS chatk_ip ON chat_kontakty(ip_h, cas);
