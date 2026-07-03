
DO $$
DECLARE
  v_uid uuid := 'd0000000-0000-4000-8000-000000000001';
  v_campus uuid := '28cc71d3-2dc9-4e8e-a09e-de57963d0d8d';
BEGIN
  -- Create auth user (trigger handle_new_user creates the profile row)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
    'demo@uga.edu', crypt('LeaseUpDemo!' || gen_random_uuid()::text, gen_salt('bf')),
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name','LeaseUp Demo'),
    now(), now(), '', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  -- Ensure profile exists with the right campus/name (trigger already created it)
  UPDATE public.profiles
    SET name = 'LeaseUp Demo', campus_id = v_campus, verified_email = true
    WHERE id = v_uid;

  -- Skip if listings already seeded
  IF EXISTS (SELECT 1 FROM public.listings WHERE user_id = v_uid) THEN
    RETURN;
  END IF;

  INSERT INTO public.listings (
    user_id, campus_id, title, description, price, beds, baths,
    address, area, available_from, available_to,
    furnished, utilities_included, is_active, verification_tier,
    view_count, created_at
  ) VALUES
  (v_uid, v_campus, 'The Connection — Fully Furnished 2BR',
   'Huge 2BR at The Connection, fully furnished, walking distance to campus. Subletting for summer semester. All utilities included. Quiet building, great pool, gym on site. Perfect for someone who wants to be 5 min from North Campus.',
   650, 2, 2, '325 Broad St', 'Downtown', '2026-08-01', '2026-12-15', true, true, true, 'verified', 47, now() - interval '3 days'),
  (v_uid, v_campus, 'Five Points Studio — $575/mo',
   'Cute studio in Five Points above a coffee shop. Super walkable, 10 min bike to campus. One parking spot included. No pets. Available immediately — need someone to take over my lease ASAP.',
   575, 0, 1, '1435 S Lumpkin St', 'Five Points', '2026-07-15', '2026-12-31', false, false, true, 'basic', 31, now() - interval '5 days'),
  (v_uid, v_campus, 'Milledge Ave House — 1 Room in 4BR',
   'One room available in a 4BR house on Milledge Ave. Living with 3 other UGA seniors. House has a big backyard, fire pit, and parking. Very chill house. Pets okay with approval.',
   520, 1, 1, '780 Milledge Ave', 'Milledge', '2026-08-10', '2027-05-01', false, false, true, 'basic', 89, now() - interval '1 day'),
  (v_uid, v_campus, 'Landmark Athens — 1BR Available',
   'Subletting my 1BR at Landmark Athens. Furnished, great amenities (rooftop pool, gym, study rooms). 10 min walk to Tate Student Center. Price is negotiable.',
   720, 1, 1, '297 E Broad St', 'Downtown', '2026-08-01', '2026-12-15', true, false, true, 'verified', 56, now() - interval '2 days'),
  (v_uid, v_campus, 'Riverbend — 3BR Apt, $600/person',
   'Subletting all 3 rooms in our Riverbend apartment. We are all graduating early. Available together or individual rooms. Shuttle to campus, resort-style amenities. Lease through December.',
   600, 3, 2, '2700 Riverbend Rd', 'West Campus', '2026-07-01', '2026-12-31', true, true, true, 'verified', 122, now() - interval '6 days'),
  (v_uid, v_campus, 'Private Room Near Sanford Stadium',
   'Private room in a 2BR apt, 3 blocks from Sanford. You get your own bathroom. Roommate is a quiet grad student. Great for football season — literally walk to games.',
   680, 1, 1, '465 Baxter St', 'North Campus', '2026-08-15', '2026-12-15', false, false, true, 'basic', 73, now() - interval '4 days'),
  (v_uid, v_campus, 'Graduate Housing Sublease — Quiet 1BR',
   'Subletting my grad student apartment. Very quiet building, mostly grad students and professionals. Parking included. Close to Vet School and College of Agriculture.',
   625, 1, 1, '1030 South Milledge Ave', 'South Campus', '2026-06-01', '2026-07-31', false, true, true, 'basic', 28, now() - interval '7 days'),
  (v_uid, v_campus, 'Furnished Room in Sorority Row House',
   'Room in a house on Milledge, 2 min from sorority row. Furnished, utilities included. Looking for a female roommate. Super social house during football season.',
   590, 1, 1, '925 Milledge Ave', 'Milledge', '2026-08-01', '2027-05-15', true, true, true, 'basic', 44, now() - interval '2 days'),
  (v_uid, v_campus, 'The Standard — Huge 2BR, Only $595/each',
   'Need someone to take over my lease at The Standard Athens. 2BR/2BA, fully furnished, roommate already has someone. Best deal you will find — $595/mo is 20% below market.',
   595, 2, 2, '345 Broad St', 'Downtown', '2026-08-01', '2026-12-31', true, false, true, 'verified', 201, now() - interval '8 days'),
  (v_uid, v_campus, 'Cozy Studio Near Pulaski Street',
   'Affordable studio near Pulaski St bars and restaurants. Perfect for someone who wants to be in the social scene. On-street parking only. Pets negotiable.',
   495, 0, 1, '275 Pulaski St', 'Downtown', '2026-09-01', '2026-12-31', false, false, true, 'basic', 19, now() - interval '1 day');
END $$;
