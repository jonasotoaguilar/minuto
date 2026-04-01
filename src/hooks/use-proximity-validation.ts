import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { getErrorMessage } from '@/lib/error';

export type ProximityStatus =
  | 'idle'
  | 'loading'
  | 'valid'
  | 'out_of_range'
  | 'blocked'
  | 'remote';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface ProximityState {
  status: ProximityStatus;
  location: LocationData | null;
  errorReason?: 'gps_accuracy' | 'permission_denied' | 'location_unavailable';
  errorMessage?: string;
  officeId?: string;
  officeName?: string;
}

export interface UseProximityValidationResult {
  reset: () => void;
  selectRemote: () => void;
  setValidationResult: (result: {
    success: boolean;
    officeId?: string;
    officeName?: string;
    errorCode?: string;
  }) => void;
  state: ProximityState;
  validateLocation: () => Promise<LocationData | null>;
}

const ACCURACY_THRESHOLD = 50; // meters

export function useProximityValidation(): UseProximityValidationResult {
  const [state, setState] = useState<ProximityState>({
    status: 'idle',
    location: null,
  });

  const validateLocation = useCallback(async () => {
    setState({ status: 'loading', location: null });

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState({
          status: 'blocked',
          location: null,
          errorReason: 'permission_denied',
          errorMessage:
            'Necesitamos acceso a tu ubicación para validar tu zona de trabajo.',
        });
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationData: LocationData = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? 999,
      };

      if (locationData.accuracy > ACCURACY_THRESHOLD) {
        setState({
          status: 'blocked',
          location: locationData,
          errorReason: 'gps_accuracy',
          errorMessage:
            'La señal GPS es demasiado débil para validar tu zona de trabajo.',
        });
        return null;
      }

      // Return location for RPC validation
      // Status will be updated by the caller after RPC response
      setState({
        status: 'idle',
        location: locationData,
        errorMessage: undefined,
      });
      return locationData;
    } catch (error) {
      setState({
        status: 'blocked',
        location: null,
        errorReason: 'location_unavailable',
        errorMessage:
          getErrorMessage(error) ??
          'No pudimos obtener tu ubicación actual. Intentá de nuevo.',
      });
      return null;
    }
  }, []);

  const setValidationResult = useCallback(
    (result: {
      success: boolean;
      officeId?: string;
      officeName?: string;
      errorCode?: string;
    }) => {
      if (result.success) {
        setState((prev) => ({
          ...prev,
          status: 'valid',
          errorReason: undefined,
          errorMessage: undefined,
          officeId: result.officeId,
          officeName: result.officeName,
        }));
      } else if (result.errorCode === 'OUT_OF_RANGE') {
        setState((prev) => ({
          ...prev,
          status: 'out_of_range',
          errorReason: undefined,
          errorMessage: undefined,
          officeId: undefined,
          officeName: undefined,
        }));
      } else if (result.errorCode === 'GPS_ACCURACY_TOO_LOW') {
        setState((prev) => ({
          ...prev,
          status: 'blocked',
          errorReason: 'gps_accuracy',
          errorMessage:
            'La señal GPS es demasiado débil para validar tu zona de trabajo.',
        }));
      } else {
        setState((prev) => ({
          ...prev,
          status: 'blocked',
          errorReason: 'location_unavailable',
          errorMessage:
            'La validación de ubicación falló. Intentá obtener tu ubicación otra vez.',
          officeId: undefined,
          officeName: undefined,
        }));
      }
    },
    [],
  );

  const selectRemote = useCallback(() => {
    setState({
      status: 'remote',
      location: null,
      errorMessage: undefined,
    });
  }, []);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      location: null,
      errorMessage: undefined,
    });
  }, []);

  return {
    state,
    validateLocation,
    setValidationResult,
    selectRemote,
    reset,
  };
}
