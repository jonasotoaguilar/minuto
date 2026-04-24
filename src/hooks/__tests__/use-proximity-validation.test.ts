import { act, renderHook } from '@testing-library/react-native';
import * as Location from 'expo-location';

import { useProximityValidation } from '../use-proximity-validation';

jest.mock('expo-location');

const mockLocation = Location as jest.Mocked<typeof Location>;

describe('useProximityValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({
      status: 'granted',
    } as Location.LocationPermissionResponse);

    mockLocation.getCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as Location.LocationObject);
  });

  it('starts with idle status and null location', () => {
    const { result } = renderHook(() => useProximityValidation());

    expect(result.current.state).toEqual({
      status: 'idle',
      location: null,
    });
  });

  it('sets blocked status with permission_denied when permission is denied', async () => {
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValueOnce({
      status: 'denied',
    } as Location.LocationPermissionResponse);

    const { result } = renderHook(() => useProximityValidation());

    await act(async () => {
      const location = await result.current.validateLocation();
      expect(location).toBeNull();
    });

    expect(result.current.state).toEqual({
      status: 'blocked',
      location: null,
      errorReason: 'permission_denied',
      errorMessage:
        'Necesitamos acceso a tu ubicación para validar tu zona de trabajo.',
    });
  });

  it('sets blocked status with location_unavailable when location lookup fails', async () => {
    mockLocation.getCurrentPositionAsync.mockRejectedValueOnce(
      new Error('Location unavailable'),
    );

    const { result } = renderHook(() => useProximityValidation());

    await act(async () => {
      const location = await result.current.validateLocation();
      expect(location).toBeNull();
    });

    expect(result.current.state).toEqual({
      status: 'blocked',
      location: null,
      errorReason: 'location_unavailable',
      errorMessage: 'Location unavailable',
    });
  });

  it('sets blocked status with gps_accuracy when GPS accuracy is worse than 50m', async () => {
    mockLocation.getCurrentPositionAsync.mockResolvedValueOnce({
      coords: {
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 75,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    } as Location.LocationObject);

    const { result } = renderHook(() => useProximityValidation());

    await act(async () => {
      const location = await result.current.validateLocation();
      expect(location).toBeNull();
    });

    expect(result.current.state).toEqual({
      status: 'blocked',
      location: {
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 75,
      },
      errorReason: 'gps_accuracy',
      errorMessage:
        'La señal GPS es demasiado débil para validar tu zona de trabajo.',
    });
  });

  it('returns location data for RPC validation when GPS accuracy is good', async () => {
    const { result } = renderHook(() => useProximityValidation());

    let locationResult:
      | (ReturnType<typeof result.current.validateLocation> extends Promise<
          infer TValue
        >
          ? TValue
          : never)
      | null = null;

    await act(async () => {
      locationResult = await result.current.validateLocation();
    });

    expect(locationResult).toEqual({
      latitude: -34.6037,
      longitude: -58.3816,
      accuracy: 10,
    });
    expect(result.current.state).toEqual({
      status: 'idle',
      location: {
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 10,
      },
    });
  });

  it('sets status to remote when selectRemote is called', () => {
    const { result } = renderHook(() => useProximityValidation());

    act(() => {
      result.current.selectRemote();
    });

    expect(result.current.state).toEqual({
      status: 'remote',
      location: null,
    });
  });

  it('returns to idle state when reset is called', async () => {
    const { result } = renderHook(() => useProximityValidation());

    await act(async () => {
      await result.current.validateLocation();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toEqual({
      status: 'idle',
      location: null,
    });
  });

  it('sets valid status with office info when validation succeeds', () => {
    const { result } = renderHook(() => useProximityValidation());

    act(() => {
      result.current.setValidationResult({
        success: true,
        officeId: 'office-123',
        officeName: 'Casa Central',
      });
    });

    expect(result.current.state).toEqual({
      status: 'valid',
      location: null,
      officeId: 'office-123',
      officeName: 'Casa Central',
    });
  });

  it('sets out_of_range status when validation returns OUT_OF_RANGE', async () => {
    const { result } = renderHook(() => useProximityValidation());

    await act(async () => {
      await result.current.validateLocation();
    });

    act(() => {
      result.current.setValidationResult({
        success: false,
        errorCode: 'OUT_OF_RANGE',
      });
    });

    expect(result.current.state).toEqual({
      status: 'out_of_range',
      location: {
        latitude: -34.6037,
        longitude: -58.3816,
        accuracy: 10,
      },
    });
  });
});
