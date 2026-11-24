-- online potvrdenie zmlúv o sprostredkovaní (nepotvrdené sa mažú po 60 dňoch, potvrdené po 13 mesiacoch)
CREATE TABLE IF NOT EXISTS zmluvy_online (
  id TEXT PRIMARY KEY, skupina TEXT NOT NULL, token_h TEXT NOT NULL, kluc_h TEXT NOT NULL,
  nazov TEXT, html TEXT NOT NULL, obsah_hash TEXT,
  makler_meno TEXT, makler_email TEXT, makler_tel TEXT, klient_meno TEXT, klient_email TEXT,
  stav TEXT NOT NULL DEFAULT 'caka', vytvorena TEXT NOT NULL, otvorena TEXT,
  potvrdena TEXT, potvrdil_meno TEXT, potvrdil_ip TEXT, potvrdil_ua TEXT, potvrdene_kodom INTEGER DEFAULT 0,
  kod_h TEXT, kod_cas TEXT, kod_pokusy INTEGER DEFAULT 0, ip_h TEXT);
CREATE INDEX IF NOT EXISTS zmo_skupina ON zmluvy_online (skupina);
CREATE INDEX IF NOT EXISTS zmo_vytvorena ON zmluvy_online (vytvorena);
