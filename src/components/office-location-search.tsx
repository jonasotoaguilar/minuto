import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import {
  createMapboxSessionToken,
  isMapboxSessionExpired,
  MAPBOX_SEARCH_SESSION,
  type MapboxSuggestion,
  retrieveOfficeLocation,
  type SelectedOfficeLocation,
  suggestOfficeLocations,
} from '@/lib/mapbox-search';
import {
  GlassCard,
  SecondaryButton,
  TextField,
  ThemedText,
} from '@/theme/primitives';

interface OfficeLocationSearchProps {
  disabled?: boolean;
  onSelectionChange: (value: SelectedOfficeLocation | null) => void;
  onTouched?: () => void;
  selectedLocation: SelectedOfficeLocation | null;
  validationMessage?: string;
}

export function OfficeLocationSearch({
  disabled = false,
  onSelectionChange,
  onTouched,
  selectedLocation,
  validationMessage,
}: OfficeLocationSearchProps) {
  const theme = useTheme();
  const [query, setQuery] = useState(selectedLocation?.addressLabel ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrievingSelection, setIsRetrievingSelection] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([]);
  const sessionTokenRef = useRef<string | null>(null);
  const lastInteractionAtRef = useRef<number | null>(null);
  const inactivityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const suppressNextSearchRef = useRef(false);

  const hasPendingQuery = useMemo(() => query.trim().length > 0, [query]);
  const showEmptyState =
    !selectedLocation &&
    !isLoading &&
    !errorMessage &&
    query.trim().length >= MAPBOX_SEARCH_SESSION.MIN_QUERY_LENGTH &&
    suggestions.length === 0;

  const clearSessionTimeout = useCallback(() => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
  }, []);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    lastInteractionAtRef.current = null;
    clearSessionTimeout();
  }, [clearSessionTimeout]);

  const markSessionActivity = useCallback(() => {
    const now = Date.now();

    if (isMapboxSessionExpired(lastInteractionAtRef.current, now)) {
      sessionTokenRef.current = createMapboxSessionToken();
    }

    lastInteractionAtRef.current = now;
    clearSessionTimeout();
    inactivityTimeoutRef.current = setTimeout(() => {
      sessionTokenRef.current = null;
      lastInteractionAtRef.current = null;
      inactivityTimeoutRef.current = null;
    }, MAPBOX_SEARCH_SESSION.INACTIVITY_TIMEOUT_MS);

    return sessionTokenRef.current ?? createMapboxSessionToken();
  }, [clearSessionTimeout]);

  useEffect(() => {
    if (selectedLocation) {
      setQuery(selectedLocation.addressLabel);
      return;
    }

    if (!hasPendingQuery) {
      setQuery('');
    }
  }, [hasPendingQuery, selectedLocation]);

  useEffect(
    () => () => {
      clearSessionTimeout();
    },
    [clearSessionTimeout],
  );

  useEffect(() => {
    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      return;
    }

    if (disabled || selectedLocation) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < MAPBOX_SEARCH_SESSION.MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setIsLoading(false);
      setErrorMessage('');
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        setIsLoading(true);
        setErrorMessage('');
        const sessionToken = markSessionActivity();
        const nextSuggestions = await suggestOfficeLocations({
          query: trimmedQuery,
          sessionToken,
          signal: controller.signal,
        });
        setSuggestions(nextSuggestions);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSuggestions([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'No pudimos buscar ubicaciones ahora.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [disabled, markSessionActivity, query, selectedLocation]);

  const handleSelectSuggestion = useCallback(
    async (suggestion: MapboxSuggestion) => {
      try {
        setIsRetrievingSelection(true);
        setErrorMessage('');
        onTouched?.();
        const sessionToken = markSessionActivity();
        const nextSelectedLocation = await retrieveOfficeLocation({
          mapboxId: suggestion.mapboxId,
          sessionToken,
        });

        suppressNextSearchRef.current = true;
        setQuery(nextSelectedLocation.addressLabel);
        setSuggestions([]);
        onSelectionChange(nextSelectedLocation);
        resetSession();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'No pudimos recuperar la ubicación elegida.',
        );
      } finally {
        setIsRetrievingSelection(false);
      }
    },
    [markSessionActivity, onSelectionChange, onTouched, resetSession],
  );

  const handleClearSelection = useCallback(() => {
    suppressNextSearchRef.current = true;
    setQuery('');
    setSuggestions([]);
    setErrorMessage('');
    onSelectionChange(null);
    onTouched?.();
    resetSession();
  }, [onSelectionChange, onTouched, resetSession]);

  return (
    <View style={[styles.container, { gap: theme.spacing.xs }]}>
      <ThemedText selectable style={styles.label} variant="label">
        Buscar dirección o punto de referencia
      </ThemedText>
      <ThemedText
        colorToken="secondary"
        selectable
        style={styles.helperText}
        variant="bodySmall"
      >
        Buscá la oficina, elegí un resultado y guardamos sus coordenadas
        exactas.
      </ThemedText>

      <TextField
        autoCapitalize="none"
        autoCorrect={false}
        containerStyle={styles.input}
        editable={!disabled && !isRetrievingSelection}
        onBlur={() => onTouched?.()}
        onChangeText={(value) => {
          suppressNextSearchRef.current = false;
          setQuery(value);
          setErrorMessage('');

          if (selectedLocation) {
            onSelectionChange(null);
          }
        }}
        placeholder="Ejemplo: Av. Libertador 1000, Buenos Aires"
        value={query}
      />

      {isLoading || isRetrievingSelection ? (
        <GlassCard
          style={[styles.feedbackCard, { gap: theme.spacing.xs }]}
          variant="soft"
        >
          <ActivityIndicator color={theme.colors.brand.primary} size="small" />
          <ThemedText
            selectable
            style={styles.feedbackText}
            variant="bodySmall"
          >
            {isRetrievingSelection
              ? 'Recuperando la ubicación elegida...'
              : 'Buscando sugerencias...'}
          </ThemedText>
        </GlassCard>
      ) : null}

      {errorMessage ? (
        <GlassCard
          style={[styles.feedbackCard, { gap: theme.spacing.xs }]}
          variant="soft"
        >
          <ThemedText
            colorToken="error"
            selectable
            style={styles.errorText}
            variant="caption"
          >
            {errorMessage}
          </ThemedText>
        </GlassCard>
      ) : null}

      {showEmptyState ? (
        <GlassCard
          style={[styles.feedbackCard, { gap: theme.spacing.xs }]}
          variant="soft"
        >
          <ThemedText
            colorToken="secondary"
            selectable
            style={styles.feedbackText}
            variant="bodySmall"
          >
            No encontramos coincidencias. Probá con una calle, barrio o ciudad.
          </ThemedText>
        </GlassCard>
      ) : null}

      {suggestions.length > 0 ? (
        <GlassCard padding={0} style={styles.suggestionsCard} variant="strong">
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion.mapboxId}
              onPress={() => void handleSelectSuggestion(suggestion)}
              style={({ pressed }) => [
                styles.suggestionRow,
                {
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.sm,
                },
                pressed
                  ? { backgroundColor: theme.colors.background.selected }
                  : null,
              ]}
            >
              <View style={[styles.suggestionContent, { gap: 2 }]}>
                <ThemedText
                  selectable
                  style={styles.suggestionTitle}
                  variant="label"
                >
                  {suggestion.name}
                </ThemedText>
                <ThemedText
                  colorToken="secondary"
                  selectable
                  style={styles.suggestionSubtitle}
                  variant="caption"
                >
                  {suggestion.fullAddress ?? suggestion.placeFormatted}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </GlassCard>
      ) : null}

      {selectedLocation ? (
        <GlassCard
          style={[styles.selectionCard, { gap: theme.spacing.xs }]}
          variant="soft"
        >
          <ThemedText selectable style={styles.selectionTitle} variant="title">
            Ubicación seleccionada
          </ThemedText>
          <ThemedText
            colorToken="secondary"
            selectable
            style={styles.selectionAddress}
            variant="bodySmall"
          >
            {selectedLocation.addressLabel}
          </ThemedText>
          <SecondaryButton
            fullWidth={false}
            label="Limpiar selección"
            onPress={handleClearSelection}
            style={[styles.secondaryButton, { marginTop: 2 }]}
          />
        </GlassCard>
      ) : null}

      {validationMessage ? (
        <ThemedText
          colorToken="error"
          selectable
          style={styles.errorText}
          variant="caption"
        >
          {validationMessage}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  label: {},
  helperText: {},
  input: {},
  feedbackCard: {},
  feedbackText: {},
  errorText: {},
  suggestionsCard: {
    overflow: 'hidden',
  },
  suggestionRow: {},
  suggestionContent: {},
  suggestionTitle: {},
  suggestionSubtitle: {},
  selectionCard: {},
  selectionTitle: {},
  selectionAddress: {},
  secondaryButton: {},
});
