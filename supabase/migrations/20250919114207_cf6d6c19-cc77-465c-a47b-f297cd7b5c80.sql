-- Enable realtime updates for event_members table
ALTER TABLE event_members REPLICA IDENTITY FULL;

-- Add event_members to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE event_members;