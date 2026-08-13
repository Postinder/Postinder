ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(4),
  ADD COLUMN IF NOT EXISTS document_number VARCHAR(14);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'clients_document_pair_check'
      AND conrelid = 'clients'::regclass
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT clients_document_pair_check
      CHECK (
        (document_type IS NULL AND document_number IS NULL)
        OR (
          document_type = 'cpf'
          AND document_number ~ '^[0-9]{11}$'
        )
        OR (
          document_type = 'cnpj'
          AND document_number ~ '^[0-9]{14}$'
        )
      );
  END IF;
END
$$;
