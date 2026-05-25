'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { Search, Shield, ShieldOff } from 'lucide-react';

interface UserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  kyc_status: string | null;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setUsers(data as UserRow[] ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = users.filter((u) =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  async function toggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'trader' : 'admin';
    const supabase = createBrowserClient();
    const { error } = await (supabase.from('profiles') as any).update({ role: newRole }).eq('id', userId);
    if (!error) {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold">Users</h1>
        <p className="text-sm text-text-muted">Manage traders and admins</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full rounded-lg border border-amber-500/10 bg-navy-800 py-2 pl-10 pr-4 text-sm text-white placeholder-text-muted focus:border-amber-400 focus:outline-none"
        />
      </div>

      <div className="overflow-x-auto rounded-xl border border-amber-500/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-amber-500/10 bg-navy-800/50 text-left text-text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">KYC</th>
              <th className="px-4 py-3 font-medium">Joined</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-muted">No users found</td></tr>
            ) : (
              filtered.map((user) => (
                <tr key={user.id} className="border-b border-amber-500/5 hover:bg-navy-700/30">
                  <td className="px-4 py-3 font-medium">{user.full_name || '—'}</td>
                  <td className="px-4 py-3 text-text-secondary">{user.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      user.role === 'admin'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-teal-500/10 text-teal-400'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs ${
                      user.kyc_status === 'verified' ? 'bg-green-500/10 text-green-400'
                      : user.kyc_status === 'rejected' ? 'bg-red-500/10 text-red-400'
                      : 'bg-navy-500 text-text-muted'
                    }`}>
                      {user.kyc_status || 'pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleRole(user.id, user.role)}
                      className="flex items-center gap-1 text-xs text-text-muted hover:text-amber-400"
                      title={user.role === 'admin' ? 'Remove admin' : 'Make admin'}
                    >
                      {user.role === 'admin' ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                      {user.role === 'admin' ? 'Demote' : 'Promote'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
