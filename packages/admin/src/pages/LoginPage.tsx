import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, setupAdmin, setToken } from '../lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const [isSetup, setIsSetup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const fn = isSetup ? setupAdmin : login;
      const res = await fn(email, password);
      setToken(res.token);
      navigate('/');
    } catch (err: any) {
      if (err.message.includes('404') || err.message.includes('No admin')) {
        // No admins exist yet, switch to setup mode
        setIsSetup(true);
        setError('No admin account exists yet. Create the first admin below.');
      } else {
        setError(err.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-alt">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white">
            Z
          </div>
          <h1 className="text-2xl font-bold text-secondary">Ziggy Admin</h1>
          <p className="mt-1 text-sm text-gray-500">Experts Live Conference Management</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-bold text-secondary">
            {isSetup ? 'Create First Admin' : 'Sign in'}
          </h2>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Min. 8 characters"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isSetup ? 'Create Admin & Sign In' : 'Sign In'}
          </button>

          {!isSetup && (
            <button
              type="button"
              onClick={() => setIsSetup(true)}
              className="mt-3 w-full text-center text-xs text-gray-500 hover:text-primary"
            >
              First time? Set up admin account
            </button>
          )}
          {isSetup && (
            <button
              type="button"
              onClick={() => {
                setIsSetup(false);
                setError('');
              }}
              className="mt-3 w-full text-center text-xs text-gray-500 hover:text-primary"
            >
              Already have an account? Sign in
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
