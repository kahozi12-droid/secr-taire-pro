
CREATE OR REPLACE FUNCTION public.enforce_single_director()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fixed_director CONSTANT uuid := '3e07062f-0223-4bd3-b854-46b575ee5f89';
BEGIN
  IF NEW.role = 'director'::public.app_role AND NEW.user_id <> _fixed_director THEN
    RAISE EXCEPTION 'Only the designated director account may hold the director role';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.user_id = _fixed_director
     AND OLD.role = 'director'::public.app_role
     AND (NEW.user_id <> OLD.user_id OR NEW.role <> OLD.role) THEN
    RAISE EXCEPTION 'The designated director role assignment cannot be modified';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_single_director_ins ON public.user_roles;
CREATE TRIGGER enforce_single_director_ins
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_director();

CREATE OR REPLACE FUNCTION public.protect_director_row_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _fixed_director CONSTANT uuid := '3e07062f-0223-4bd3-b854-46b575ee5f89';
BEGIN
  IF OLD.user_id = _fixed_director AND OLD.role = 'director'::public.app_role THEN
    RAISE EXCEPTION 'The designated director role assignment cannot be removed';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_director_row_delete ON public.user_roles;
CREATE TRIGGER protect_director_row_delete
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_director_row_delete();

REVOKE EXECUTE ON FUNCTION public.enforce_single_director() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_director_row_delete() FROM anon, authenticated;

-- Cleanup: demote any accidental extra director rows to secretary.
UPDATE public.user_roles
SET role = 'secretary'::public.app_role
WHERE role = 'director'::public.app_role
  AND user_id <> '3e07062f-0223-4bd3-b854-46b575ee5f89';
