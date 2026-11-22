-- Библиотека: полка (5) + библиотека участника, имя-подпись (решение Игоря 22.11.2026).
-- Запускать в D1 «biblioteca» ДО обновления воркера: новый код читает items.pos и shelves.dn.
-- Старый воркер новые поля не трогает — порядок «сначала база, потом код» безопасен.
ALTER TABLE items ADD COLUMN pos INTEGER;
ALTER TABLE shelves ADD COLUMN dn TEXT;
CREATE INDEX IF NOT EXISTS items_shelf_pos ON items(shelf, pos);
-- Существующие вещи: первые 5 по порядку добавления — на полку (места 1–5), остальные — в библиотеку.
UPDATE items SET pos = (
  SELECT COUNT(*) FROM items j WHERE j.shelf = items.shelf AND j.id <= items.id
) WHERE (SELECT COUNT(*) FROM items j WHERE j.shelf = items.shelf AND j.id <= items.id) <= 5;
