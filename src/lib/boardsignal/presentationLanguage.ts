const PRESENTATION_LABELS: Record<string, string> = {
  desk_ready: "Review ready",
  beta_update: "BoardSignal update",
  latest_desk_not_opened: "Latest Review not opened",
  first_desk: "First Review",
  desk_completed: "Review completed",
  explain_desk: "Explain Review",
  beta_next: "Founding Access",
  beta_cost: "Founding Access cost",
  beta_request: "Founding Access request",
  founder_beta_request: "Founding Access request",
};

export function boardSignalPresentationLabel(value: string) {
  return PRESENTATION_LABELS[value] ?? value.replaceAll("_", " ");
}
