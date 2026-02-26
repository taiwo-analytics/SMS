DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'Admins can insert subjects'
  ) THEN
    CREATE POLICY "Admins can insert subjects"
    ON public.subjects FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'Admins can update subjects'
  ) THEN
    CREATE POLICY "Admins can update subjects"
    ON public.subjects FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subjects' AND policyname = 'Admins can delete subjects'
  ) THEN
    CREATE POLICY "Admins can delete subjects"
    ON public.subjects FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
      )
    );
  END IF;
END $$;
