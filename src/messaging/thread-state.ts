import type { Message } from "./contract";

export type ThreadMessage = Message & {
  delivery: "sending" | "sent" | "failed";
  clientId: string | null;
};

export type ThreadState = {
  messages: ThreadMessage[];
};

export function initialThreadState(messages: readonly Message[]): ThreadState {
  return { messages: messages.map(asSent) };
}

export function appendMessage(state: ThreadState, message: Message): ThreadState {
  if (state.messages.some((item) => item.id === message.id)) return state;
  const matchingPending = state.messages.find((item) =>
    item.delivery === "sending" &&
    item.senderId === message.senderId &&
    item.body === message.body,
  );
  if (matchingPending?.clientId) {
    return reconcilePendingMessage(state, matchingPending.clientId, message);
  }
  return { messages: chronological([...state.messages, asSent(message)]) };
}

export function prependMessages(state: ThreadState, messages: readonly Message[]): ThreadState {
  const knownIds = new Set(state.messages.map((item) => item.id));
  const additions = messages.filter((item) => !knownIds.has(item.id)).map(asSent);
  return additions.length === 0
    ? state
    : { messages: chronological([...additions, ...state.messages]) };
}

export function startPendingMessage(
  state: ThreadState,
  input: { clientId: string; senderId: string; body: string; sentAt: string },
): ThreadState {
  const pending: ThreadMessage = {
    id: `pending:${input.clientId}`,
    senderId: input.senderId,
    body: input.body,
    sentAt: input.sentAt,
    readAt: null,
    delivery: "sending",
    clientId: input.clientId,
  };
  return { messages: chronological([...state.messages, pending]) };
}

export function reconcilePendingMessage(
  state: ThreadState,
  clientId: string,
  message: Message,
): ThreadState {
  const withoutPendingOrDuplicate = state.messages.filter(
    (item) => item.clientId !== clientId && item.id !== message.id,
  );
  return { messages: chronological([...withoutPendingOrDuplicate, asSent(message)]) };
}

export function failPendingMessage(state: ThreadState, clientId: string): ThreadState {
  return {
    messages: state.messages.map((item) =>
      item.clientId === clientId ? { ...item, delivery: "failed" } : item,
    ),
  };
}

export function removePendingMessage(state: ThreadState, clientId: string): ThreadState {
  return { messages: state.messages.filter((item) => item.clientId !== clientId) };
}

export function markMessagesRead(
  state: ThreadState,
  senderId: string,
  readAt: string,
): ThreadState {
  return {
    messages: state.messages.map((item) =>
      item.senderId === senderId && item.delivery === "sent"
        ? { ...item, readAt: item.readAt ?? readAt }
        : item,
    ),
  };
}

function asSent(message: Message): ThreadMessage {
  return { ...message, delivery: "sent", clientId: null };
}

function chronological(messages: ThreadMessage[]) {
  return messages.sort((left, right) => Date.parse(left.sentAt) - Date.parse(right.sentAt));
}
