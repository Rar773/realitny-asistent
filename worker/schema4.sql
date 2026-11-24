CREATE TABLE IF NOT EXISTS stopy (
  cislo TEXT NOT NULL,
  druh TEXT NOT NULL,
  hodnota TEXT NOT NULL,
  vytvorene TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stopy ON stopy(druh, hodnota);
INSERT INTO stopy (cislo, druh, hodnota, vytvorene) SELECT cislo, 'email', email_n, vytvorene FROM objednavky WHERE email_n IS NOT NULL AND email_n != '';
INSERT INTO stopy (cislo, druh, hodnota, vytvorene) SELECT cislo, 'tel', telefon_n, vytvorene FROM objednavky WHERE telefon_n IS NOT NULL AND telefon_n != '';
