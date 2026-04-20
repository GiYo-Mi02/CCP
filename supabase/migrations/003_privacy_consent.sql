-- Add Data Privacy consent tracking to profiles.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS privacy_consented_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_consent_version TEXT;

COMMENT ON COLUMN profiles.privacy_consented_at IS 'Timestamp when the user agreed to CCP Data Privacy Consent.';
COMMENT ON COLUMN profiles.privacy_consent_version IS 'Version identifier of the consent text agreed by the user.';
