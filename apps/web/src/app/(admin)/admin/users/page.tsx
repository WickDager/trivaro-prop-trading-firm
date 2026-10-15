import { redirect } from 'next/navigation';

/**
 * The old "Users" list only offered a promote/demote toggle and had no way to
 * see a trader's accounts, payments or trades. /admin/traders replaces it, so
 * this route only exists to keep old links working.
 */
export default function AdminUsersPage() {
  redirect('/admin/traders');
}
