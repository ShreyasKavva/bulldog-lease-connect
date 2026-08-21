ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS display_name text;

WITH names(i, n) AS (
  VALUES (0,'Marcus T.'),(1,'Jenna R.'),(2,'Alina M.'),(3,'Diego M.'),(4,'Priya S.'),
         (5,'Chris L.'),(6,'Nina R.'),(7,'Tyler B.'),(8,'Sofia G.'),(9,'Jordan W.'),
         (10,'Maya P.'),(11,'Owen H.'),(12,'Hana K.'),(13,'Luis A.'),(14,'Grace D.'),
         (15,'Devin C.'),(16,'Amara O.'),(17,'Ethan V.'),(18,'Lena F.'),(19,'Noah S.'),
         (20,'Camila R.'),(21,'Jamal W.'),(22,'Ruby N.'),(23,'Kai T.'),(24,'Elise B.'),
         (25,'Andre J.'),(26,'Yuki S.'),(27,'Mia C.'),(28,'Caleb M.'),(29,'Zoe L.'),
         (30,'Ravi K.'),(31,'Talia H.'),(32,'Ben F.'),(33,'Isabel Q.'),(34,'Simon P.'),
         (35,'Nora E.'),(36,'Malik D.'),(37,'Clara W.'),(38,'Theo R.'),(39,'Ada N.'),
         (40,'Jonas L.'),(41,'Farah A.'),(42,'Peter G.'),(43,'Rosa V.'),(44,'Liam O.'),
         (45,'Sana I.'),(46,'Eli B.'),(47,'Naomi T.'),(48,'Victor S.'),(49,'Iris M.')
), ranked AS (
  SELECT id, (row_number() OVER (ORDER BY created_at, id) - 1) % 50 AS i
  FROM public.listings
  WHERE user_id = 'd0000000-0000-4000-8000-000000000001'
)
UPDATE public.listings l
SET display_name = names.n
FROM ranked r JOIN names ON names.i = r.i
WHERE l.id = r.id;

UPDATE public.listings
SET status = 'inactive'
WHERE status = 'active' AND available_to IS NOT NULL AND available_to < current_date;