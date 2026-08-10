CREATE TABLE IF NOT EXISTS platform_settings (
  singleton_key BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton_key),
  executed_attachment_retention_hours INTEGER NOT NULL DEFAULT 24,
  soundtrack_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  client_field_policies JSONB NOT NULL DEFAULT '{"whatsapp":"optional","segment":"optional","deadline_days":"optional","document":"hidden"}'::jsonb,
  post_field_policies JSONB NOT NULL DEFAULT '{"description":"optional","scheduled_date":"optional","funnel_tag":"optional"}'::jsonb,
  portal_show_post_list BOOLEAN NOT NULL DEFAULT FALSE,
  portal_show_supplementary_info BOOLEAN NOT NULL DEFAULT FALSE,
  portal_sequential_approval BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT platform_settings_retention_hours_check
    CHECK (executed_attachment_retention_hours BETWEEN 1 AND 8760),
  CONSTRAINT platform_settings_client_policies_object_check
    CHECK (
      jsonb_typeof(client_field_policies) = 'object'
      AND client_field_policies ?& ARRAY['whatsapp', 'segment', 'deadline_days', 'document']
      AND client_field_policies - ARRAY['whatsapp', 'segment', 'deadline_days', 'document'] = '{}'::jsonb
      AND client_field_policies->>'whatsapp' IN ('hidden', 'optional', 'required')
      AND client_field_policies->>'segment' IN ('hidden', 'optional', 'required')
      AND client_field_policies->>'deadline_days' IN ('hidden', 'optional', 'required')
      AND client_field_policies->>'document' IN ('hidden', 'optional', 'required')
    ),
  CONSTRAINT platform_settings_post_policies_object_check
    CHECK (
      jsonb_typeof(post_field_policies) = 'object'
      AND post_field_policies ?& ARRAY['description', 'scheduled_date', 'funnel_tag']
      AND post_field_policies - ARRAY['description', 'scheduled_date', 'funnel_tag'] = '{}'::jsonb
      AND post_field_policies->>'description' IN ('hidden', 'optional', 'required')
      AND post_field_policies->>'scheduled_date' IN ('hidden', 'optional', 'required')
      AND post_field_policies->>'funnel_tag' IN ('hidden', 'optional', 'required')
    )
);

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS portal_mode_override VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clients_portal_mode_override_check'
      AND conrelid = 'clients'::regclass
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT clients_portal_mode_override_check
      CHECK (portal_mode_override IS NULL OR portal_mode_override IN ('simplified', 'detailed'));
  END IF;
END $$;

COMMENT ON TABLE platform_settings IS
  'Singleton with global operational preferences for this Postinder installation.';

COMMENT ON COLUMN clients.portal_mode_override IS
  'NULL inherits platform portal defaults; simplified or detailed is an explicit client override.';
