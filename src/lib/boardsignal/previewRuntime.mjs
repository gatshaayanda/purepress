export const PREVIEW_PHASE = Object.freeze({
  INITIALIZING: "initializing",
  READY: "ready",
  REFRESHING_BACKGROUND: "refreshing_background",
  ERROR_WITH_LAST_GOOD_PREVIEW: "error_with_last_good_preview",
  INITIAL_ERROR: "initial_error",
});

export function createPreviewRuntimeState(continuityPreview) {
  const hasPreview = Boolean(continuityPreview);
  return {
    phase: hasPreview ? PREVIEW_PHASE.READY : PREVIEW_PHASE.INITIALIZING,
    preview: continuityPreview ?? null,
    status: null,
    hasDisplayedPreview: hasPreview,
    initialAcquisitionStarted: false,
    nextSequence: 1,
    inFlightSequence: null,
    lastSettledSequence: 0,
    error: "",
    refreshNotice: "",
  };
}

export function previewVisualState(state) {
  if (state.hasDisplayedPreview && state.preview) return "preview";
  if (!state.status && state.phase === PREVIEW_PHASE.INITIAL_ERROR) return "error";
  if (!state.status && state.phase === PREVIEW_PHASE.INITIALIZING) return "loader";
  return "status";
}

export function restorePreviewContinuity(state, preview) {
  if (!preview) return state;
  return {
    ...state,
    phase: PREVIEW_PHASE.READY,
    preview,
    hasDisplayedPreview: true,
    error: "",
    refreshNotice: "",
  };
}

export function applyPreviewStartupFailure(state, message) {
  if (state.hasDisplayedPreview && state.preview) {
    return {
      ...state,
      phase: PREVIEW_PHASE.ERROR_WITH_LAST_GOOD_PREVIEW,
      refreshNotice: message || "Couldn't refresh just now. Showing your saved Preview.",
    };
  }
  return {
    ...state,
    phase: PREVIEW_PHASE.INITIAL_ERROR,
    error: message || "BoardSignal preview could not be loaded.",
    refreshNotice: "",
  };
}

export function beginPreviewStatusRequest(state, source = "background") {
  if (state.inFlightSequence !== null) return { accepted: false, sequence: null, state };
  const initial = source === "initial";
  if (initial && state.initialAcquisitionStarted) return { accepted: false, sequence: null, state };

  const sequence = state.nextSequence;
  return {
    accepted: true,
    sequence,
    state: {
      ...state,
      phase: state.hasDisplayedPreview && state.preview
        ? PREVIEW_PHASE.REFRESHING_BACKGROUND
        : PREVIEW_PHASE.INITIALIZING,
      initialAcquisitionStarted: state.initialAcquisitionStarted || initial,
      nextSequence: sequence + 1,
      inFlightSequence: sequence,
      error: state.hasDisplayedPreview ? state.error : "",
      refreshNotice: "",
    },
  };
}

export function cancelPreviewStatusRequest(state, sequence) {
  if (state.inFlightSequence !== sequence) return state;
  return {
    ...state,
    inFlightSequence: null,
    lastSettledSequence: Math.max(state.lastSettledSequence, sequence),
    phase: state.hasDisplayedPreview && state.preview ? PREVIEW_PHASE.READY : state.phase,
  };
}

export function applyPreviewStatusSuccess(state, sequence, status) {
  if (!Number.isSafeInteger(sequence) || sequence <= state.lastSettledSequence) return state;
  if (state.inFlightSequence !== sequence) return state;

  const nextPreview = status?.preview ?? state.preview;
  const hasDisplayedPreview = state.hasDisplayedPreview || Boolean(nextPreview);
  return {
    ...state,
    phase: PREVIEW_PHASE.READY,
    preview: nextPreview ?? null,
    status: status ?? state.status,
    hasDisplayedPreview,
    inFlightSequence: null,
    lastSettledSequence: sequence,
    error: "",
    refreshNotice: "",
  };
}

export function applyPreviewStatusFailure(state, sequence, message) {
  if (!Number.isSafeInteger(sequence) || sequence <= state.lastSettledSequence) return state;
  if (state.inFlightSequence !== sequence) return state;

  if (state.hasDisplayedPreview && state.preview) {
    return {
      ...state,
      phase: PREVIEW_PHASE.ERROR_WITH_LAST_GOOD_PREVIEW,
      inFlightSequence: null,
      lastSettledSequence: sequence,
      refreshNotice: "Couldn't refresh just now. Showing your saved Preview.",
    };
  }

  return {
    ...state,
    phase: PREVIEW_PHASE.INITIAL_ERROR,
    inFlightSequence: null,
    lastSettledSequence: sequence,
    error: message || "BoardSignal preview could not be loaded.",
    refreshNotice: "",
  };
}

export function acceptPreviewStatusSnapshot(state, status) {
  const nextPreview = status?.preview ?? state.preview;
  const hasDisplayedPreview = state.hasDisplayedPreview || Boolean(nextPreview);
  return {
    ...state,
    phase: PREVIEW_PHASE.READY,
    preview: nextPreview ?? null,
    status: status ?? state.status,
    hasDisplayedPreview,
    error: "",
    refreshNotice: "",
  };
}

export function previewShouldPoll(status) {
  return status?.state === "preview_ready";
}

export function previewCanContinue(status) {
  return Boolean(
    (status?.state === "approved" && status.accessReady === true)
    || (status?.state === "preview_ready" && status.provisionalAccessReady === true),
  );
}
