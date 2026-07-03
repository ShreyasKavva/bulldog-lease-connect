
INSERT INTO public.campuses (name, short_name, slug, city, state, lat, lng) VALUES
('Georgia Tech', 'Georgia Tech', 'georgia-tech', 'Atlanta', 'GA', 33.7756, -84.3963),
('Louisiana State University', 'LSU', 'louisiana-state-university', 'Baton Rouge', 'LA', 30.4133, -91.1800),
('University of Mississippi', 'Ole Miss', 'university-of-mississippi', 'Oxford', 'MS', 34.3654, -89.5378),
('Mississippi State University', 'Mississippi State', 'mississippi-state-university', 'Starkville', 'MS', 33.4557, -88.7900),
('University of Arkansas', 'Arkansas', 'university-of-arkansas', 'Fayetteville', 'AR', 36.0682, -94.1740),
('University of Kentucky', 'Kentucky', 'university-of-kentucky', 'Lexington', 'KY', 38.0306, -84.5037),
('University of Miami', 'Miami', 'university-of-miami', 'Coral Gables', 'FL', 25.7214, -80.2793),
('Penn State University', 'Penn State', 'penn-state-university', 'State College', 'PA', 40.7982, -77.8599),
('Ohio State University', 'Ohio State', 'ohio-state-university', 'Columbus', 'OH', 40.0067, -83.0305),
('University of Michigan', 'Michigan', 'university-of-michigan', 'Ann Arbor', 'MI', 42.2780, -83.7382),
('Indiana University', 'Indiana', 'indiana-university', 'Bloomington', 'IN', 39.1653, -86.5264),
('Purdue University', 'Purdue', 'purdue-university', 'West Lafayette', 'IN', 40.4237, -86.9212),
('University of Illinois', 'Illinois', 'university-of-illinois', 'Champaign', 'IL', 40.1020, -88.2272),
('University of Wisconsin', 'Wisconsin', 'university-of-wisconsin', 'Madison', 'WI', 43.0731, -89.4012),
('University of Texas', 'Texas', 'university-of-texas', 'Austin', 'TX', 30.2849, -97.7341),
('University of Notre Dame', 'Notre Dame', 'university-of-notre-dame', 'Notre Dame', 'IN', 41.7001, -86.2379),
('University of Virginia', 'UVA', 'university-of-virginia', 'Charlottesville', 'VA', 38.0336, -78.5080),
('Virginia Tech', 'Virginia Tech', 'virginia-tech', 'Blacksburg', 'VA', 37.2284, -80.4234),
('Duke University', 'Duke', 'duke-university', 'Durham', 'NC', 36.0014, -78.9382),
('University of Central Florida', 'UCF', 'university-of-central-florida', 'Orlando', 'FL', 28.6024, -81.2001)
ON CONFLICT (slug) DO NOTHING;
