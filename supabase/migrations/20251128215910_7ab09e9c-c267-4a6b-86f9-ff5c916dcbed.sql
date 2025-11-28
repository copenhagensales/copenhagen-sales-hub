-- Update import function to support team assignment
CREATE OR REPLACE FUNCTION import_historical_candidate_with_team(
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_status application_status,
  p_source TEXT,
  p_notes TEXT,
  p_application_date DATE,
  p_team_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_candidate_id UUID;
  v_existing_candidate UUID;
  v_application_id UUID;
  v_team_id UUID;
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
  
  -- Try to find team by name if provided and status is "ansat"
  IF p_team_name IS NOT NULL AND p_status = 'ansat' THEN
    SELECT id INTO v_team_id
    FROM teams
    WHERE LOWER(name) = LOWER(p_team_name)
    LIMIT 1;
  END IF;
  
  -- Create application as salgskonsulent with original status and team
  INSERT INTO applications (
    candidate_id, 
    role, 
    status, 
    source, 
    notes, 
    application_date,
    team_id,
    hired_date
  )
  VALUES (
    v_candidate_id, 
    'salgskonsulent', 
    p_status, 
    COALESCE(p_source, 'Hjemmesiden'), 
    COALESCE(p_notes, ''), 
    p_application_date,
    v_team_id,
    CASE WHEN p_status = 'ansat' THEN p_application_date ELSE NULL END
  )
  RETURNING id INTO v_application_id;
  
  RETURN jsonb_build_object(
    'status', 'success',
    'candidate_id', v_candidate_id,
    'application_id', v_application_id,
    'team_assigned', v_team_id IS NOT NULL
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'status', 'error',
      'message', SQLERRM
    );
END;
$$;