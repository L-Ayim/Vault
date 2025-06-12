import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useMutation } from '@apollo/client';
import { MUTATION_UPDATE_PREFERENCES } from '../graphql/operations';

export default function usePersistentState<T>(key: string, defaultValue: T) {
  const { user } = useAuth();
  const [updatePrefs] = useMutation(MUTATION_UPDATE_PREFERENCES);
  const [state, setState] = useState<T>(() => {
    if (user?.profile?.preferences && key in user.profile.preferences) {
      return user.profile.preferences[key] as T;
    }
    try {
      const stored = localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (user?.profile?.preferences && key in user.profile.preferences) {
      setState(user.profile.preferences[key] as T);
    }
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    if (user) {
      const prefs = { ...(user.profile?.preferences || {}), [key]: state };
      updatePrefs({ variables: { preferences: prefs } }).catch(() => {});
    }
  }, [key, state, user, updatePrefs]);

  return [state, setState] as const;
}
