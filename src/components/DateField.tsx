import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Colors, fontSize, radius, spacing } from '../theme';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
  label: string;
  value: number | null; // ts или null
  onChange: (value: number | null) => void;
  locale?: string;
  mode?: 'date' | 'datetime';
  /** Разрешать сброс значения в «—». По умолчанию да. */
  clearable?: boolean;
};

export function DateField({
  label,
  value,
  onChange,
  locale = 'ru',
  mode = 'date',
  clearable = true,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  const intlLocale = locale === 'ru' ? 'ru-RU' : 'en-US';
  const display =
    value != null
      ? new Date(value).toLocaleString(intlLocale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          ...(mode === 'datetime' ? { hour: '2-digit', minute: '2-digit' } : {}),
        })
      : '—';

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable
          style={styles.value}
          onPress={() => setOpen((v) => !v)}
        >
          <Text style={[styles.valueText, value == null && styles.placeholder]}>
            {display}
          </Text>
        </Pressable>
        {value != null && clearable ? (
          <Pressable
            hitSlop={8}
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <Text style={styles.clear}>{t('common.cancel')}</Text>
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <DateTimePicker
          value={value != null ? new Date(value) : new Date()}
          mode={mode}
          display={
            Platform.OS === 'ios' ? (mode === 'datetime' ? 'default' : 'inline') : 'default'
          }
          onChange={(event, date) => {
            if (Platform.OS !== 'ios') setOpen(false);
            if (event.type === 'set' && date) onChange(date.getTime());
          }}
        />
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  value: {
    flex: 1,
    height: 50,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  valueText: { fontSize: fontSize.md, color: colors.text },
  placeholder: { color: colors.textFaint },
  clear: { fontSize: fontSize.sm, color: colors.danger },
});
