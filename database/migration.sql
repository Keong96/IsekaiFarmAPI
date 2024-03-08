CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table: public.farms

-- DROP TABLE IF EXISTS public.farms;

CREATE TABLE IF NOT EXISTS public.farms
(
    id integer NOT NULL DEFAULT nextval('farm_id_seq'::regclass),
    uid integer NOT NULL,
    type smallint NOT NULL,
    crop_field json NOT NULL,
    level integer NOT NULL DEFAULT 1,
    facility json,
    biome integer NOT NULL DEFAULT 0,
    CONSTRAINT farm_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.farms
    OWNER to isekaifarm_user;

COMMENT ON COLUMN public.farms.type
    IS '0 = 4x4
1 = 6x6
2 = 8x8';

-- Table: public.inventory

-- DROP TABLE IF EXISTS public.inventory;

CREATE TABLE IF NOT EXISTS public.inventory
(
    id bigint NOT NULL,
    uid integer NOT NULL,
    plant_id integer NOT NULL,
    type integer NOT NULL,
    created_at timestamp without time zone,
    lifetime integer,
    status smallint NOT NULL DEFAULT 0,
    sold_at timestamp without time zone,
    sold_price numeric(10,2),
    CONSTRAINT inventory_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.inventory
    OWNER to isekaifarm_user;

COMMENT ON COLUMN public.inventory.type
    IS '0 = seed
1 = fruit
2 = other';

COMMENT ON COLUMN public.inventory.status
    IS '0 = available
1 = sold
2 = rotted';

-- Table: public.plants

-- DROP TABLE IF EXISTS public.plants;

CREATE TABLE IF NOT EXISTS public.plants
(
    id bigint NOT NULL DEFAULT nextval('users_id_seq'::regclass),
    plant_name character varying COLLATE pg_catalog."default" NOT NULL,
    plant_type integer NOT NULL,
    growth_stage smallint NOT NULL DEFAULT 0,
    growth_point integer NOT NULL DEFAULT 0,
    water_point integer NOT NULL DEFAULT 0,
    "Is_fertilized" smallint NOT NULL DEFAULT 0,
    created_at timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone,
    harvested_at timestamp without time zone,
    CONSTRAINT plants_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.plants
    OWNER to isekaifarm_user;

COMMENT ON COLUMN public.plants.growth_stage
    IS '0 = germination stage
1 = seedling stage
2 = flowering stage
3 = fruiting stage';

-- Table: public.settings

-- DROP TABLE IF EXISTS public.settings;

CREATE TABLE IF NOT EXISTS public.settings
(
    id integer NOT NULL DEFAULT nextval('users_id_seq'::regclass),
    key character varying(255) COLLATE pg_catalog."default",
    value json,
    CONSTRAINT settings_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.settings
    OWNER to isekaifarm_user;

-- Table: public.users

-- DROP TABLE IF EXISTS public.users;

CREATE TABLE IF NOT EXISTS public.users
(
    id bigint NOT NULL DEFAULT nextval('users_id_seq'::regclass),
    username character varying(50) COLLATE pg_catalog."default" NOT NULL,
    email character varying(100) COLLATE pg_catalog."default" NOT NULL,
    password text COLLATE pg_catalog."default" NOT NULL,
    token text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    status smallint NOT NULL DEFAULT 1,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_username_key UNIQUE (username)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.users
    OWNER to isekaifarm_user;

COMMENT ON COLUMN public.users.status
    IS '0 = inactive
1 = active
2 = banned';