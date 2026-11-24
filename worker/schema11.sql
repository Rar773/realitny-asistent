-- čítanie listov vlastníctva: len čas a odtlačok IP kvôli limitu, obsah sa neukladá
CREATE TABLE IF NOT EXISTS lv_log (id INTEGER PRIMARY KEY AUTOINCREMENT, cas TEXT NOT NULL, ip_h TEXT);
CREATE INDEX IF NOT EXISTS lv_log_cas ON lv_log (cas);
