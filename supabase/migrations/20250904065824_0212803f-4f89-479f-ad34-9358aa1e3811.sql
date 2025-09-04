-- Create profiles table that syncs with auth.users
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT,
  locale TEXT DEFAULT 'it',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES public.profiles(id),
  name TEXT NOT NULL,
  budget_eur INTEGER,
  exchange_date DATE,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'drawn', 'locked')),
  code TEXT UNIQUE,
  last_year_event UUID REFERENCES public.events(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create members table
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id),
  email TEXT,
  name TEXT NOT NULL,
  joined BOOLEAN DEFAULT false,
  wishes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exclusions table
CREATE TABLE public.exclusions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  giver_member UUID NOT NULL REFERENCES public.members(id),
  blocked_member UUID NOT NULL REFERENCES public.members(id),
  UNIQUE(event_id, giver_member, blocked_member)
);

-- Create assignments table
CREATE TABLE public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  giver_member UUID NOT NULL REFERENCES public.members(id),
  receiver_member UUID NOT NULL REFERENCES public.members(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, giver_member),
  UNIQUE(event_id, receiver_member)
);

-- Create messages table for masked chat
CREATE TABLE public.messages_masked (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  from_member UUID NOT NULL REFERENCES public.members(id),
  to_member UUID NOT NULL REFERENCES public.members(id),
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_masked ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view and edit own profile" ON public.profiles
  FOR ALL USING (id = auth.uid());

-- RLS Policies for events
CREATE POLICY "Event admins can manage their events" ON public.events
  FOR ALL USING (admin_id = auth.uid());

-- RLS Policies for members
CREATE POLICY "Event admins can manage members" ON public.members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = members.event_id 
      AND events.admin_id = auth.uid()
    )
  );

-- RLS Policies for exclusions
CREATE POLICY "Event admins can manage exclusions" ON public.exclusions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = exclusions.event_id 
      AND events.admin_id = auth.uid()
    )
  );

-- RLS Policies for assignments
CREATE POLICY "Giver can view own assignment" ON public.assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE members.id = assignments.giver_member 
      AND members.profile_id = auth.uid()
    )
  );

CREATE POLICY "Event admin can view all assignments" ON public.assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = assignments.event_id 
      AND events.admin_id = auth.uid()
    )
  );

CREATE POLICY "Event admin can insert assignments" ON public.assignments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = assignments.event_id 
      AND events.admin_id = auth.uid()
    )
  );

-- RLS Policies for messages
CREATE POLICY "Users can send messages" ON public.messages_masked
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE members.id = messages_masked.from_member 
      AND members.profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their message threads" ON public.messages_masked
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.members 
      WHERE (members.id = messages_masked.from_member OR members.id = messages_masked.to_member)
      AND members.profile_id = auth.uid()
    )
  );

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();