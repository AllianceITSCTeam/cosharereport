import { getMeApi } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth.store';

export async function initAuth(): Promise<void> {
  const { setUser, setLoading, setInitialized } = useAuthStore.getState();
  setLoading(true);
  try {
    const user = await getMeApi();
    setUser(user);
  } catch {
    setUser(null);
  } finally {
    setLoading(false);
    setInitialized(true);
  }
}
