-- Add UNIQUE constraint on endpoint so upsert(onConflict: "endpoint") works.
-- Also ensure every user can insert/update/delete their own subscriptions.
ALTER TABLE public.push_subscriptions
  ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
