import type { Contact } from "./types";

export function contactName(contact: Contact) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ");
}
