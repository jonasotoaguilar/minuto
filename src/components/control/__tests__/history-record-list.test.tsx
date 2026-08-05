import { render, screen } from '@testing-library/react-native';
import type { HistoryDisplayRow } from '@/components/control/history-format';
import { HistoryRecordList } from '@/components/control/history-record-list';
import { ThemedText } from '@/theme/primitives';

const SANTIAGO = 'America/Santiago';

function makeRow(
  overrides: Partial<HistoryDisplayRow> = {},
): HistoryDisplayRow {
  return {
    key: 'row-1',
    workDate: '2026-08-03',
    hasRecord: true,
    clockInAt: '2026-08-03T09:00:00.000Z',
    clockOutAt: '2026-08-03T18:00:00.000Z',
    status: 'complete',
    workedMinutes: 480,
    ...overrides,
  };
}

function renderList(
  rows: HistoryDisplayRow[],
  options: { isLoading?: boolean } = {},
) {
  return render(
    <HistoryRecordList
      currentTimezone={SANTIAGO}
      footer={<></>}
      header={<></>}
      isLoading={options.isLoading ?? false}
      rows={rows}
    />,
  );
}

describe('HistoryRecordList', () => {
  it('renders the day badge, journey times, status and worked minutes', () => {
    renderList([makeRow()]);

    expect(screen.getByText('LUN')).toBeOnTheScreen();
    expect(screen.getByText('03')).toBeOnTheScreen();
    expect(screen.getByText('05:00')).toBeOnTheScreen();
    expect(screen.getByText('14:00')).toBeOnTheScreen();
    expect(screen.getByText('Jornada completa')).toBeOnTheScreen();
    expect(screen.getByText('8h 0m')).toBeOnTheScreen();
  });

  it('renders an absence row without journey times', () => {
    renderList([
      makeRow({
        hasRecord: false,
        clockInAt: null,
        clockOutAt: null,
        status: 'incomplete',
        workedMinutes: 0,
      }),
    ]);

    expect(screen.getByText('Sin registro')).toBeOnTheScreen();
    expect(screen.getByText('Ausencia')).toBeOnTheScreen();
    expect(screen.getByText('-')).toBeOnTheScreen();
  });

  it('renders an auto-closed status label', () => {
    renderList([makeRow({ status: 'auto_closed' })]);

    expect(screen.getByText('Cierre automático')).toBeOnTheScreen();
  });

  it('shows the loading hint while loading without records', () => {
    renderList([], { isLoading: true });

    expect(screen.getByText('Cargando...')).toBeOnTheScreen();
  });

  it('shows the empty state when there are no records', () => {
    renderList([]);

    expect(screen.getByText('Sin registros')).toBeOnTheScreen();
    expect(
      screen.getByText('No hay registros para el mes seleccionado.'),
    ).toBeOnTheScreen();
  });

  it('renders the header and footer nodes', () => {
    render(
      <HistoryRecordList
        currentTimezone={SANTIAGO}
        footer={<ThemedText>Página 1 de 1</ThemedText>}
        header={<ThemedText>Historial control</ThemedText>}
        isLoading={false}
        rows={[makeRow()]}
      />,
    );

    expect(screen.getByText('Historial control')).toBeOnTheScreen();
    expect(screen.getByText('Página 1 de 1')).toBeOnTheScreen();
  });
});
