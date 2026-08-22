
-- Part 1: official names + consistent short names
UPDATE public.campuses SET name = 'Georgia Institute of Technology', short_name = 'Georgia Tech' WHERE slug = 'georgia-tech';
UPDATE public.campuses SET short_name = 'Texas A&M' WHERE slug = 'texas-a-m-university';
UPDATE public.campuses SET short_name = 'Florida' WHERE slug = 'university-of-florida';
UPDATE public.campuses SET name = 'North Carolina State University' WHERE slug = 'nc-state-university';
UPDATE public.campuses SET name = 'University of North Carolina at Chapel Hill' WHERE slug = 'university-of-north-carolina';
UPDATE public.campuses SET short_name = 'South Carolina' WHERE slug = 'university-of-south-carolina';
UPDATE public.campuses SET short_name = 'Tennessee' WHERE slug = 'university-of-tennessee';
UPDATE public.campuses SET name = 'University of Illinois Urbana-Champaign' WHERE slug = 'university-of-illinois';
UPDATE public.campuses SET name = 'University of Wisconsin-Madison' WHERE slug = 'university-of-wisconsin';
UPDATE public.campuses SET name = 'Virginia Polytechnic Institute and State University', short_name = 'Virginia Tech' WHERE slug = 'virginia-tech';

-- Part 2: UVA seed listings
WITH c AS (SELECT id FROM public.campuses WHERE slug = 'university-of-virginia'),
rows(title, area, price, beds, baths, furnished, util, pets, parking, afrom, ato, dname, views, saves, p1, p2, descr) AS (
VALUES
 ('Room in 4BR House on Rugby Road','Rugby Road',825,1,1.0,true,true,false,true,DATE '2027-01-10',DATE '2027-05-20','Ella M.',148,12,'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80','https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80','Spring sublet in a friendly 4BR house steps from Grounds. Big windows, shared kitchen, porch for game days.'),
 ('1BR on Jefferson Park Ave — Walk to Grounds','Jefferson Park Avenue',1225,1,1.0,true,false,false,true,DATE '2027-01-05',DATE '2027-05-25','Owen K.',203,18,'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80','https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80','Quiet 1BR on JPA, ten minute walk to Grounds and the hospital. Furnished with desk and full kitchen.'),
 ('Studio near The Corner','The Corner',1095,1,1.0,true,true,false,false,DATE '2026-09-01',DATE '2026-12-20','Ella M.',96,6,'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&q=80','https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80','Compact furnished studio right above The Corner. Utilities included, perfect for the rest of fall semester.'),
 ('2BR on Wertland St — Spring Sublet','Wertland Street',1650,2,2.0,false,false,true,true,DATE '2027-01-08',DATE '2027-05-31','Priya N.',174,21,'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80','https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80','Two bedroom on Wertland, five minutes to Grounds. Pet friendly, off-street parking, laundry in building.'),
 ('Room in 5BR House on 14th St NW','14th Street NW',715,1,1.0,true,true,false,false,DATE '2026-09-15',DATE '2026-12-18','Jalen W.',132,9,'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80','https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=1200&q=80','Fall room in a 5BR student house on 14th. Utilities and wifi covered, laid-back roommates.'),
 ('1BR on Grady Ave — Full Year','Grady Avenue',1180,1,1.0,false,false,false,true,DATE '2026-08-25',DATE '2027-05-15','Sofia R.',221,24,'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80','https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80','Full-year takeover on Grady. Bright unfurnished 1BR with parking spot, short bus ride to Grounds.'),
 ('Room in 3BR on Preston Ave','Preston Avenue',760,1,1.5,true,true,true,true,DATE '2027-01-12',DATE '2027-05-18','Marcus D.',88,5,'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80','https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&q=80','Private room in a 3BR near Preston. Furnished, utilities included, dog-friendly household.'),
 ('2BR near Ivy Road — Summer 2027','Ivy Road',1420,2,1.0,true,true,false,true,DATE '2027-05-20',DATE '2027-08-10','Owen K.',64,4,'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80','https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80','Summer sublet on Ivy Rd for two. Fully furnished, utilities included, easy drive to Grounds and Barracks.'),
 ('Studio off Barracks Road','Barracks Road',1050,1,1.0,true,false,false,true,DATE '2027-01-04',DATE '2027-05-10','Hannah L.',117,11,'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&q=80','https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80','Tidy studio near Barracks Road shopping. Furnished, on the bus line to Grounds.'),
 ('Room in 4BR on Fontaine Ave','Fontaine Avenue',690,1,1.0,false,true,false,true,DATE '2026-10-01',DATE '2026-12-22','Jalen W.',75,3,'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80','https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80','Cheap fall room on Fontaine. Utilities covered, driveway parking, quiet grad-student house.'),
 ('1BR on Cherry Ave — Spring 2027','Cherry Avenue',1075,1,1.0,false,false,true,true,DATE '2027-01-15',DATE '2027-05-30','Priya N.',102,8,'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80','https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80','Spring 1BR on Cherry Ave in Fifeville. Cats welcome, in-unit laundry, quick bike to Grounds.'),
 ('Room in 3BR on Emmet Street','Emmet Street',870,1,2.0,true,true,false,true,DATE '2026-09-05',DATE '2026-12-19','Sofia R.',159,14,'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80','https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=1200&q=80','Furnished room on Emmet with private bath access. All utilities and wifi included through December.'),
 ('2BR in Belmont — Full Year Takeover','Belmont',1520,2,1.0,false,false,true,false,DATE '2026-08-28',DATE '2027-05-31','Andre P.',188,16,'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80','https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&q=80','Charming 2BR in Belmont with a backyard. Full academic year, walkable to Downtown Mall coffee shops.'),
 ('1BR on the Downtown Mall','Downtown Mall',1390,1,1.0,true,true,false,false,DATE '2027-01-06',DATE '2027-05-22','Hannah L.',241,29,'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80','https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80','Furnished 1BR right on the Downtown Mall. Utilities included, trolley to Grounds at the corner.'),
 ('Room in 4BR in Fifeville','Fifeville',655,1,1.5,false,true,true,true,DATE '2027-05-15',DATE '2027-08-05','Marcus D.',52,2,'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80','https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80','Cheapest summer room in Fifeville. Utilities included, pets fine, ten-minute walk to Grounds.'),
 ('2BR near Venable — Spring Sublet','Venable',1785,2,2.0,true,false,false,true,DATE '2027-01-09',DATE '2027-05-28','Andre P.',196,19,'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80','https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80','Renovated 2BR/2BA in Venable, closest neighborhood to Grounds. Furnished with two parking spots.'),
 ('Studio on Wertland St — Summer 2027','Wertland Street',985,1,1.0,true,true,false,false,DATE '2027-05-18',DATE '2027-08-12','Ella M.',47,3,'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&q=80','https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=1200&q=80','Summer studio on Wertland. Everything included, ideal for research or internship over the summer.'),
 ('Room in 3BR on Rugby Road — Fall','Rugby Road',940,1,2.0,true,false,false,true,DATE '2026-09-10',DATE '2026-12-21','Nina C.',167,13,'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80','https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80','Big furnished room on Rugby Rd, walk to Grounds and every house on the street. Parking included.'),
 ('1BR on Jefferson Park Ave — Full Year','Jefferson Park Avenue',1450,1,1.0,false,false,true,true,DATE '2026-08-24',DATE '2027-05-20','Nina C.',210,22,'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80','https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80','Top-floor 1BR on JPA for the full academic year. Pet friendly, in-unit washer/dryer, garage parking.'),
 ('2BR near Barracks Road — Spring 2027','Barracks Road',1310,2,1.0,false,true,false,true,DATE '2027-01-11',DATE '2027-05-16','Jalen W.',124,10,'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80','https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80','Spring 2BR near Barracks Rd. Utilities included, laundry in unit, direct bus to Grounds.')
)
INSERT INTO public.listings (
  user_id, campus_id, title, description, type, price, beds, baths, area,
  furnished, utilities_included, pet_friendly, parking, wifi_included, laundry,
  available_from, available_to, photos, amenities, roommate_prefs,
  views, view_count, saves_count, is_active, status, verification_tier, display_name,
  lat, lng, created_at
)
SELECT
  'd0000000-0000-4000-8000-000000000001'::uuid, c.id, r.title, r.descr, 'sublease',
  r.price, r.beds, r.baths, r.area,
  r.furnished, r.util, r.pets, r.parking, true,
  CASE WHEN r.beds > 1 THEN 'In-unit' ELSE 'Shared' END,
  r.afrom, r.ato, ARRAY[r.p1, r.p2],
  ARRAY['Wifi'] || CASE WHEN r.furnished THEN ARRAY['Furnished'] ELSE ARRAY[]::text[] END
                || CASE WHEN r.parking THEN ARRAY['Parking'] ELSE ARRAY[]::text[] END
                || CASE WHEN r.pets THEN ARRAY['Pet Friendly'] ELSE ARRAY[]::text[] END,
  jsonb_build_object(
    'gender', CASE WHEN r.price < 1000 THEN 'any' ELSE 'any' END,
    'smoking', false,
    'pets_ok', r.pets,
    'quiet_hours', r.price < 900,
    'students_only', true
  ),
  r.views, r.views, r.saves, true, 'active', 'basic', r.dname,
  38.0336 + ((row_number() OVER ())::float - 10) * 0.0016,
  -78.5080 + ((row_number() OVER ())::float - 10) * 0.0021,
  now() - (row_number() OVER ()) * interval '15 hours'
