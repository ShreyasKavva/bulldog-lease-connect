CREATE OR REPLACE FUNCTION public.import_campuses_tmp(_token text, _rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  IF _token IS DISTINCT FROM 'q179-import-1a7f3c9e' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  WITH src AS (
    SELECT * FROM jsonb_to_recordset(_rows) AS x(
      name text, short_name text, city text, state text,
      lat double precision, lng double precision, slug text,
      zip text, level smallint, ipeds_unitid integer, aliases text
    )
  ), ins AS (
    INSERT INTO public.campuses (name, short_name, city, state, lat, lng, slug, zip, level, ipeds_unitid, aliases)
    SELECT name, short_name, city, state, lat, lng, slug, zip, level, ipeds_unitid, aliases FROM src
    ON CONFLICT (slug) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO n FROM ins;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.import_campuses_tmp(text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.import_campuses_tmp(text, jsonb) TO anon, service_role;