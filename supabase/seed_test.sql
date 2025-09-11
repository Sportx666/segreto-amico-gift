-- Test seed data for Amico Segreto Gift Exchange
-- This file provides realistic test data for local development, unit tests, e2e tests, and UAT
-- Run this after schema setup to populate with test fixtures

-- Insert test profiles (simulating real users)
INSERT INTO public.profiles (id, email, display_name, family_group, created_at, avatar_url) VALUES 
(
  '11111111-1111-1111-1111-111111111111',
  'admin@test.com',
  'Marco Rossi',
  'famiglia-rossi',
  NOW() - INTERVAL '30 days',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=marco'
),
(
  '22222222-2222-2222-2222-222222222222',
  'user1@test.com',
  'Sofia Bianchi',
  'famiglia-rossi',
  NOW() - INTERVAL '25 days',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=sofia'
),
(
  '33333333-3333-3333-3333-333333333333',
  'user2@test.com',
  'Luca Verdi',
  'famiglia-rossi',
  NOW() - INTERVAL '20 days',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=luca'
),
(
  '44444444-4444-4444-4444-444444444444',
  'user3@test.com',
  'Elena Neri',
  'famiglia-amici',
  NOW() - INTERVAL '15 days',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=elena'
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  family_group = EXCLUDED.family_group,
  avatar_url = EXCLUDED.avatar_url;

-- Insert participants linked to profiles
INSERT INTO public.participants (id, profile_id, created_at) VALUES 
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', NOW() - INTERVAL '30 days'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', NOW() - INTERVAL '25 days'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '20 days'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '44444444-4444-4444-4444-444444444444', NOW() - INTERVAL '15 days'),
-- Anonymous participant (invited but not joined yet)
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', NULL, NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO UPDATE SET
  profile_id = EXCLUDED.profile_id;

