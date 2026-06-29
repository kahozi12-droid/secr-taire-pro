
CREATE OR REPLACE FUNCTION public.refresh_daily_report_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.snapshot_daily_report(NEW.document_date);
    IF OLD.document_date IS DISTINCT FROM NEW.document_date THEN
      PERFORM public.snapshot_daily_report(OLD.document_date);
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.snapshot_daily_report(NEW.document_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_daily_report ON public.documents;
CREATE TRIGGER trg_refresh_daily_report
AFTER INSERT OR UPDATE OF status, document_date ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.refresh_daily_report_on_status_change();
