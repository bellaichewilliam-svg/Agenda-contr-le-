-- Mes horaires (08/11/2026) : le patron change ses heures d'ouverture dans son panneau (bouton « 🕘 Mes horaires »).
-- settings.hours = { "0": [8, 23] ou null (fermé), … "6": … } en heures décimales (7.5 = 7 h 30), heure d'Israël.
-- Vide : l'appli garde les horaires de config.js. L'appli client les lit avec les réglages (Pricing.applyHours).
alter table public.settings add column if not exists hours jsonb;
comment on column public.settings.hours is 'Horaires du patron : {"0":[8,23] ou null, … "6":…} (heures décimales, heure d''Israël) ; vide = horaires de config.js';
