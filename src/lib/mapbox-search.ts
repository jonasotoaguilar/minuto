import { z } from 'zod';

const MAPBOX_SEARCH_API_BASE_URL = 'https://api.mapbox.com/search/searchbox/v1';

export const MAPBOX_SEARCH_SESSION = {
  DEFAULT_LANGUAGE: 'es',
  DEFAULT_LIMIT: 5,
  INACTIVITY_TIMEOUT_MS: 3 * 60 * 1000,
  MIN_QUERY_LENGTH: 3,
} as const;

export interface SelectedOfficeLocation {
  addressLabel: string;
  latitude: number;
  longitude: number;
}

export interface MapboxSuggestion {
  addressLabel: string;
  featureType: string;
  fullAddress?: string;
  mapboxId: string;
  name: string;
  placeFormatted: string;
}

interface MapboxSuggestResponseSuggestion {
  feature_type?: string;
  full_address?: string;
  mapbox_id?: string;
  name?: string;
  place_formatted?: string;
}

interface MapboxRetrieveFeature {
  geometry?: MapboxRetrieveGeometry;
  properties?: MapboxRetrieveProperties;
}

interface MapboxRetrieveGeometry {
  coordinates?: [number, number] | number[];
}

interface MapboxRetrieveProperties {
  address?: string;
  coordinates?: MapboxRetrieveCoordinates;
  full_address?: string;
  name?: string;
  place_formatted?: string;
}

interface MapboxRetrieveCoordinates {
  latitude?: number;
  longitude?: number;
}

const mapboxSuggestResponseSchema = z.object({
  suggestions: z
    .array(
      z.object({
        feature_type: z.string().optional(),
        full_address: z.string().optional(),
        mapbox_id: z.string().optional(),
        name: z.string().optional(),
        place_formatted: z.string().optional(),
      }),
    )
    .optional(),
});

const mapboxRetrieveResponseSchema = z.object({
  features: z
    .array(
      z.object({
        geometry: z
          .object({
            coordinates: z.array(z.number()).optional(),
          })
          .optional(),
        properties: z
          .object({
            address: z.string().optional(),
            coordinates: z
              .object({
                latitude: z.number().optional(),
                longitude: z.number().optional(),
              })
              .optional(),
            full_address: z.string().optional(),
            name: z.string().optional(),
            place_formatted: z.string().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

interface MapboxRequestOptions {
  language?: string;
  signal?: AbortSignal;
}

interface SuggestOfficeLocationOptions extends MapboxRequestOptions {
  country?: string;
  limit?: number;
  query: string;
  sessionToken: string;
}

interface RetrieveOfficeLocationOptions extends MapboxRequestOptions {
  mapboxId: string;
  sessionToken: string;
}

export class MapboxSearchError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'MapboxSearchError';
    this.status = status;
  }
}

export function createMapboxSessionToken(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `mapbox-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isMapboxSessionExpired(
  lastInteractionAt: number | null,
  now = Date.now(),
): boolean {
  if (!lastInteractionAt) {
    return true;
  }

  return now - lastInteractionAt >= MAPBOX_SEARCH_SESSION.INACTIVITY_TIMEOUT_MS;
}

export function getMapboxPublicToken(): string {
  const token = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN?.trim();

  if (!token) {
    throw new MapboxSearchError(
      'Falta EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN. Configuralo para habilitar la búsqueda de ubicaciones.',
    );
  }

  return token;
}

export async function suggestOfficeLocations({
  country,
  language = MAPBOX_SEARCH_SESSION.DEFAULT_LANGUAGE,
  limit = MAPBOX_SEARCH_SESSION.DEFAULT_LIMIT,
  query,
  sessionToken,
  signal,
}: SuggestOfficeLocationOptions): Promise<MapboxSuggestion[]> {
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < MAPBOX_SEARCH_SESSION.MIN_QUERY_LENGTH) {
    return [] satisfies MapboxSuggestion[];
  }

  const response = mapboxSuggestResponseSchema.parse(
    await fetchMapbox(
      '/suggest',
      {
        access_token: getMapboxPublicToken(),
        country,
        language,
        limit: String(limit),
        q: trimmedQuery,
        session_token: sessionToken,
      },
      signal,
    ),
  );

  return (response.suggestions ?? []).flatMap(normalizeSuggestion);
}

export async function retrieveOfficeLocation({
  language = MAPBOX_SEARCH_SESSION.DEFAULT_LANGUAGE,
  mapboxId,
  sessionToken,
  signal,
}: RetrieveOfficeLocationOptions): Promise<SelectedOfficeLocation> {
  const response = mapboxRetrieveResponseSchema.parse(
    await fetchMapbox(
      `/retrieve/${encodeURIComponent(mapboxId)}`,
      {
        access_token: getMapboxPublicToken(),
        language,
        session_token: sessionToken,
      },
      signal,
    ),
  );

  const feature = response.features?.[0];

  if (!feature) {
    throw new MapboxSearchError('No pudimos recuperar la ubicación elegida.');
  }

  return normalizeSelectedOfficeLocation(feature);
}

function normalizeSuggestion(
  suggestion: MapboxSuggestResponseSuggestion,
): MapboxSuggestion[] {
  if (
    !suggestion.mapbox_id ||
    !suggestion.name ||
    !suggestion.place_formatted
  ) {
    return [];
  }

  return [
    {
      addressLabel:
        suggestion.full_address ??
        [suggestion.name, suggestion.place_formatted]
          .filter(Boolean)
          .join(', '),
      featureType: suggestion.feature_type ?? 'unknown',
      fullAddress: suggestion.full_address,
      mapboxId: suggestion.mapbox_id,
      name: suggestion.name,
      placeFormatted: suggestion.place_formatted,
    },
  ];
}

function normalizeSelectedOfficeLocation(feature: MapboxRetrieveFeature) {
  const properties = feature.properties;
  const coordinates = properties?.coordinates;
  const geometryCoordinates = feature.geometry?.coordinates;
  const longitude = coordinates?.longitude ?? geometryCoordinates?.[0];
  const latitude = coordinates?.latitude ?? geometryCoordinates?.[1];

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new MapboxSearchError(
      'La ubicación elegida no devolvió coordenadas válidas.',
    );
  }

  return {
    addressLabel:
      properties?.full_address ??
      ([properties?.name, properties?.place_formatted]
        .filter(
          (value): value is string =>
            typeof value === 'string' && value.length > 0,
        )
        .join(', ') ||
        properties?.address ||
        'Ubicación seleccionada'),
    latitude,
    longitude,
  } satisfies SelectedOfficeLocation;
}

async function fetchMapbox(
  path: string,
  query: Record<string, string | undefined>,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const response = await fetch(
    `${MAPBOX_SEARCH_API_BASE_URL}${path}?${searchParams.toString()}`,
    {
      headers: {
        Accept: 'application/json',
      },
      signal,
    },
  );

  if (!response.ok) {
    throw new MapboxSearchError(
      getMapboxErrorMessage(response.status),
      response.status,
    );
  }

  return await response.json();
}

function getMapboxErrorMessage(status: number) {
  if (status === 401 || status === 403) {
    return 'El token público de Mapbox no es válido o no tiene permisos para Search Box.';
  }

  if (status === 429) {
    return 'Mapbox rechazó la búsqueda por límite de uso. Probá de nuevo en un rato.';
  }

  if (status >= 500) {
    return 'Mapbox no está respondiendo bien ahora. Probá de nuevo en un rato.';
  }

  return 'No pudimos buscar ubicaciones ahora.';
}
