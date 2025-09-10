/**
 * Centralized type definitions
 */

export interface User {
  id: string;
  email: string;
  display_name?: string;
}

export interface Event {
  id: string;
  name: string;
  date: string | null;
  budget: number | null;
  draw_status: 'pending' | 'completed';
  amazon_marketplace: string;
  join_code: string;
  created_at: string;
  cover_image_url?: string | null;
  admin_profile_id: string;
}

export interface EventMember {
  id: string;
  role: 'admin' | 'member';
  anonymous_name: string | null;
  anonymous_email: string | null;
  status: 'invited' | 'joined' | 'declined' | 'left';
  participant_id: string;
  event_id: string;
  display_name?: string | null;
  created_at: string;
}

export interface Participant {
  id: string;
  profile_id: string | null;
  created_at: string;
}

export interface WishlistItem {
  id: string;
  wishlist_id: string | null;
  event_id: string | null;
  owner_id: string;
  title: string | null;
  asin: string | null;
  raw_url: string | null;
  affiliate_url: string | null;
  image_url: string | null;
  price_snapshot: string | null;
  priority: number | null;
  notes: string | null;
  purchased_by: string | null;
  is_purchased: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  alias_snapshot: string;
  color_snapshot: string;
  created_at: string;
  author_participant_id: string;
  channel: 'event' | 'pair';
  assignment_id?: string;
  recipient_participant_id?: string;
}

export interface Assignment {
  id: string;
  event_id: string;
  giver_id: string;
  receiver_id: string;
  generated_on: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}