FROM rows r CROSS JOIN c;

-- Looking Board posts for UVA
INSERT INTO public.looking_for_posts (user_id, campus_id, title, description, budget_max, move_in_date, move_out_date, beds_min, area, furnished, pets_ok, num_people, display_name, upvotes, is_active)
SELECT 'd0000000-0000-4000-8000-000000000001'::uuid, c.id, t.title, t.descr, t.budget, t.mi, t.mo, 1, t.area, t.furn, t.pets, t.people, t.dname, t.up, true
FROM public.campuses c,
(VALUES
 ('3rd year looking for a spring room near Grounds','Rising 3rd year, clean and quiet, looking for a room in a house on Rugby or Wertland for spring semester. Can move in early January.',900,DATE '2027-01-08',DATE '2027-05-20','Rugby Road',true,false,1,'Tessa V.',7),
 ('Two roommates need a 2BR for full year','My friend and I are looking for a 2BR near JPA or Venable starting this fall through May. Both engineering students, no pets.',1800,DATE '2026-09-01',DATE '2027-05-15','Jefferson Park Avenue',false,false,2,'Devin A.',4),
 ('Summer 2027 sublet wanted — research internship','Need a furnished studio or room from mid-May to early August while I do research on Grounds. Flexible on neighborhood.',1000,DATE '2027-05-15',DATE '2027-08-08','The Corner',true,false,1,'Maya B.',3),
 ('Grad student seeking quiet 1BR in Belmont or Fifeville','Looking for a quiet 1BR with a small cat, walkable or short bus to Grounds. Spring start preferred.',1300,DATE '2027-01-05',DATE '2027-05-30','Belmont',false,true,1,'Chris O.',2)
) AS t(title, descr, budget, mi, mo, area, furn, pets, people, dname, up)
WHERE c.slug = 'university-of-virginia';
