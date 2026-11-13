CREATE TABLE klimych_runs (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id),
 level_id text NOT NULL CHECK(level_id IN ('stool','tap','shelf','door','drawer')),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 result jsonb,
 CHECK((result IS NULL)=(finished_at IS NULL))
);
CREATE INDEX klimych_runs_user ON klimych_runs(user_id,started_at);
UPDATE buildings SET module_id='klimych' WHERE id='building-klimych' AND brand_id='klimych';
UPDATE designs SET image='/assets/klimych/tools/'||lpad(slot::text,2,'0')||'.png' WHERE brand_id='klimych';
