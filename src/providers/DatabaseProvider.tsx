import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ActivityIndicator, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { initDatabase } from '../db';
import { getSetting } from '../repositories/settingsRepo';
import { Language, LANGUAGES, setLanguage } from '../i18n';
import { Colors, darkColors, fontSize, lightColors, spacing } from '../theme';

type DbContextValue = { ready: boolean };

const DbContext = createContext<DbContextValue>({ ready: false });

export function useDatabaseReady() {
  return useContext(DbContext).ready;
}

/**
 * Поднимает SQLite (создание файла + миграции) до отрисовки приложения
 * и применяет сохранённый язык. Пока не готово — показывает сплэш.
 */
export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Сплэш показывается до инициализации БД, поэтому тему берём из системы.
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? darkColors : lightColors;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initDatabase();
        const lang = await getSetting('language');
        if (lang && LANGUAGES.includes(lang as Language)) {
          setLanguage(lang as Language);
        }
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>DB error: {error}</Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <DbContext.Provider value={{ ready }}>{children}</DbContext.Provider>;
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  error: {
    color: colors.danger,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
});
