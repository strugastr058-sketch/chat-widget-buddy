/** Library version — keep in sync with package.json and the git tag (vX.Y.Z). */
export const VERSION = "1.1.0";
export { AIChatWidget } from "./AIChatWidget";
export { streamChat, type StreamRequest } from "./stream";
export type { AIChatWidgetProps, ChatMessage, ChatFeatures, ChatSource } from "./types";
