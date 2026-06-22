
-- Restrict security definer functions: revoke from public/anon, allow authenticated only
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Tighten alerts insert
DROP POLICY IF EXISTS "alert insert" ON public.alerts;
CREATE POLICY "alert insert" ON public.alerts FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(),'health_worker') OR public.has_role(auth.uid(),'clinic_admin') OR
  EXISTS (SELECT 1 FROM public.patients p WHERE p.id = alerts.patient_id AND p.user_id = auth.uid())
);

-- Storage policies for prescriptions bucket: users access only their own folder (path: <user_id>/...)
CREATE POLICY "rx upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'prescriptions' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "rx read own or staff" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'prescriptions' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(),'health_worker')
    OR public.has_role(auth.uid(),'clinic_admin')
  ));
