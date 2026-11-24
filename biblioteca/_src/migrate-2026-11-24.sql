-- Библиотека: «что дала» у каждой вещи и «ответ полкой» (решение Игоря 24.11.2026, пункты 3, 4, 6).
-- Запускать в D1 «biblioteca» ДО обновления воркера: новый код пишет items.gives и shelves.ref.
-- Старый воркер новые поля не трогает — порядок «сначала база, потом код» безопасен.
-- Почта по желанию: shelves.email уже допускает NULL (UNIQUE пропускает несколько NULL) — менять схему не нужно.
ALTER TABLE items ADD COLUMN gives TEXT;
ALTER TABLE shelves ADD COLUMN ref TEXT;
CREATE INDEX IF NOT EXISTS shelves_ref ON shelves(ref);
