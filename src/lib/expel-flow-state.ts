export type ExpelFlowState =
  | 'idle'
  | 'choice'
  | 'confirm-suspend'
  | 'confirm-delete';

export type ExpelFlowEvent =
  | 'open-choice'
  | 'select-suspend'
  | 'select-delete'
  | 'close';

type ExpelFlowConfirmation = {
  body: string;
  title: string;
};

type ExpelFlowView = {
  confirmation: ExpelFlowConfirmation | null;
  isChoiceVisible: boolean;
  isConfirmationVisible: boolean;
};

const CONFIRM_DELETE: ExpelFlowConfirmation = {
  body: 'Esta acción elimina la membresía y no se puede deshacer.',
  title: 'Confirmar eliminación',
};

const CONFIRM_SUSPEND: ExpelFlowConfirmation = {
  body: 'Se va a desactivar su acceso, pero no se elimina su historial.',
  title: 'Confirmar despido',
};

export function transitionExpelFlowState(
  state: ExpelFlowState,
  event: ExpelFlowEvent,
): ExpelFlowState {
  if (event === 'close') {
    return 'idle';
  }

  if (event === 'open-choice') {
    return 'choice';
  }

  if (state !== 'choice') {
    return state;
  }

  if (event === 'select-suspend') {
    return 'confirm-suspend';
  }

  if (event === 'select-delete') {
    return 'confirm-delete';
  }

  return state;
}

export function getExpelFlowView(state: ExpelFlowState): ExpelFlowView {
  if (state === 'choice') {
    return {
      confirmation: null,
      isChoiceVisible: true,
      isConfirmationVisible: false,
    };
  }

  if (state === 'confirm-delete') {
    return {
      confirmation: CONFIRM_DELETE,
      isChoiceVisible: false,
      isConfirmationVisible: true,
    };
  }

  if (state === 'confirm-suspend') {
    return {
      confirmation: CONFIRM_SUSPEND,
      isChoiceVisible: false,
      isConfirmationVisible: true,
    };
  }

  return {
    confirmation: null,
    isChoiceVisible: false,
    isConfirmationVisible: false,
  };
}
