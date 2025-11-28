-- Fix search_path for the import function
CREATE OR REPLACE FUNCTION import_historical_candidate(
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_status application_status,
  p_source TEXT,
  p_notes TEXT,
  p_application_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate_id UUID;
  v_existing_candidate UUID;
BEGIN
  -- Check if candidate already exists by email or phone
  SELECT id INTO v_existing_candidate
  FROM candidates
  WHERE email = p_email OR phone = p_phone
  LIMIT 1;
  
  IF v_existing_candidate IS NOT NULL THEN
    -- Candidate already exists, return duplicate flag
    RETURN jsonb_build_object(
      'status', 'duplicate',
      'candidate_id', v_existing_candidate
    );
  END IF;
  
  -- Create new candidate
  INSERT INTO candidates (first_name, last_name, email, phone, notes)
  VALUES (p_first_name, COALESCE(p_last_name, ''), p_email, p_phone, COALESCE(p_notes, ''))
  RETURNING id INTO v_candidate_id;
  
  -- Create application as salgskonsulent with original status
  INSERT INTO applications (candidate_id, role, status, source, notes, application_date)
  VALUES (v_candidate_id, 'salgskonsulent', p_status, COALESCE(p_source, 'Hjemmesiden'), COALESCE(p_notes, ''), p_application_date);
  
  RETURN jsonb_build_object(
    'status', 'success',
    'candidate_id', v_candidate_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', SQLERRM
    );
END;
$$;