'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Loader2, Trash2 } from 'lucide-react';

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const user = session?.user;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // Initialize form with user data when session loads
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '');
      setLastName(user.lastName || '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setIsError(false);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Pass updated data to refresh session
        await update({
          firstName: data.data.firstName,
          lastName: data.data.lastName,
          name: data.data.name,
        });
        setMessage('Profile updated successfully!');
        setIsError(false);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(data.error || 'Failed to update profile');
        setIsError(true);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage('An error occurred while updating profile');
      setIsError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setMessage('Invalid file type. Please upload JPEG, PNG, GIF, or WebP.');
      setIsError(true);
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('File too large. Maximum size is 5MB.');
      setIsError(true);
      return;
    }

    setUploadingAvatar(true);
    setMessage('');
    setIsError(false);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Pass updated avatar URL to refresh session
        await update({ avatarUrl: data.data.avatarUrl });
        setMessage('Avatar updated successfully!');
        setIsError(false);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(data.error || 'Failed to upload avatar');
        setIsError(true);
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setMessage('An error occurred while uploading avatar');
      setIsError(true);
    } finally {
      setUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!confirm('Are you sure you want to remove your avatar?')) return;

    setUploadingAvatar(true);
    setMessage('');
    setIsError(false);

    try {
      const res = await fetch('/api/user/avatar', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Clear avatar in session
        await update({ avatarUrl: null });
        setMessage('Avatar removed successfully!');
        setIsError(false);
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(data.error || 'Failed to remove avatar');
        setIsError(true);
      }
    } catch (error) {
      console.error('Error removing avatar:', error);
      setMessage('An error occurred while removing avatar');
      setIsError(true);
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <p className="text-sm text-slate-500">Manage your personal information</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-2xl font-medium text-primary-700">
                  {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
              )}

              {/* Upload overlay */}
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">Profile Photo</p>
              <p className="text-xs text-slate-500 mb-2">
                Click on the image to upload a new photo
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 mr-1" />
                      Upload
                    </>
                  )}
                </Button>
                {user?.avatarUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <Input
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-slate-50"
            />
            <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
          </div>

          {/* Name fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                First Name
              </label>
              <Input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Last Name
              </label>
              <Input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Enter last name"
              />
            </div>
          </div>

          {/* Role (read-only) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Role
            </label>
            <Input
              type="text"
              value={user?.role || 'member'}
              disabled
              className="bg-slate-50 capitalize"
            />
          </div>

          {message && (
            <p className={`text-sm ${isError ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
