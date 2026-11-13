CREATE TABLE users (
 id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), first_building text,
 is_test boolean NOT NULL DEFAULT false
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE districts (id text PRIMARY KEY, name text NOT NULL, position integer NOT NULL UNIQUE CHECK(position BETWEEN 0 AND 3));
CREATE TABLE brands (
 id text PRIMARY KEY, name text NOT NULL UNIQUE, mascot text NOT NULL, archetype text NOT NULL,
 personality text NOT NULL, world_role text NOT NULL, collection_theme text NOT NULL,
 source_ref text NOT NULL
);
CREATE TABLE buildings (
 id text PRIMARY KEY, brand_id text NOT NULL UNIQUE REFERENCES brands(id), district_id text NOT NULL REFERENCES districts(id),
 name text NOT NULL, position integer NOT NULL CHECK(position BETWEEN 0 AND 3), module_id text NOT NULL,
 provisional boolean NOT NULL DEFAULT true, UNIQUE(district_id, position)
);
ALTER TABLE users ADD CONSTRAINT first_building_fk FOREIGN KEY(first_building) REFERENCES buildings(id);
CREATE TABLE designs (
 id text PRIMARY KEY, brand_id text NOT NULL REFERENCES brands(id), slot integer NOT NULL CHECK(slot BETWEEN 1 AND 16),
 name text NOT NULL, image text, effect jsonb NOT NULL DEFAULT '{"kind":"collect"}',
 UNIQUE(brand_id,slot), CHECK(jsonb_typeof(effect) = 'object')
);
CREATE TABLE story_scenes (
 id text PRIMARY KEY, brand_id text NOT NULL REFERENCES brands(id), kind text NOT NULL CHECK(kind IN ('intro','meeting')),
 script jsonb NOT NULL, UNIQUE(brand_id,kind)
);
CREATE TABLE qr_tokens (
 id uuid PRIMARY KEY, token_hash text NOT NULL UNIQUE, design_id text NOT NULL REFERENCES designs(id),
 is_test boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz, used_by uuid REFERENCES users(id), used_at timestamptz,
 CHECK((used_by IS NULL) = (used_at IS NULL))
);
CREATE TABLE qr_activations (
 id uuid PRIMARY KEY, token_id uuid NOT NULL UNIQUE REFERENCES qr_tokens(id), user_id uuid NOT NULL REFERENCES users(id),
 design_id text NOT NULL REFERENCES designs(id), duplicate boolean NOT NULL, reward bigint NOT NULL CHECK(reward >= 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE user_collection (
 user_id uuid NOT NULL REFERENCES users(id), design_id text NOT NULL REFERENCES designs(id),
 acquired_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id, design_id)
);
CREATE TABLE unlocked_buildings (
 user_id uuid NOT NULL REFERENCES users(id), building_id text NOT NULL REFERENCES buildings(id),
 unlocked_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id, building_id)
);
CREATE TABLE unlocked_districts (
 user_id uuid NOT NULL REFERENCES users(id), district_id text NOT NULL REFERENCES districts(id),
 PRIMARY KEY(user_id, district_id)
);
CREATE TABLE user_scenes (
 user_id uuid NOT NULL REFERENCES users(id), scene_id text NOT NULL REFERENCES story_scenes(id),
 choices jsonb, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id, scene_id)
);
CREATE TABLE game_progress (
 user_id uuid PRIMARY KEY REFERENCES users(id), data jsonb NOT NULL DEFAULT '{}', revision integer NOT NULL DEFAULT 0
);
CREATE TABLE wallets (
 user_id uuid PRIMARY KEY REFERENCES users(id), balance bigint NOT NULL DEFAULT 0 CHECK(balance >= 0)
);
CREATE TABLE coin_ledger (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), activation_id uuid UNIQUE REFERENCES qr_activations(id),
 amount bigint NOT NULL CHECK(amount >= 0), reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE module_saves (
 user_id uuid NOT NULL REFERENCES users(id), building_id text NOT NULL REFERENCES buildings(id),
 data jsonb NOT NULL, revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id, building_id)
);
CREATE TABLE legacy_imports (
 user_id uuid PRIMARY KEY REFERENCES users(id), data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE module_events (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), building_id text NOT NULL REFERENCES buildings(id),
 activation_id uuid NOT NULL UNIQUE REFERENCES qr_activations(id), data jsonb NOT NULL
);
