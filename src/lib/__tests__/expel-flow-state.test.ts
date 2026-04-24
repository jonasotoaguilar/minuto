import {
  type ExpelFlowEvent,
  type ExpelFlowState,
  getExpelFlowView,
  transitionExpelFlowState,
} from '@/lib/expel-flow-state';

describe('expel flow state', () => {
  it('keeps destructive flow mutually exclusive across transitions', () => {
    const sequence: ExpelFlowEvent[] = [
      'open-choice',
      'select-delete',
      'close',
    ];

    const finalState = sequence.reduce<ExpelFlowState>(
      (current, event) => transitionExpelFlowState(current, event),
      'idle',
    );

    expect(finalState).toBe('idle');
    expect(getExpelFlowView(finalState)).toEqual({
      confirmation: null,
      isChoiceVisible: false,
      isConfirmationVisible: false,
    });
  });

  it('shows only one modal layer at a time', () => {
    const choiceView = getExpelFlowView('choice');
    const confirmDeleteView = getExpelFlowView('confirm-delete');
    const confirmSuspendView = getExpelFlowView('confirm-suspend');

    expect(choiceView.isChoiceVisible).toBe(true);
    expect(choiceView.isConfirmationVisible).toBe(false);
    expect(choiceView.confirmation).toBeNull();

    expect(confirmDeleteView.isChoiceVisible).toBe(false);
    expect(confirmDeleteView.isConfirmationVisible).toBe(true);
    expect(confirmDeleteView.confirmation?.title).toBe('Confirmar eliminación');

    expect(confirmSuspendView.isChoiceVisible).toBe(false);
    expect(confirmSuspendView.isConfirmationVisible).toBe(true);
    expect(confirmSuspendView.confirmation?.title).toBe('Confirmar despido');
  });
});
