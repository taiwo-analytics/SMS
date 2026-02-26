-- Super admin support with safety checks
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Prevent removing the last super admin
CREATE OR REPLACE FUNCTION public.prevent_removing_last_super_admin()
RETURNS TRIGGER AS $$
DECLARE
  cnt INTEGER;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_super_admin = TRUE AND (NEW.is_super_admin = FALSE OR NEW.role <> 'admin') THEN
      SELECT COUNT(*) INTO cnt FROM public.profiles WHERE is_super_admin = TRUE AND id <> OLD.id;
      IF cnt = 0 THEN
        RAISE EXCEPTION 'Cannot remove the last super admin';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_super_admin = TRUE THEN
      SELECT COUNT(*) INTO cnt FROM public.profiles WHERE is_super_admin = TRUE AND id <> OLD.id;
      IF cnt = 0 THEN
        RAISE EXCEPTION 'Cannot delete the last super admin';
      END IF;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_remove_last_super_admin_upd ON public.profiles;
CREATE TRIGGER trg_prevent_remove_last_super_admin_upd
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_removing_last_super_admin();

DROP TRIGGER IF EXISTS trg_prevent_remove_last_super_admin_del ON public.profiles;
CREATE TRIGGER trg_prevent_remove_last_super_admin_del
BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_removing_last_super_admin();
