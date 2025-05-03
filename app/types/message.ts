export interface Message {
  text: string;
  role: "user" | "agent";
  reasoning?: string;
  tool?: "GOTO" | "ACT" | "EXTRACT" | "OBSERVE" | "CLOSE" | "WAIT" | "NAVBACK";
  instruction?: string;
  stepNumber?: number;
} 