-- Insert test events: one OPEN, one COMPLETED
INSERT INTO public.events (id, admin_profile_id, name, date, budget, join_code, amazon_marketplace, draw_status, created_at, cover_image_url) VALUES 
(
  'event111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'Natale 2024 - Famiglia Rossi',
  '2024-12-25',
  50.00,
  'NAT2024',
  'www.amazon.it',
  'pending',
  NOW() - INTERVAL '20 days',
  'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=800&h=400&fit=crop'
),
(
  'event222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'Compleanno Elena - Amici',
  '2024-11-15',
  30.00,
  'ELENA24',
  'www.amazon.it',
  'completed',
  NOW() - INTERVAL '40 days',
  'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&h=400&fit=crop'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  date = EXCLUDED.date,
  budget = EXCLUDED.budget,
  draw_status = EXCLUDED.draw_status;

-- Insert event members (all joined + one pending invite)
INSERT INTO public.event_members (id, event_id, participant_id, role, status, created_at, anonymous_name, anonymous_email) VALUES 
-- Open event (Natale 2024) - all members joined
('mem11111-1111-1111-1111-111111111111', 'event111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin', 'joined', NOW() - INTERVAL '20 days', NULL, NULL),
('mem22222-2222-2222-2222-222222222222', 'event111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member', 'joined', NOW() - INTERVAL '18 days', NULL, NULL),
('mem33333-3333-3333-3333-333333333333', 'event111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'member', 'joined', NOW() - INTERVAL '16 days', NULL, NULL),
('mem44444-4444-4444-4444-444444444444', 'event111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'member', 'joined', NOW() - INTERVAL '14 days', NULL, NULL),
-- Pending invite for open event
('mem55555-5555-5555-5555-555555555555', 'event111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'member', 'invited', NOW() - INTERVAL '10 days', 'Maria Gialli', 'maria@test.com'),
-- Completed event (Compleanno Elena) - first 3 members only
('mem66666-6666-6666-6666-666666666666', 'event222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin', 'joined', NOW() - INTERVAL '40 days', NULL, NULL),
('mem77777-7777-7777-7777-777777777777', 'event222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'member', 'joined', NOW() - INTERVAL '38 days', NULL, NULL),
('mem88888-8888-8888-8888-888888888888', 'event222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'member', 'joined', NOW() - INTERVAL '35 days', NULL, NULL)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status;

-- Insert wishlists for each member/event combination
INSERT INTO public.wishlists (id, event_id, owner_id, title, notes, created_at, cover_image_url) VALUES 
-- Open event wishlists
('wish1111-1111-1111-1111-111111111111', 'event111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Lista Marco - Natale 2024', 'Cose per la casa e hobby', NOW() - INTERVAL '18 days', NULL),
('wish2222-2222-2222-2222-222222222222', 'event111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Lista Sofia - Natale 2024', 'Libri, profumi e accessori', NOW() - INTERVAL '16 days', NULL),
('wish3333-3333-3333-3333-333333333333', 'event111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Lista Luca - Natale 2024', 'Tecnologia e giochi', NOW() - INTERVAL '14 days', NULL),
('wish4444-4444-4444-4444-444444444444', 'event111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Lista Elena - Natale 2024', 'Bellezza e wellness', NOW() - INTERVAL '12 days', NULL),
-- Completed event wishlists
('wish5555-5555-5555-5555-555555555555', 'event222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Lista Marco - Compleanno Elena', 'Regali per Elena', NOW() - INTERVAL '38 days', NULL),
('wish6666-6666-6666-6666-666666666666', 'event222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Lista Sofia - Compleanno Elena', 'Idee per Elena', NOW() - INTERVAL '36 days', NULL),
('wish7777-7777-7777-7777-777777777777', 'event222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Lista Elena - Compleanno', 'La mia lista desideri', NOW() - INTERVAL '34 days', NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  notes = EXCLUDED.notes;

-- Insert wishlist items
INSERT INTO public.wishlist_items (id, wishlist_id, event_id, owner_id, title, asin, raw_url, affiliate_url, image_url, price_snapshot, priority, notes, purchased_by, is_purchased, created_at) VALUES 
-- Marco's wishlist items (Open event)
('item1111-1111-1111-1111-111111111111', 'wish1111-1111-1111-1111-111111111111', 'event111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Set Cacciaviti Precision', 'B08XYZ123', 'https://amazon.it/dp/B08XYZ123', 'https://amazon.it/dp/B08XYZ123?tag=test', 'https://m.media-amazon.com/images/I/61abc123.jpg', '€ 24,99', 1, 'Per piccole riparazioni in casa', NULL, false, NOW() - INTERVAL '17 days'),
('item2222-2222-2222-2222-222222222222', 'wish1111-1111-1111-1111-111111111111', 'event111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Libro "Clean Code"', 'B09ABC456', 'https://amazon.it/dp/B09ABC456', 'https://amazon.it/dp/B09ABC456?tag=test', 'https://m.media-amazon.com/images/I/41def456.jpg', '€ 32,50', 2, 'Programmazione e sviluppo', NULL, false, NOW() - INTERVAL '16 days'),
-- Sofia's wishlist items (Open event)
('item3333-3333-3333-3333-333333333333', 'wish2222-2222-2222-2222-222222222222', 'event111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Profumo Donna Elegante', 'B07DEF789', 'https://amazon.it/dp/B07DEF789', 'https://amazon.it/dp/B07DEF789?tag=test', 'https://m.media-amazon.com/images/I/31ghi789.jpg', '€ 45,00', 1, 'Fragranza floreale', NULL, false, NOW() - INTERVAL '15 days'),
('item4444-4444-4444-4444-444444444444', 'wish2222-2222-2222-2222-222222222222', 'event111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sciarpa Cashmere', 'B06GHI012', 'https://amazon.it/dp/B06GHI012', 'https://amazon.it/dp/B06GHI012?tag=test', 'https://m.media-amazon.com/images/I/51jkl012.jpg', '€ 38,90', 2, 'Colore tortora o beige', NULL, false, NOW() - INTERVAL '14 days'),
-- Luca's wishlist items (Open event)
('item5555-5555-5555-5555-555555555555', 'wish3333-3333-3333-3333-333333333333', 'event111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Mouse Gaming RGB', 'B05JKL345', 'https://amazon.it/dp/B05JKL345', 'https://amazon.it/dp/B05JKL345?tag=test', 'https://m.media-amazon.com/images/I/41mno345.jpg', '€ 29,99', 1, 'Con led RGB e DPI regolabile', NULL, false, NOW() - INTERVAL '13 days'),
('item6666-6666-6666-6666-666666666666', 'wish3333-3333-3333-3333-333333333333', 'event111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Puzzle 1000 pezzi', 'B04MNO678', 'https://amazon.it/dp/B04MNO678', 'https://amazon.it/dp/B04MNO678?tag=test', 'https://m.media-amazon.com/images/I/61pqr678.jpg', '€ 12,50', 3, 'Paesaggio montano', NULL, false, NOW() - INTERVAL '12 days'),
-- Elena's wishlist items (Open event)
('item7777-7777-7777-7777-777777777777', 'wish4444-4444-4444-4444-444444444444', 'event111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Set Pennelli Makeup', 'B03PQR901', 'https://amazon.it/dp/B03PQR901', 'https://amazon.it/dp/B03PQR901?tag=test', 'https://m.media-amazon.com/images/I/51stu901.jpg', '€ 22,90', 1, 'Professionale con custodia', NULL, false, NOW() - INTERVAL '11 days'),
('item8888-8888-8888-8888-888888888888', 'wish4444-4444-4444-4444-444444444444', 'event111-1111-1111-1111-111111111111', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Crema Viso Anti-age', 'B02STU234', 'https://amazon.it/dp/B02STU234', 'https://amazon.it/dp/B02STU234?tag=test', 'https://m.media-amazon.com/images/I/41vwx234.jpg', '€ 35,00', 2, 'Con acido ialuronico', NULL, false, NOW() - INTERVAL '10 days'),
-- Completed event items (some purchased)
('item9999-9999-9999-9999-999999999999', 'wish7777-7777-7777-7777-777777777777', 'event222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Orecchini Argento', 'B01VWX567', 'https://amazon.it/dp/B01VWX567', 'https://amazon.it/dp/B01VWX567?tag=test', 'https://m.media-amazon.com/images/I/31yzz567.jpg', '€ 28,50', 1, 'Con cristalli Swarovski', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true, NOW() - INTERVAL '32 days'),
('itemaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'wish7777-7777-7777-7777-777777777777', 'event222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Borsa Tracolla Pelle', 'B00YZZ890', 'https://amazon.it/dp/B00YZZ890', 'https://amazon.it/dp/B00YZZ890?tag=test', 'https://m.media-amazon.com/images/I/51bbb890.jpg', '€ 42,00', 2, 'Colore cognac', NULL, false, NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  price_snapshot = EXCLUDED.price_snapshot,
  purchased_by = EXCLUDED.purchased_by,
  is_purchased = EXCLUDED.is_purchased;

-- Insert exclusions for OPEN event (realistic family dynamics)
INSERT INTO public.exclusions (id, event_id, giver_id, blocked_id, reason, active, created_at) VALUES 
('excl1111-1111-1111-1111-111111111111', 'event111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Marito e moglie', true, NOW() - INTERVAL '15 days'),
('excl2222-2222-2222-2222-222222222222', 'event111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Marito e moglie', true, NOW() - INTERVAL '15 days'),
('excl3333-3333-3333-3333-333333333333', 'event111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Si sono scambiati regali l\'anno scorso', true, NOW() - INTERVAL '14 days')
ON CONFLICT (id) DO UPDATE SET
  reason = EXCLUDED.reason,
  active = EXCLUDED.active;

-- Insert assignments for COMPLETED event (consistent with exclusions)
INSERT INTO public.assignments (id, event_id, giver_id, receiver_id, generated_on) VALUES 
('assg1111-1111-1111-1111-111111111111', 'event222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-dddddddddddd', NOW() - INTERVAL '25 days'),
('assg2222-2222-2222-2222-222222222222', 'event222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NOW() - INTERVAL '25 days'),
('assg3333-3333-3333-3333-333333333333', 'event222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NOW() - INTERVAL '25 days')
ON CONFLICT (id) DO UPDATE SET
  generated_on = EXCLUDED.generated_on;

-- Insert join tokens: one active, one used
INSERT INTO public.join_tokens (id, token, event_id, participant_id, expires_at, used_at, created_at) VALUES 
('tokn1111-1111-1111-1111-111111111111', 'test-active-token-2024-natale', 'event111-1111-1111-1111-111111111111', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', NOW() + INTERVAL '7 days', NULL, NOW() - INTERVAL '10 days'),
('tokn2222-2222-2222-2222-222222222222', 'test-used-token-2024-elena', 'event222-2222-2222-2222-222222222222', 'dddddddd-dddd-dddd-dddd-dddddddddddd', NOW() - INTERVAL '30 days', NOW() - INTERVAL '35 days', NOW() - INTERVAL '40 days')
ON CONFLICT (id) DO UPDATE SET
  expires_at = EXCLUDED.expires_at,
  used_at = EXCLUDED.used_at;

-- Insert notification settings (defaults + custom preferences)
INSERT INTO public.notification_settings (profile_id, email_assignment, email_chat_digest, in_app, created_at, updated_at) VALUES 
('11111111-1111-1111-1111-111111111111', true, false, true, NOW() - INTERVAL '30 days', NOW() - INTERVAL '5 days'),
('22222222-2222-2222-2222-222222222222', true, true, true, NOW() - INTERVAL '25 days', NOW() - INTERVAL '3 days'),
('33333333-3333-3333-3333-333333333333', false, false, true, NOW() - INTERVAL '20 days', NOW() - INTERVAL '2 days'),
('44444444-4444-4444-4444-444444444444', true, false, true, NOW() - INTERVAL '15 days', NOW() - INTERVAL '1 day')
ON CONFLICT (profile_id) DO UPDATE SET
  email_assignment = EXCLUDED.email_assignment,
  email_chat_digest = EXCLUDED.email_chat_digest,
  in_app = EXCLUDED.in_app,
  updated_at = EXCLUDED.updated_at;

-- Insert notifications (mix of read/unread, different types)
INSERT INTO public.notifications (id, profile_id, type, title, body, created_at, read_at) VALUES 
-- Assignment notifications (read)
('notf1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'assignment', 'Sorteggio completato!', 'Il sorteggio per "Compleanno Elena - Amici" è stato completato. Dovrai fare un regalo a Elena Neri!', NOW() - INTERVAL '25 days', NOW() - INTERVAL '24 days'),
('notf2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'assignment', 'Sorteggio completato!', 'Il sorteggio per "Compleanno Elena - Amici" è stato completato. Dovrai fare un regalo a Marco Rossi!', NOW() - INTERVAL '25 days', NOW() - INTERVAL '20 days'),
('notf3333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'assignment', 'Sorteggio completato!', 'Il sorteggio per "Compleanno Elena - Amici" è stato completato. Dovrai fare un regalo a Sofia Bianchi!', NOW() - INTERVAL '25 days', NOW() - INTERVAL '22 days'),
-- Event invites (unread)
('notf4444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'invite', 'Nuovo evento!', 'Sei stata invitata all\'evento "Natale 2024 - Famiglia Rossi" da Marco Rossi', NOW() - INTERVAL '18 days', NULL),
('notf5555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'invite', 'Nuovo evento!', 'Sei stato invitato all\'evento "Natale 2024 - Famiglia Rossi" da Marco Rossi', NOW() - INTERVAL '16 days', NOW() - INTERVAL '15 days'),
-- Wishlist updates (mix)
('notf6666-6666-6666-6666-666666666666', '44444444-4444-4444-4444-444444444444', 'wishlist', 'Regalo acquistato', 'Qualcuno ha acquistato un regalo dalla tua lista per "Compleanno Elena - Amici"', NOW() - INTERVAL '5 days', NULL),
('notf7777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'reminder', 'Evento in scadenza', 'L\'evento "Natale 2024 - Famiglia Rossi" è tra 30 giorni!', NOW() - INTERVAL '2 days', NULL)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  read_at = EXCLUDED.read_at;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Test seed data loaded successfully! 🎁';
  RAISE NOTICE 'Created:';
  RAISE NOTICE '- 4 profiles with participants';
  RAISE NOTICE '- 2 events (1 open, 1 completed)';
  RAISE NOTICE '- Event members and wishlists';
  RAISE NOTICE '- Exclusions and assignments';
  RAISE NOTICE '- Join tokens and notifications';
  RAISE NOTICE 'Ready for testing all app flows under RLS!';
END $$;