'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';
import { Button, Card, ErrorNote, Field, SectionTitle, Segmented, Skeleton } from '@/components/ui';
import { IconTrash } from '@/components/Icons';

export default function CategoriesPage() {
  const [kind, setKind] = useState('income');
  const [items, setItems] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    api(`/categories?kind=${kind}`)
      .then((d) => setItems(d.items))
      .catch((err) => setError(err.message));

  useEffect(() => { setItems(null); setError(''); load(); }, [kind]);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api('/categories', { method: 'POST', body: { kind, name: name.trim() } });
      setName('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this category? Past entries keep their category name.')) return;
    try {
      await api(`/categories/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <AppShell title="Categories" subtitle="For income & expense entries" back>
      <div className="space-y-4">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[{ value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]}
        />

        <form onSubmit={add}>
          <Card className="space-y-3.5">
            <Field label={`New ${kind} category`}>
              <input className="field" type="text" placeholder={kind === 'income' ? 'e.g. Commission' : 'e.g. Rent'} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Button type="submit" className="w-full" loading={busy}>Add category</Button>
          </Card>
        </form>

        <ErrorNote>{error}</ErrorNote>

        <SectionTitle>{kind === 'income' ? 'Income' : 'Expense'} categories</SectionTitle>
        {!items && !error ? (
          <Skeleton className="h-[120px]" />
        ) : items && items.length ? (
          <Card className="ruled py-0">
            {items.map((c) => (
              <div key={c._id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{c.name}</span>
                <button type="button" onClick={() => remove(c._id)} aria-label="Delete category" className="muted-2 active:text-stamp-500"><IconTrash size={16} /></button>
              </div>
            ))}
          </Card>
        ) : (
          <p className="text-[13px] muted">No {kind} categories yet. Add one above, or just type a category directly on an entry.</p>
        )}
      </div>
    </AppShell>
  );
}
