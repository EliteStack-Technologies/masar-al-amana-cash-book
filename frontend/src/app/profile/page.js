'use client';

import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/components/AuthProvider';
import { api } from '@/lib/api';
import { Button, Card, ErrorNote, Field, SectionTitle } from '@/components/ui';
import { IconLogout, IconUser } from '@/components/Icons';

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();

  const [profile, setProfile] = useState({
    name: user?.name || '',
    shopName: user?.shopName || '',
    defaultCommissionPercent: String(user?.defaultCommissionPercent ?? 3),
    defaultOwnerSharePercent: String(user?.defaultOwnerSharePercent ?? 50),
  });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdErr, setPwdErr] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileErr('');
    setProfileMsg('');
    setSavingProfile(true);
    try {
      const { user: updated } = await api('/auth/profile', {
        method: 'PATCH',
        body: {
          ...profile,
          defaultCommissionPercent: Number(profile.defaultCommissionPercent),
          defaultOwnerSharePercent: Number(profile.defaultOwnerSharePercent),
        },
      });
      setUser(updated);
      setProfileMsg('Details saved.');
    } catch (err) {
      setProfileErr(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwdErr('');
    setPwdMsg('');

    if (pwd.newPassword !== pwd.confirm) return setPwdErr('New passwords do not match.');
    if (pwd.newPassword.length < 6) return setPwdErr('New password must be at least 6 characters.');

    setSavingPwd(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword },
      });
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
      setPwdMsg('Password updated.');
    } catch (err) {
      setPwdErr(err.message);
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <AppShell title="Profile" subtitle={user?.email} back>
      <div className="space-y-5 rise">
        <div className="card flex items-center gap-3.5 p-4">
          <span className="flex size-12 shrink-0 items-center justify-center border border-[var(--rule-strong)]">
            <IconUser size={22} />
          </span>
          <div className="min-w-0">
            <p className="display truncate text-[16px] font-bold">{user?.name}</p>
            <p className="ref truncate text-[11px] muted-2">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={saveProfile}>
          <SectionTitle>Your details</SectionTitle>
          <Card className="space-y-3.5">
            <Field label="Your name">
              <input
                className="field"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </Field>
            <Field label="Shop name">
              <input
                className="field"
                value={profile.shopName}
                onChange={(e) => setProfile((p) => ({ ...p, shopName: e.target.value }))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Default charge to customer %" hint="Fills in on a new swipe">
                <input
                  className="field ref"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  value={profile.defaultCommissionPercent}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, defaultCommissionPercent: e.target.value }))
                  }
                />
              </Field>
              <Field label="Default my share %" hint="The rest goes to the card company">
                <input
                  className="field ref"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.01"
                  value={profile.defaultOwnerSharePercent}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, defaultOwnerSharePercent: e.target.value }))
                  }
                />
              </Field>
            </div>

            <ErrorNote>{profileErr}</ErrorNote>
            {profileMsg && (
              <p className="stamp-mark text-leaf-500 dark:text-leaf-400">{profileMsg}</p>
            )}

            <Button type="submit" className="w-full" loading={savingProfile}>
              Save details
            </Button>
          </Card>
        </form>

        <form onSubmit={savePassword}>
          <SectionTitle>Change password</SectionTitle>
          <Card className="space-y-3.5">
            <Field label="Current password">
              <input
                className="field"
                type="password"
                autoComplete="current-password"
                value={pwd.currentPassword}
                onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))}
                required
              />
            </Field>
            <Field label="New password" hint="At least 6 characters">
              <input
                className="field"
                type="password"
                autoComplete="new-password"
                value={pwd.newPassword}
                onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))}
                required
              />
            </Field>
            <Field label="Confirm new password">
              <input
                className="field"
                type="password"
                autoComplete="new-password"
                value={pwd.confirm}
                onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
                required
              />
            </Field>

            <ErrorNote>{pwdErr}</ErrorNote>
            {pwdMsg && (
              <p className="stamp-mark text-leaf-500 dark:text-leaf-400">{pwdMsg}</p>
            )}

            <Button type="submit" variant="soft" className="w-full" loading={savingPwd}>
              Update password
            </Button>
          </Card>
        </form>

        <div className="pb-2">
          <Button
            type="button"
            variant="ghost"
            className="w-full text-stamp-500 dark:text-stamp-400"
            onClick={logout}
          >
            <IconLogout size={16} /> Sign out
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
