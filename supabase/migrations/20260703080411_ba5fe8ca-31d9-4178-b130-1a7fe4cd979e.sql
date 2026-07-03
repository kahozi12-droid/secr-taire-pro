
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  -- SECURITY: never trust client-supplied account_type. All new signups get the
  -- lowest-privilege role. Promotion to 'director' must be done by an existing
  -- director through an authenticated, controlled path.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'secretary'::public.app_role);

  RETURN NEW;
END;
$function$;
