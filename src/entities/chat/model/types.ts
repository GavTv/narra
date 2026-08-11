export interface ChatCitation {
  id: string;
  label: string;
}

export interface ChatAnswer {
  answer: string;
  citations: ChatCitation[];
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatMessage extends ChatTurn {
  id: string;
  citations?: ChatCitation[];
}
