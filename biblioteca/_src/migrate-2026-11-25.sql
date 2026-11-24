-- Библиотека: схема «Хочу» — тип × состояние (решение Игоря 24.11.2026, 21:02).
-- У вещи состояние st: 'now' (на полке, места 1–5) · 'want' (Хочу прочитать / посмотреть) · 'done' (Было).
-- from_name — чья полка дала вещь («от кого»); url — ссылка (YouTube по ссылке, oEmbed).
-- Запускать в D1 «biblioteca» ДО обновления воркера. Старый воркер новые поля не трогает — порядок «сначала база, потом код» безопасен.
-- Данные не удаляются.
ALTER TABLE items ADD COLUMN st TEXT;
ALTER TABLE items ADD COLUMN from_name TEXT;
ALTER TABLE items ADD COLUMN url TEXT;
-- Существующие вещи: есть место на полке → now, нет → done.
UPDATE items SET st = CASE WHEN pos IS NOT NULL THEN 'now' ELSE 'done' END WHERE st IS NULL;
CREATE INDEX IF NOT EXISTS items_shelf_st ON items(shelf, st);
-- Весточка хозяину полки «Ольга взяла у тебя в планы …»: одна на пару кто–что.
-- Игорю (owner='igor') уходит сразу в бот (sent = время), остальным копится для рассылки (sent IS NULL) — письмо вместе с PU-495.
CREATE TABLE IF NOT EXISTS wants_notify(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,      -- хозяин полки, с которой взяли
  who TEXT NOT NULL,        -- кто взял (адрес его полки)
  who_dn TEXT,              -- подпись того, кто взял
  tkey TEXT NOT NULL,       -- название в нижнем регистре (ключ дубля)
  title TEXT NOT NULL,
  type TEXT,
  created TEXT NOT NULL,
  sent TEXT,
  UNIQUE(owner, who, tkey));
CREATE INDEX IF NOT EXISTS wants_notify_owner ON wants_notify(owner, sent);
