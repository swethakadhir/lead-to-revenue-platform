import type { AppointmentListItem } from "./types";

export function partitionAppointments(appointments: AppointmentListItem[], now = new Date()) {
  const timestamp = now.getTime();
  const isUpcoming = (item: AppointmentListItem) =>
    ["scheduled", "confirmed"].includes(item.status) && new Date(item.starts_at).getTime() >= timestamp;
  return {
    upcoming: appointments.filter(isUpcoming),
    past: appointments.filter((item) => !isUpcoming(item)).reverse(),
  };
}
