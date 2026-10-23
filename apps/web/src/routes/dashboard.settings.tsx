import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Loader2, LogOut, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import pb from '@/lib/pocketbase-client';
import { useAuth } from '@/hooks/use-auth';
import { inputClass, submitClass } from '@/components/auth/auth-layout';

export default function Settings() {
	const { user } = useAuth();
	const navigate = useNavigate();
	const [name, setName] = useState(user?.name ?? '');
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [saving, setSaving] = useState(false);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [deleting, setDeleting] = useState(false);

	if (!user) return null;

	const avatarUrl = user.avatar ? pb.files.getURL(user, user.avatar, { thumb: '100x100' }) : null;

	const save = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);
		try {
			const form = new FormData();
			form.append('name', name.trim());
			if (avatarFile) form.append('avatar', avatarFile);
			await pb.collection('users').update(user.id, form);
			toast.success('Profile updated.');
			setAvatarFile(null);
		} catch {
			toast.error('Could not save your profile.');
		} finally {
			setSaving(false);
		}
	};

	const signOut = () => {
		pb.authStore.clear();
		navigate('/login');
	};

	const deleteAccount = async () => {
		setDeleting(true);
		try {
			await pb.collection('users').delete(user.id);
			pb.authStore.clear();
			navigate('/');
		} catch {
			toast.error('Could not delete your account. Please try again.');
			setDeleting(false);
			setConfirmingDelete(false);
		}
	};

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<div>
				<h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Settings</h1>
				<p className="mt-1 text-sm text-muted-foreground">Your profile and account.</p>
			</div>

			<form onSubmit={save} className="notebook-card space-y-5 p-6 sm:p-8">
				<div className="flex items-center gap-4">
					{avatarFile ? (
						<img src={URL.createObjectURL(avatarFile)} alt="" className="h-16 w-16 rounded-full border border-foreground/15 object-cover" />
					) : avatarUrl ? (
						<img src={avatarUrl} alt="" className="h-16 w-16 rounded-full border border-foreground/15 object-cover" />
					) : (
						<span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-xl font-extrabold">
							{(user.name || user.email || '?').slice(0, 2).toUpperCase()}
						</span>
					)}
					<div>
						<label htmlFor="avatar" className="inline-flex h-10 cursor-pointer items-center rounded-xl border-2 border-foreground/15 px-4 text-sm font-bold transition-colors hover:bg-secondary">
							Change avatar
						</label>
						<input
							id="avatar" type="file" accept="image/*" className="hidden"
							onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
						/>
						<p className="mt-1.5 text-xs text-muted-foreground">PNG or JPG, shown across your dashboard.</p>
					</div>
				</div>

				<div className="space-y-2">
					<label htmlFor="name" className="text-sm font-semibold">Full name</label>
					<input id="name" value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} opacity-60`} />
				</div>

				<div className="space-y-2">
					<label className="text-sm font-semibold">Email</label>
					<input value={user.email} disabled className={`${inputClass} opacity-60`} />
				</div>

				<div className="space-y-2">
					<label className="text-sm font-semibold">Current plan</label>
					<div className="flex items-center justify-between rounded-xl border border-foreground/15 bg-secondary/50 px-4 py-3">
						<span className="text-sm font-bold">Free</span>
						<span className="text-xs text-muted-foreground">3 lectures / month</span>
					</div>
				</div>

				<button type="submit" disabled={saving} className={submitClass}>
					{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
					Save changes
				</button>
			</form>

			<div className="notebook-card space-y-4 p-6 sm:p-8">
				<h2 className="text-lg font-extrabold">Session</h2>
				<button
					onClick={signOut}
					className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-foreground/15 px-5 text-sm font-bold transition-colors hover:bg-secondary"
				>
					<LogOut className="h-4 w-4" /> Sign out
				</button>
			</div>

			<div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 sm:p-8">
				<h2 className="text-lg font-extrabold text-destructive">Danger zone</h2>
				<p className="mt-1 text-sm text-foreground/70">
					Deleting your account removes all lectures, transcripts, notes, flashcards and quiz history. This cannot be undone.
				</p>
				{confirmingDelete ? (
					<div className="mt-4 flex flex-wrap items-center gap-3">
						<button
							onClick={deleteAccount}
							disabled={deleting}
							className="inline-flex h-11 items-center gap-2 rounded-xl bg-destructive px-5 text-sm font-bold text-destructive-foreground"
						>
							{deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
							Yes, delete everything
						</button>
						<button
							onClick={() => setConfirmingDelete(false)}
							className="inline-flex h-11 items-center rounded-xl border-2 border-foreground/15 px-5 text-sm font-bold hover:bg-secondary"
						>
							Cancel
						</button>
					</div>
				) : (
					<button
						onClick={() => setConfirmingDelete(true)}
						className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl border-2 border-destructive/40 px-5 text-sm font-bold text-destructive transition-colors hover:bg-destructive/10"
					>
						<Trash2 className="h-4 w-4" /> Delete account
					</button>
				)}
			</div>
		</div>
	);
}
