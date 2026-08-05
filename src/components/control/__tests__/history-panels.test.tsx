import { fireEvent, render, screen } from '@testing-library/react-native';
import type { HistorySummary } from '@/components/control/history-format';
import { HistoryMetrics } from '@/components/control/history-metrics';
import { HistoryPeriodCard } from '@/components/control/history-period-card';

const summary: HistorySummary = {
  weeklyHours: 40,
  workedDays: 3,
  totalMinutes: 1200,
  overtimeMinutes: 45,
};

describe('HistoryPeriodCard', () => {
  it('renders the period label and both month arrows', () => {
    render(
      <HistoryPeriodCard
        errorMessage=""
        nextDisabled={false}
        onNext={() => undefined}
        onPrevious={() => undefined}
        periodLabel="agosto de 2026"
        previousDisabled={false}
      />,
    );

    expect(screen.getByText('agosto de 2026')).toBeOnTheScreen();
    expect(screen.getByLabelText('Mes anterior')).toBeOnTheScreen();
    expect(screen.getByLabelText('Mes siguiente')).toBeOnTheScreen();
  });

  it('disables the arrows and shows the error message when given', () => {
    render(
      <HistoryPeriodCard
        errorMessage="No se pudo cargar el historial."
        nextDisabled={true}
        onNext={() => undefined}
        onPrevious={() => undefined}
        periodLabel="agosto de 2026"
        previousDisabled={true}
      />,
    );

    expect(screen.getByLabelText('Mes anterior')).toBeDisabled();
    expect(screen.getByLabelText('Mes siguiente')).toBeDisabled();
    expect(
      screen.getByText('No se pudo cargar el historial.'),
    ).toBeOnTheScreen();
  });

  it('fires the navigation callbacks from each arrow', () => {
    const onPrevious = jest.fn();
    const onNext = jest.fn();

    render(
      <HistoryPeriodCard
        errorMessage=""
        nextDisabled={false}
        onNext={onNext}
        onPrevious={onPrevious}
        periodLabel="agosto de 2026"
        previousDisabled={false}
      />,
    );

    fireEvent.press(screen.getByLabelText('Mes anterior'));
    fireEvent.press(screen.getByLabelText('Mes siguiente'));

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});

describe('HistoryMetrics', () => {
  it('renders the totals, worked days and overtime cards', () => {
    render(<HistoryMetrics summary={summary} />);

    expect(screen.getByText('Horas totales')).toBeOnTheScreen();
    expect(screen.getByText('20h 0m')).toBeOnTheScreen();
    expect(screen.getByText('Días asistidos')).toBeOnTheScreen();
    expect(screen.getByText('3')).toBeOnTheScreen();
    expect(screen.getByText('Horas extra')).toBeOnTheScreen();
    expect(screen.getByText('0h 45m')).toBeOnTheScreen();
    expect(screen.getByText('+40 horas semanal')).toBeOnTheScreen();
  });

  it('renders a fractional weekly-hours helper', () => {
    render(<HistoryMetrics summary={{ ...summary, weeklyHours: 37.5 }} />);

    expect(screen.getByText('+37,5 horas semanal')).toBeOnTheScreen();
  });
});
