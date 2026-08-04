import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/theme/primitives';
import { formatClock, formatLongDate } from './format';

export interface LiveClockProps {
  currentTimezone: string;
}

export function LiveClock({ currentTimezone }: LiveClockProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <ThemedText style={styles.clock} variant="display">
        {formatClock(now, currentTimezone)}
      </ThemedText>
      <ThemedText colorToken="secondary" style={styles.date} variant="body">
        {formatLongDate(now, currentTimezone)}
      </ThemedText>
    </>
  );
}

const styles = StyleSheet.create({
  clock: {
    textAlign: 'center',
  },
  date: {
    textAlign: 'center',
    textTransform: 'capitalize',
  },
});
