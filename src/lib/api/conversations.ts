import { apiFetch } from "./client";

export type ConversationListItem = {
  contact_id: number;
  email: string;
  last_message_at: string;
  last_snippet: string;
  unread_count?: number;
};

export type ConversationMessage = {
  direction: "inbound" | "outbound";
  subject?: string;
  body: string;
  at: string; // ISO
};

export type ConversationThread = {
  contact_id: number;
  email: string;
  messages: ConversationMessage[];
};

export function listConversations(campaignId: number) {
  return apiFetch<ConversationListItem[]>(`/campaigns/${campaignId}/conversations`);
}

export function getConversationThread(campaignId: number, contactId: number) {
  return apiFetch<ConversationThread>(`/campaigns/${campaignId}/conversations/${contactId}`);
}

export function sendManualReply(campaignId: number, contactId: number, payload: { subject: string; body: string }) {
  return apiFetch(`/campaigns/${campaignId}/conversations/${contactId}/send`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}