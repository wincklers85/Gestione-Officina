CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'mechanic',
  internal_hourly_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
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
ALTER TABLE workshop_settings ADD COLUMN IF NOT EXISTS labs_3d_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE workshop_settings ADD COLUMN IF NOT EXISTS customer_display_enabled BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS workshop_resources (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  resource_type TEXT NOT NULL DEFAULT 'workstation',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
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
  duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes BETWEEN 15 AND 720),
  assigned_user_id BIGINT REFERENCES users(id),
  resource_id BIGINT REFERENCES workshop_resources(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  notes TEXT NOT NULL DEFAULT '',
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS assigned_user_id BIGINT REFERENCES users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS resource_id BIGINT REFERENCES workshop_resources(id);
CREATE INDEX IF NOT EXISTS bookings_calendar_idx ON bookings(starts_at,status);
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
  billable BOOLEAN NOT NULL DEFAULT TRUE,
  bill_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  internal_cost_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  adjusted_seconds INTEGER,
  note TEXT NOT NULL DEFAULT '',
  correction_reason TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_timer_per_user ON time_entries(user_id) WHERE stopped_at IS NULL;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS billable BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS bill_rate NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS internal_cost_rate NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS adjusted_seconds INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS internal_hourly_cost NUMERIC(10,2) NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS time_entry_adjustments (
  id BIGSERIAL PRIMARY KEY,
  time_entry_id BIGINT NOT NULL REFERENCES time_entries(id),
  original_seconds INTEGER,
  corrected_seconds INTEGER,
  original_billable BOOLEAN,
  corrected_billable BOOLEAN,
  reason TEXT NOT NULL,
  changed_by BIGINT REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS estimates (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  version INTEGER NOT NULL DEFAULT 1,
  estimate_type TEXT NOT NULL DEFAULT 'initial',
  status TEXT NOT NULL DEFAULT 'draft',
  valid_until DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, version)
);
ALTER TABLE estimates ADD COLUMN IF NOT EXISTS estimate_type TEXT NOT NULL DEFAULT 'initial';
CREATE TABLE IF NOT EXISTS customer_action_tokens (
  id BIGSERIAL PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  estimate_id BIGINT NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customer_portal_tokens (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_action_tokens_estimate_idx ON customer_action_tokens(estimate_id,expires_at);
CREATE TABLE IF NOT EXISTS estimate_customer_responses (
  id BIGSERIAL PRIMARY KEY,
  estimate_id BIGINT NOT NULL REFERENCES estimates(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  responded_by TEXT NOT NULL,
  estimate_version INTEGER NOT NULL,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb
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
ALTER TABLE documents ADD COLUMN IF NOT EXISTS estimate_id BIGINT REFERENCES estimates(id);
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
CREATE TABLE IF NOT EXISTS intake_photos (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('exterior','interior','dashboard')),
  station TEXT NOT NULL,
  damage_marks JSONB NOT NULL DEFAULT '[]'::jsonb,
  captured_by BIGINT REFERENCES users(id),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS intake_photos_order_idx ON intake_photos(work_order_id,category,station);
CREATE TABLE IF NOT EXISTS intake_acceptances (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  signed_name TEXT NOT NULL,
  terms_text TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  privacy_text TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  terms_accepted BOOLEAN NOT NULL,
  privacy_acknowledged BOOLEAN NOT NULL,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  profiling_consent BOOLEAN NOT NULL DEFAULT FALSE,
  repair_email_consent BOOLEAN NOT NULL DEFAULT FALSE,
  road_test_decision TEXT NOT NULL CHECK (road_test_decision IN ('authorized','refused')),
  terms_signature BYTEA,
  privacy_signature BYTEA,
  signature_method TEXT NOT NULL CHECK (signature_method IN ('tablet','paper')),
  preagreed_service TEXT NOT NULL DEFAULT '',
  preagreed_price NUMERIC(10,2),
  created_by BIGINT REFERENCES users(id),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS intake_acceptances_order_idx ON intake_acceptances(work_order_id,accepted_at DESC);
CREATE TABLE IF NOT EXISTS customer_screen_sessions (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL DEFAULT 'consent' CHECK (mode IN ('consent','complete','closed')),
  terms_text TEXT NOT NULL,
  privacy_text TEXT NOT NULL,
  created_by BIGINT REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vehicle_reconstructions (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','complete','failed')),
  current_stage TEXT NOT NULL DEFAULT 'queued',
  input_photo_count INTEGER NOT NULL CHECK (input_photo_count >= 20),
  result_glb BYTEA,
  error_message TEXT NOT NULL DEFAULT '',
  queued_by BIGINT REFERENCES users(id),
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
ALTER TABLE vehicle_reconstructions ADD COLUMN IF NOT EXISTS current_stage TEXT NOT NULL DEFAULT 'queued';
CREATE INDEX IF NOT EXISTS vehicle_reconstructions_queue_idx ON vehicle_reconstructions(status,queued_at) WHERE status='queued';
CREATE TABLE IF NOT EXISTS photogrammetry_worker_status (
  id INTEGER PRIMARY KEY CHECK (id=1),
  last_seen TIMESTAMPTZ NOT NULL,
  worker_version TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS privacy_requests (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id),
  request_type TEXT NOT NULL CHECK (request_type IN ('access','export','rectification','deletion','restriction','objection','other')),
  requester TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','in_review','completed','rejected')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at DATE,
  completed_at TIMESTAMPTZ,
  handled_by BIGINT REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS role_module_permissions (
  id BIGSERIAL PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('manager','reception','mechanic','warehouse','accounting','accountant')),
  module TEXT NOT NULL CHECK (module IN ('customers','bookings','orders','inventory','billing','reports','team','settings','privacy')),
  allowed BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by BIGINT REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role,module)
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

-- GO platform tenancy and control plane. Existing single-shop data is moved
-- into the first workshop; subsequent records are scoped by PostgreSQL RLS.
CREATE TABLE IF NOT EXISTS workshops (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','suspended','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_admins (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS registration_requests (
  id BIGSERIAL PRIMARY KEY,
  workshop_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by BIGINT REFERENCES platform_admins(id),
  review_note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS licenses (
  id BIGSERIAL PRIMARY KEY,
  workshop_id BIGINT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','expired','cancelled')),
  created_by BIGINT REFERENCES platform_admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS licenses_workshop_expiry_idx ON licenses(workshop_id,expires_at DESC);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Register the existing installation as workshop 1. The single-shop release
-- remains available while the owner configures the platform superuser.
INSERT INTO workshops(id,name,status) VALUES(1,'GO Gestione Officina','active') ON CONFLICT(id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('workshops','id'), greatest((SELECT coalesce(max(id),1) FROM workshops),1), true);
INSERT INTO licenses(workshop_id,starts_at,expires_at,status)
SELECT 1,now(),now()+interval '100 years','active'
WHERE NOT EXISTS (SELECT 1 FROM licenses WHERE workshop_id=1 AND status='active');

-- Add tenant ownership to each existing business record and retain all current
-- rows under the original workshop. Defaults use the authenticated request's
-- database context; policy checks reject caller supplied foreign tenant IDs.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','workshop_settings','workshop_resources','customers','vehicles','bookings','work_orders',
    'work_operations','operation_assignments','time_entries','time_entry_adjustments','estimates','customer_action_tokens','customer_portal_tokens','estimate_customer_responses','estimate_lines',
    'inventory_items','stock_movements','inventory_reservations','suppliers','purchase_orders',
    'purchase_order_lines','invoices','invoice_lines','payments','quality_checks','road_tests',
    'documents','document_acceptances','intake_photos','intake_acceptances','customer_screen_sessions','vehicle_reconstructions','privacy_requests','role_module_permissions','vehicle_deliveries','audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS workshop_id BIGINT',t);
    EXECUTE format('UPDATE %I SET workshop_id=1 WHERE workshop_id IS NULL',t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN workshop_id SET NOT NULL',t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN workshop_id SET DEFAULT nullif(current_setting(''app.workshop_id'',true),'''')::bigint',t);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=t||'_workshop_id_fkey') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (workshop_id) REFERENCES workshops(id)',t,t||'_workshop_id_fkey');
    END IF;
  END LOOP;
END $$;

-- Settings use (workshop_id, id), so every tenant can keep the existing id=1
-- convention while the request is isolated by RLS.
ALTER TABLE workshop_settings DROP CONSTRAINT IF EXISTS workshop_settings_pkey;
ALTER TABLE workshop_settings ADD PRIMARY KEY (workshop_id,id);
INSERT INTO workshop_settings(id,workshop_id) VALUES(1,1) ON CONFLICT(workshop_id,id) DO NOTHING;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','workshop_settings','workshop_resources','customers','vehicles','bookings','work_orders',
    'work_operations','operation_assignments','time_entries','time_entry_adjustments','estimates','customer_action_tokens','customer_portal_tokens','estimate_customer_responses','estimate_lines',
    'inventory_items','stock_movements','inventory_reservations','suppliers','purchase_orders',
    'purchase_order_lines','invoices','invoice_lines','payments','quality_checks','road_tests',
    'documents','document_acceptances','intake_photos','intake_acceptances','customer_screen_sessions','vehicle_reconstructions','privacy_requests','role_module_permissions','vehicle_deliveries','audit_log','licenses'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I',t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (current_setting(''app.platform_admin'',true)=''true'' OR workshop_id=nullif(current_setting(''app.workshop_id'',true),'''')::bigint) WITH CHECK (current_setting(''app.platform_admin'',true)=''true'' OR workshop_id=nullif(current_setting(''app.workshop_id'',true),'''')::bigint)',t);
  END LOOP;
END $$;
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE workshops FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON workshops;
CREATE POLICY tenant_isolation ON workshops
  USING (current_setting('app.platform_admin',true)='true' OR id=nullif(current_setting('app.workshop_id',true),'')::bigint)
  WITH CHECK (current_setting('app.platform_admin',true)='true' OR id=nullif(current_setting('app.workshop_id',true),'')::bigint);

ALTER TABLE registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_requests FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS registration_submit ON registration_requests;
CREATE POLICY registration_submit ON registration_requests
  FOR INSERT WITH CHECK (status='pending' AND reviewed_by IS NULL AND reviewed_at IS NULL);
DROP POLICY IF EXISTS registration_admin ON registration_requests;
CREATE POLICY registration_admin ON registration_requests
  USING (current_setting('app.platform_admin',true)='true')
  WITH CHECK (current_setting('app.platform_admin',true)='true');
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_admin_access ON platform_admins;
CREATE POLICY platform_admin_access ON platform_admins
  USING (current_setting('app.platform_admin',true)='true')
  WITH CHECK (current_setting('app.platform_admin',true)='true');
