
-- ROLES
CREATE TYPE public.app_role AS ENUM ('patient', 'health_worker', 'clinic_admin');
CREATE TYPE public.risk_level AS ENUM ('green', 'yellow', 'orange', 'red', 'critical');

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  village TEXT,
  phone TEXT,
  preferred_language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- AUTO PROFILE + DEFAULT PATIENT ROLE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, preferred_language)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en'));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'patient'));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PATIENTS (clinical record; one per patient user OR worker-created walk-in)
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  village TEXT,
  phone TEXT,
  allergies TEXT,
  chronic_conditions TEXT,
  registered_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patient reads own record" ON public.patients FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'health_worker') OR public.has_role(auth.uid(),'clinic_admin'));
CREATE POLICY "patient inserts own record" ON public.patients FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'health_worker') OR public.has_role(auth.uid(),'clinic_admin'));
CREATE POLICY "staff updates patients" ON public.patients FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'health_worker') OR public.has_role(auth.uid(),'clinic_admin'));

-- VISITS / TRIAGE
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  symptoms_raw TEXT NOT NULL,
  symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
  possible_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_level public.risk_level NOT NULL DEFAULT 'green',
  confidence NUMERIC(3,2),
  recommended_action TEXT,
  red_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  language TEXT DEFAULT 'en',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX visits_patient_idx ON public.visits(patient_id);
CREATE INDEX visits_created_idx ON public.visits(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO authenticated;
GRANT ALL ON public.visits TO service_role;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visit visibility" ON public.visits FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.patients p WHERE p.id = visits.patient_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(),'health_worker') OR public.has_role(auth.uid(),'clinic_admin')))
);
CREATE POLICY "visit insert" ON public.visits FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.patients p WHERE p.id = visits.patient_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(),'health_worker') OR public.has_role(auth.uid(),'clinic_admin')))
);

-- PRESCRIPTIONS
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  image_path TEXT,
  doctor TEXT,
  hospital TEXT,
  medicines JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_text TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;
GRANT ALL ON public.prescriptions TO service_role;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rx visibility" ON public.prescriptions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.patients p WHERE p.id = prescriptions.patient_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(),'health_worker') OR public.has_role(auth.uid(),'clinic_admin')))
);
CREATE POLICY "rx insert" ON public.prescriptions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.patients p WHERE p.id = prescriptions.patient_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(),'health_worker') OR public.has_role(auth.uid(),'clinic_admin')))
);

-- ALERTS (escalations)
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.visits(id) ON DELETE SET NULL,
  risk_level public.risk_level NOT NULL,
  message TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert visibility" ON public.alerts FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'health_worker') OR public.has_role(auth.uid(),'clinic_admin') OR
  EXISTS (SELECT 1 FROM public.patients p WHERE p.id = alerts.patient_id AND p.user_id = auth.uid())
);
CREATE POLICY "alert insert" ON public.alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "alert ack staff" ON public.alerts FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'health_worker') OR public.has_role(auth.uid(),'clinic_admin')
);
