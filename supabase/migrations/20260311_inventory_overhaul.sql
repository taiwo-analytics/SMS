-- 1. Add professional asset tracking columns to inventory_items
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS condition TEXT DEFAULT 'Good',
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Create inventory_assignments table
CREATE TABLE IF NOT EXISTS public.inventory_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id), -- Made nullable to allow custom names
  assigned_to_name TEXT NOT NULL, -- Required for simple name tracking
  assigned_to_role TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  returned_at TIMESTAMPTZ,
  notes TEXT
);

-- 3. Enable Row Level Security
ALTER TABLE public.inventory_assignments ENABLE ROW LEVEL SECURITY;

-- 4. Set up RLS Policies
-- Allow authenticated users to view assignments
CREATE POLICY "Anyone can view inventory assignments" 
ON public.inventory_assignments FOR SELECT 
TO authenticated 
USING (true);

-- Allow admins to manage (Insert, Update, Delete) assignments
CREATE POLICY "Admins can manage inventory assignments" 
ON public.inventory_assignments FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- 5. Helpful Indexing for performance
CREATE INDEX IF NOT EXISTS idx_inv_assign_item_id ON public.inventory_assignments(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_assign_user_id ON public.inventory_assignments(assigned_to);
