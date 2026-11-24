CREATE TABLE IF NOT EXISTS vystupy (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cislo TEXT NOT NULL,
  i INTEGER NOT NULL,
  stav TEXT NOT NULL,
  b64 TEXT,
  qa TEXT,
  pokyn TEXT,
  vytvorene TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vyst_cislo ON vystupy(cislo, i);
ALTER TABLE objednavky ADD COLUMN vyroba TEXT;
