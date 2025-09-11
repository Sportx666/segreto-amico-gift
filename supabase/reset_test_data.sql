-- Reset function for test data (LOCAL/UAT ONLY)
-- This function clears all test data and reseeds for clean testing state
-- NEVER RUN IN PRODUCTION

CREATE OR REPLACE FUNCTION public.reset_test_data()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_db_name TEXT;
  result_message TEXT;
BEGIN
  -- Safety check: only allow in local/test environments
  SELECT current_database() INTO current_db_name;
  
  -- Prevent accidental execution in production
  IF current_db_name IN ('postgres', 'production', 'prod') THEN
    RAISE EXCEPTION 'SAFETY CHECK: reset_test_data() cannot be run in database: %', current_db_name;
  END IF;
  
  -- Additional safety: check for production indicators
  IF EXISTS (
    SELECT 1 FROM pg_settings 
    WHERE name = 'application_name' 
    AND setting ILIKE '%prod%'
  ) THEN
    RAISE EXCEPTION 'SAFETY CHECK: Production environment detected, reset_test_data() blocked';
  END IF;

  RAISE NOTICE 'Starting test data reset in database: %', current_db_name;
  
  -- Clear all test data in dependency order
  RAISE NOTICE 'Clearing existing test data...';
  
  -- Clear notifications and settings
  DELETE FROM public.notifications WHERE profile_id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222', 
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444'
  );
  
  DELETE FROM public.notification_settings WHERE profile_id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333', 
    '44444444-4444-4444-4444-444444444444'
  );
  
  -- Clear join tokens
  DELETE FROM public.join_tokens WHERE event_id IN (
    'event111-1111-1111-1111-111111111111',
    'event222-2222-2222-2222-222222222222'
  );
  
  -- Clear wishlist items and wishlists
  DELETE FROM public.wishlist_items WHERE event_id IN (
    'event111-1111-1111-1111-111111111111',
    'event222-2222-2222-2222-222222222222'
  );
  
  DELETE FROM public.wishlists WHERE event_id IN (
    'event111-1111-1111-1111-111111111111', 
    'event222-2222-2222-2222-222222222222'
  );
  
  -- Clear assignments and exclusions
  DELETE FROM public.assignments WHERE event_id IN (
    'event111-1111-1111-1111-111111111111',
    'event222-2222-2222-2222-222222222222'
  );
  
  DELETE FROM public.exclusions WHERE event_id IN (
    'event111-1111-1111-1111-111111111111',
    'event222-2222-2222-2222-222222222222'
  );
  
  -- Clear event members
  DELETE FROM public.event_members WHERE event_id IN (
    'event111-1111-1111-1111-111111111111',
    'event222-2222-2222-2222-222222222222'
  );
  
  -- Clear events
  DELETE FROM public.events WHERE id IN (
    'event111-1111-1111-1111-111111111111',
    'event222-2222-2222-2222-222222222222'
  );
  
  -- Clear participants
  DELETE FROM public.participants WHERE id IN (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
  );
  
  -- Clear profiles
  DELETE FROM public.profiles WHERE id IN (
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333', 
    '44444444-4444-4444-4444-444444444444'
  );
  
  RAISE NOTICE 'Test data cleared successfully';
  
  -- Now reseed by reading and executing the seed file content
  -- Note: In practice, you would run the seed_test.sql file separately
  -- This is a placeholder for the reset operation
  
  result_message := 'Test data reset completed in database: ' || current_db_name || 
                   '. Run seed_test.sql to reload test fixtures.';
  
  RAISE NOTICE '%', result_message;
  
  RETURN result_message;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error during reset_test_data(): % %', SQLSTATE, SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users in test environments
-- Comment: This should be further restricted in production-like environments
GRANT EXECUTE ON FUNCTION public.reset_test_data() TO authenticated;

-- Usage examples and documentation
COMMENT ON FUNCTION public.reset_test_data() IS 
'Clears all test seed data for clean testing state. 
ONLY for local/UAT environments - blocked in production.
Usage: SELECT public.reset_test_data(); then run seed_test.sql';