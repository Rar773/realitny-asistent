CREATE TABLE IF NOT EXISTS ambasadori (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vytvorene TEXT NOT NULL,
  stav TEXT NOT NULL DEFAULT 'nova',
  meno TEXT, email TEXT, email_n TEXT, telefon TEXT, telefon_n TEXT,
  pozicia TEXT, kancelaria TEXT, mesto TEXT, roky TEXT, predane TEXT, profil TEXT,
  siet TEXT, kontakty TEXT,
  instagram TEXT, facebook TEXT, linkedin TEXT, tiktok TEXT, youtube TEXT, sledovatelia TEXT,
  ako TEXT, skusenosti TEXT, fakturacia TEXT,
  kod TEXT UNIQUE, schvalene TEXT, interna TEXT, ip_h TEXT, zid_h TEXT
);
CREATE TABLE IF NOT EXISTS provizie (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kod TEXT NOT NULL,
  cislo TEXT NOT NULL,
  suma REAL NOT NULL,
  provizia REAL NOT NULL,
  stav TEXT NOT NULL DEFAULT 'caka',
  vytvorene TEXT NOT NULL,
  splatne TEXT
);
CREATE INDEX IF NOT EXISTS idx_prov_kod ON provizie(kod);
