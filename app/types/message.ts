export interface Message {
  text: string;
  role: "user" | "agent";
  reasoning?: string;
  tool?: "GOTO" | "ACT" | "EXTRACT" | "OBSERVE" | "CLOSE" | "WAIT" | "NAVBACK" | "SUMMARIZE";
  instruction?: string;
  stepNumber?: number;
} 