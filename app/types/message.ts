export interface Message {
  text: string;
  role: "user" | "agent";
  reasoning?: string;
  tool?: "GOTO" | "ACT" | "EXTRACT" | "OBSERVE" | "WAIT" | "NAVBACK" | "COMPLETE";
  instruction?: string;
  stepNumber?: number;
  conversationId?: string;
  observation?: string;
  extraction?: string;
} 