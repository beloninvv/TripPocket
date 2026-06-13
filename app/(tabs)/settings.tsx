import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { CurrencyPicker } from '../../src/components/CurrencyPicker';
import { Screen } from '../../src/components/Screen';
import { LANGUAGES, Language, setLanguage } from '../../src/i18n';
import { getSetting, setSetting } from '../../src/repositories/settingsRepo';
import { exportCsv, exportJson, importJson } from '../../src/services/export';
import { fetchAndCacheRates } from '../../src/services/currency';
import { Colors, fontSize, fontWeight, radius, spacing } from '../../src/theme';
import { ThemeMode, useTheme } from '../../src/theme/ThemeProvider';

const LANGUAGE_LABELS: Record<Language, string> = { ru: 'Русский', en: 'English' };
const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [lang, setLang] = useState<Language>(i18n.language as Language);
  const [baseCurrency, setBaseCurrency] = useState('RUB');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getSetting('base_currency').then((c) => c && setBaseCurrency(c));
  }, []);

  function changeLang(next: Language) {
    setLanguage(next);
    setLang(next);
    setSetting('language', next).catch(() => {});
  }

  function changeBaseCurrency(next: string) {
    setBaseCurrency(next);
    setSetting('base_currency', next).catch(() => {});
  }

  async function refreshRates() {
    setBusy('rates');
    try {
      const ok = await fetchAndCacheRates(baseCurrency);
      Alert.alert('', ok ? t('settings.ratesUpdated') : t('analytics.ratesMissing'));
    } finally {
      setBusy(null);
    }
  }

  async function runExport(kind: 'csv' | 'json') {
    setBusy(kind);
    try {
      await (kind === 'csv' ? exportCsv() : exportJson());
    } catch (e) {
      Alert.alert('Export', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  function runImport() {
    Alert.alert('', t('settings.importConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.done'),
        style: 'destructive',
        onPress: async () => {
          setBusy('import');
          try {
            const result = await importJson();
            if (!result) return; // отменено
            // Применяем язык и базовую валюту из восстановленных настроек
            const [restoredLang, restoredBase] = await Promise.all([
              getSetting('language'),
              getSetting('base_currency'),
            ]);
            if (restoredLang && LANGUAGES.includes(restoredLang as Language)) {
              setLanguage(restoredLang as Language);
              setLang(restoredLang as Language);
            }
            if (restoredBase) setBaseCurrency(restoredBase);
            Alert.alert(
              '',
              t('settings.imported', { trips: result.trips, expenses: result.expenses })
            );
          } catch {
            Alert.alert('', t('settings.importInvalid'));
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  }

  return (
    <Screen title={t('settings.title')}>
      <ScrollView contentContainerStyle={styles.body}>
        {/* Язык */}
        <View style={styles.section}>
          <Text style={styles.label}>{t('settings.language')}</Text>
          <View style={styles.chipRow}>
            {LANGUAGES.map((l) => (
              <Chip
                key={l}
                label={LANGUAGE_LABELS[l]}
                active={lang === l}
                onPress={() => changeLang(l)}
              />
            ))}
          </View>
        </View>

        {/* Тема оформления */}
        <View style={styles.section}>
          <Text style={styles.label}>{t('settings.theme')}</Text>
          <View style={styles.chipRow}>
            {THEME_MODES.map((m) => (
              <Chip
                key={m}
                label={t(`settings.theme_${m}`)}
                active={mode === m}
                onPress={() => setMode(m)}
              />
            ))}
          </View>
        </View>

        {/* Базовая валюта по умолчанию */}
        <View style={styles.section}>
          <Text style={styles.label}>{t('settings.baseCurrency')}</Text>
          <CurrencyPicker value={baseCurrency} onChange={changeBaseCurrency} />
        </View>

        {/* Действия */}
        <View style={styles.group}>
          <ActionRow
            icon="pricetags-outline"
            label={t('settings.categories')}
            onPress={() => router.push('/categories')}
          />
          <ActionRow
            icon="refresh-outline"
            label={t('settings.refreshRates')}
            loading={busy === 'rates'}
            onPress={refreshRates}
          />
          <ActionRow
            icon="document-text-outline"
            label={`${t('settings.export')} (CSV)`}
            loading={busy === 'csv'}
            onPress={() => runExport('csv')}
          />
          <ActionRow
            icon="archive-outline"
            label={`${t('settings.export')} (JSON)`}
            loading={busy === 'json'}
            onPress={() => runExport('json')}
          />
          <ActionRow
            icon="cloud-upload-outline"
            label={t('settings.import')}
            loading={busy === 'import'}
            onPress={runImport}
            last
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  loading,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  loading?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={[styles.actionRow, !last && styles.actionRowBorder]}
    >
      <Ionicons name={icon} size={20} color={colors.textMuted} />
      <Text style={styles.actionLabel}>{label}</Text>
      <Ionicons
        name={loading ? 'hourglass-outline' : 'chevron-forward'}
        size={18}
        color={colors.textFaint}
      />
    </Pressable>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  body: { padding: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
  chipText: { fontSize: fontSize.md, color: colors.text, fontWeight: fontWeight.medium },
  chipTextActive: { color: colors.primary, fontWeight: fontWeight.semibold },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  actionRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  actionLabel: { flex: 1, fontSize: fontSize.md, color: colors.text },
});
