CREATE TABLE IF NOT EXISTS objednavky (
  cislo TEXT PRIMARY KEY,
  vytvorene TEXT NOT NULL,
  aktualizovane TEXT,
  zdroj TEXT,
  sluzba TEXT NOT NULL,
  pocet INTEGER DEFAULT 0,
  styl TEXT,
  s_videom INTEGER DEFAULT 0,
  video TEXT,
  novy INTEGER DEFAULT 0,
  kod TEXT,
  meno TEXT,
  email TEXT,
  telefon TEXT,
  inzerat TEXT,
  poznamka TEXT,
  cena REAL DEFAULT 0,
  stav TEXT DEFAULT 'nova',
  zaplatene INTEGER DEFAULT 0,
  platba TEXT,
  fotky TEXT DEFAULT '[]',
  vysledky TEXT DEFAULT '[]',
  interna TEXT,
  token TEXT
);
CREATE INDEX IF NOT EXISTS idx_obj_stav ON objednavky(stav);
CREATE INDEX IF NOT EXISTS idx_obj_vytvorene ON objednavky(vytvorene);
CREATE TABLE IF NOT EXISTS historia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cislo TEXT NOT NULL,
  cas TEXT NOT NULL,
  udalost TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hist_cislo ON historia(cislo);
