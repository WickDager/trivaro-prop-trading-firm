export type UserRole = 'trader' | 'admin' | 'reviewer';

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  telegram_username: string | null;
  telegram_id: number | null;
  role: UserRole;
  kyc_status: 'pending' | 'verified' | 'rejected' | null;
  created_at: string;
}
