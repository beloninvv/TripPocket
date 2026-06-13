import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ModalHeader } from '../../src/components/ModalHeader';
import { TripForm, TripFormValues } from '../../src/components/TripForm';
import { getSetting } from '../../src/repositories/settingsRepo';
import { createTrip } from '../../src/repositories/tripsRepo';
import { ensureRatesFresh } from '../../src/services/currency';
import { Colors } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function NewTripScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [defaultCurrency, setDefaultCurrency] = useState('RUB');

  useEffect(() => {
    getSetting('base_currency').then((c) => c && setDefaultCurrency(c));
  }, []);

  async function onSubmit(values: TripFormValues) {
    await createTrip({
      name: values.name,
      baseCurrency: values.baseCurrency,
      budget: values.budget,
      startDate: values.startDate,
      endDate: values.endDate,
    });
    ensureRatesFresh(values.baseCurrency).catch(() => {});
    router.back();
  }

  return (
    <View style={styles.container}>
      <ModalHeader title={t('trips.new')} onClose={() => router.back()} />
      <TripForm
        initial={{
          name: '',
          baseCurrency: defaultCurrency,
          budget: null,
          startDate: null,
          endDate: null,
        }}
        submitLabel={t('common.create')}
        onSubmit={onSubmit}
      />
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
