export interface DisputeMessage {
  sender: "user" | "support";
  message: string;
  at: string;
}

export interface DisputeThread {
  disputeId: string;
  status: "open" | "in_review" | "escalated" | "resolved";
  messages: DisputeMessage[];
}

export function createDispute(initialMessage: string): DisputeThread {
  return {
    disputeId: `dsp_${Date.now()}`,
    status: "open",
    messages: [{ sender: "user", message: initialMessage, at: new Date().toISOString() }]
  };
}

export function addMessage(thread: DisputeThread, sender: "user" | "support", message: string): DisputeThread {
  return {
    ...thread,
    messages: [...thread.messages, { sender, message, at: new Date().toISOString() }]
  };
}
