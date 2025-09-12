-- Customers CRM base (owner record) and business linkage (idempotent)
begin;

-- Customers table
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text unique,
  phone text,
  created_at timestamptz default now()
);

-- Add normalized_name column to businesses (generated)
alter table if exists businesses
  add column if not exists normalized_name text generated always as (
    lower(regexp_replace(coalesce(business_name,'') ,'\s+',' ','g'))
  ) stored;

-- Link business to customer
alter table if exists businesses
  add column if not exists customer_id uuid references customers(id);

-- Unique business identity on (normalized_name, city, state)
-- Use a constraint so ON CONFLICT can target columns string
alter table if exists businesses
  add constraint if not exists businesses_identity_uniq unique (normalized_name, city, state);

-- Optional columns on website_previews
alter table if exists website_previews
  add column if not exists slug text;

alter table if exists website_previews
  add column if not exists hero_image_url text;

alter table if exists website_previews
  add column if not exists theme_key text;

commit;
