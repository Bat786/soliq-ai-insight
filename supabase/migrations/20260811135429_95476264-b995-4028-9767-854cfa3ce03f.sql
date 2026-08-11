CREATE TABLE public.linked_wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  chain text NOT NULL CHECK (chain IN ('solana','evm')),
  provider text NOT NULL,
  address text NOT NULL,
  label text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, chain, address)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.linked_wallets TO authenticated;
GRANT ALL ON public.linked_wallets TO service_role;

ALTER TABLE public.linked_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own wallets"
ON public.linked_wallets FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_linked_wallets_updated_at
BEFORE UPDATE ON public.linked_wallets
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();