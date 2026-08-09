import {
  TaskState,
  type Message,
  type StreamResponse,
  type Task,
} from "@a2a-js/sdk";

const terminalStates = new Set<TaskState>([
  TaskState.TASK_STATE_COMPLETED,
  TaskState.TASK_STATE_FAILED,
  TaskState.TASK_STATE_CANCELED,
  TaskState.TASK_STATE_REJECTED,
]);

const isGenericTerminalLabel = (
  state: TaskState | undefined,
  text: string,
): boolean =>
  state !== undefined &&
  terminalStates.has(state) &&
  /^(?:done|completed|complete|success)$/i.test(text.trim());

export const textFromMessage = (message: Message | undefined): string =>
  message?.parts
    .flatMap((part) =>
      part.content?.$case === "text" ? [part.content.value] : [],
    )
    .join("") ?? "";

export const textFromTask = (task: Task | undefined): string => {
  const statusText = textFromMessage(task?.status?.message);
  const artifactText =
    task?.artifacts
      .flatMap((artifact) => artifact.parts)
      .flatMap((part) =>
        part.content?.$case === "text" ? [part.content.value] : [],
      )
      .join("") ?? "";
  return isGenericTerminalLabel(task?.status?.state, statusText)
    ? artifactText
    : statusText || artifactText;
};

export const textFromStreamResponse = (response: StreamResponse): string => {
  switch (response.payload?.$case) {
    case "message":
      return textFromMessage(response.payload.value);
    case "task":
      return textFromTask(response.payload.value);
    case "statusUpdate": {
      const status = response.payload.value.status;
      const text = textFromMessage(status?.message);
      return isGenericTerminalLabel(status?.state, text) ? "" : text;
    }
    case "artifactUpdate":
      return (
        response.payload.value.artifact?.parts
          .flatMap((part) =>
            part.content?.$case === "text" ? [part.content.value] : [],
          )
          .join("") ?? ""
      );
    default:
      return "";
  }
};

export const taskFromStreamResponse = (
  response: StreamResponse,
): Task | undefined =>
  response.payload?.$case === "task" ? response.payload.value : undefined;
