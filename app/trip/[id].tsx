import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ModalHeader } from '../../src/components/ModalHeader';
import { TripForm, TripFormValues } from '../../src/components/TripForm';
import { deleteTrip, getTrip, updateTrip } from '../../src/repositories/tripsRepo';
import { Colors } from '../../src/theme';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function EditTripScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [initial, setInitial] = useState<TripFormValues | null>(null);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const trip = await getTrip(id);
      if (trip) {
        setInitial({
          name: trip.name,
          baseCurrency: trip.base_currency,
          budget: trip.budget,
          startDate: trip.start_date,
          endDate: trip.end_date,
        });
      }
    })();
  }, [id]);

  async function onSubmit(values: TripFormValues) {
    if (!id) return;
    await updateTrip(id, {
      name: values.name,
      baseCurrency: values.baseCurrency,
      budget: values.budget,
      startDate: values.startDate,
      endDate: values.endDate,
    });
    router.back();
  }

  function onDelete() {
    if (!id || !initial) return;
    Alert.alert(initial.name, t('trips.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteTrip(id);
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <ModalHeader title={t('common.edit')} onClose={() => router.back()} />
      {!initial ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <TripForm
          initial={initial}
          submitLabel={t('common.save')}
          onSubmit={onSubmit}
          onDelete={onDelete}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
