import { Ionicons } from '@expo/vector-icons';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Screen } from '../../src/components/Screen';
import { useActiveTrip, useTrips } from '../../src/hooks/data';
import { formatAmount } from '../../src/lib/currencies';
import type { TripRow } from '../../src/db/types';
import { deleteTrip, setActiveTrip } from '../../src/repositories/tripsRepo';
import { colors, fontSize, fontWeight, radius, spacing } from '../../src/theme';

export default function TripsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { trips, reload } = useTrips();
  const { trip: active, reload: reloadActive } = useActiveTrip();

  async function makeActive(id: string) {
    await setActiveTrip(id);
    await Promise.all([reload(), reloadActive()]);
  }

  function confirmDelete(trip: TripRow) {
    Alert.alert(trip.name, t('trips.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteTrip(trip.id);
          await Promise.all([reload(), reloadActive()]);
        },
      },
    ]);
  }

  return (
    <Screen title={t('trips.title')}>
      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{t('trips.empty')}</Text>}
        renderItem={({ item }) => {
          const isActive = active?.id === item.id;
          return (
            <Pressable
              style={[styles.card, isActive && styles.cardActive]}
              onPress={() => makeActive(item.id)}
              onLongPress={() => confirmDelete(item)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.name}>{item.name}</Text>
                {isActive ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{t('trips.active')}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.cardMeta}>
                <Text style={styles.meta}>{item.base_currency}</Text>
                {item.budget != null ? (
                  <Text style={styles.meta}>
                    {t('trips.budget')}: {formatAmount(item.budget, item.base_currency)}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable style={styles.fab} onPress={() => router.push('/trip/new')}>
        <Ionicons name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, paddingBottom: 96 },
  empty: {
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: fontSize.md,
    marginTop: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flexShrink: 1,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    color: colors.onPrimary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  cardMeta: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  meta: { fontSize: fontSize.sm, color: colors.textMuted },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
