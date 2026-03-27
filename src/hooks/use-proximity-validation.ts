import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

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
  officeId?: string;
  officeName?: string;
}

const ACCURACY_THRESHOLD = 50; // meters

export function useProximityValidation() {
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
        });
        return null;
      }

      // Return location for RPC validation
      // Status will be updated by the caller after RPC response
      setState({
        status: 'idle',
        location: locationData,
      });
      return locationData;
    } catch (_error) {
      setState({
        status: 'blocked',
        location: null,
        errorReason: 'location_unavailable',
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
          officeId: result.officeId,
          officeName: result.officeName,
        }));
      } else if (result.errorCode === 'OUT_OF_RANGE') {
        setState((prev) => ({
          ...prev,
          status: 'out_of_range',
        }));
      } else if (result.errorCode === 'GPS_ACCURACY_TOO_LOW') {
        setState((prev) => ({
          ...prev,
          status: 'blocked',
          errorReason: 'gps_accuracy',
        }));
      }
    },
    [],
  );

  const selectRemote = useCallback(() => {
    setState({
      status: 'remote',
      location: null,
    });
  }, []);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      location: null,
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
