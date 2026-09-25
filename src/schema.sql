CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'mechanic',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS workshop_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_name TEXT NOT NULL DEFAULT 'GO Gestione Officina',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  vat_number TEXT NOT NULL DEFAULT '',
  tax_code TEXT NOT NULL DEFAULT '',
  logo_path TEXT NOT NULL DEFAULT '/assets/brand/go-logo.png',
  logo_data BYTEA,
  logo_mime TEXT NOT NULL DEFAULT 'image/png',
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 55,
  repair_terms TEXT NOT NULL DEFAULT '',
  privacy_notice TEXT NOT NULL DEFAULT '',
  document_prefix TEXT NOT NULL DEFAULT 'GO',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE workshop_settings ADD COLUMN IF NOT EXISTS repair_terms TEXT NOT NULL DEFAULT '';
ALTER TABLE workshop_settings ADD COLUMN IF NOT EXISTS privacy_notice TEXT NOT NULL DEFAULT '';
ALTER TABLE workshop_settings ADD COLUMN IF NOT EXISTS document_prefix TEXT NOT NULL DEFAULT 'GO';
ALTER TABLE workshop_settings ADD COLUMN IF NOT EXISTS logo_data BYTEA;
ALTER TABLE workshop_settings ADD COLUMN IF NOT EXISTS logo_mime TEXT NOT NULL DEFAULT 'image/png';
INSERT INTO workshop_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'person',
  name TEXT NOT NULL,
  tax_code TEXT NOT NULL DEFAULT '',
  vat_number TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vehicles (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  plate TEXT NOT NULL,
  vin TEXT NOT NULL DEFAULT '',
  make TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  year INTEGER,
  fuel TEXT NOT NULL DEFAULT '',
  mileage INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicles_plate_idx ON vehicles (upper(plate));
CREATE TABLE IF NOT EXISTS bookings (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  starts_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  notes TEXT NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS work_orders (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  booking_id BIGINT REFERENCES bookings(id),
  status TEXT NOT NULL DEFAULT 'checked_in',
  complaint TEXT NOT NULL DEFAULT '',
  mileage_in INTEGER NOT NULL DEFAULT 0,
  fuel_level TEXT NOT NULL DEFAULT '',
  target_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS work_operations (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  estimated_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS operation_assignments (
  operation_id BIGINT NOT NULL REFERENCES work_operations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  is_lead BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (operation_id, user_id)
);
CREATE TABLE IF NOT EXISTS time_entries (
  id BIGSERIAL PRIMARY KEY,
  operation_id BIGINT NOT NULL REFERENCES work_operations(id),
  user_id BIGINT NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  pause_seconds INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  correction_reason TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_timer_per_user ON time_entries(user_id) WHERE stopped_at IS NULL;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS estimates (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, version)
);
CREATE TABLE IF NOT EXISTS estimate_lines (
  id BIGSERIAL PRIMARY KEY,
  estimate_id BIGINT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 22
);
CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  supplier TEXT NOT NULL DEFAULT '',
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  minimum_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES inventory_items(id),
  work_order_id BIGINT REFERENCES work_orders(id),
  movement_type TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  user_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inventory_reservations (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES inventory_items(id),
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','consumed','released')),
  reserved_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_reservations_active_item_idx ON inventory_reservations(item_id) WHERE status='reserved';
CREATE TABLE IF NOT EXISTS suppliers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  vat_number TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES suppliers(id),
  work_order_id BIGINT REFERENCES work_orders(id),
  status TEXT NOT NULL DEFAULT 'draft',
  ordered_at TIMESTAMPTZ,
  expected_at DATE,
  received_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id BIGSERIAL PRIMARY KEY,
  purchase_order_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id BIGINT REFERENCES inventory_items(id),
  description TEXT NOT NULL,
  quantity_ordered NUMERIC(10,2) NOT NULL DEFAULT 1,
  quantity_received NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  invoice_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT NOT NULL DEFAULT '',
  external_fiscal_id TEXT NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS invoice_lines (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 22
);
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by BIGINT REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS quality_checks (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  label TEXT NOT NULL,
  passed BOOLEAN,
  note TEXT NOT NULL DEFAULT '',
  checked_by BIGINT REFERENCES users(id),
  checked_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS road_tests (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  driver_id BIGINT REFERENCES users(id),
  mileage_start INTEGER NOT NULL DEFAULT 0,
  mileage_end INTEGER,
  result TEXT NOT NULL DEFAULT 'pending',
  notes TEXT NOT NULL DEFAULT '',
  tested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT REFERENCES work_orders(id),
  invoice_id BIGINT REFERENCES invoices(id),
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_data BYTEA NOT NULL,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS document_acceptances (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT REFERENCES work_orders(id),
  customer_id BIGINT REFERENCES customers(id),
  document_type TEXT NOT NULL,
  document_version TEXT NOT NULL,
  accepted BOOLEAN NOT NULL,
  accepted_by TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id BIGINT REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS vehicle_deliveries (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL UNIQUE REFERENCES work_orders(id),
  received_by TEXT NOT NULL,
  mileage_out INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id BIGINT REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
