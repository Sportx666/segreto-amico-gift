-- Fix security vulnerability in notifications table
-- Remove the overly permissive system insert policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- Create a more secure policy that only allows users to create notifications for themselves
CREATE POLICY "Users can create notifications for themselves" 
ON public.notifications 
FOR INSERT 
TO authenticated
WITH CHECK (profile_id = auth.uid());

-- Add a policy for service role operations (for system functions)
-- This allows system processes to insert notifications while maintaining security
CREATE POLICY "Service role can insert notifications" 
ON public.notifications 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Verify that database functions with SECURITY DEFINER can still create notifications
-- (They should bypass RLS policies automatically, but this ensures system functionality remains intact)