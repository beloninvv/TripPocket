import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fontSize, fontWeight, spacing } from '../theme';

type Props = {
  title?: string;
  children?: ReactNode;
};

/** Базовая обёртка экрана: safe-area, фон, опциональный заголовок. */
export function Screen({ title, children }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  body: {
    flex: 1,
  },
});
