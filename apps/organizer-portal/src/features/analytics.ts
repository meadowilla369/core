export interface EventSalesSnapshot {
  eventId: string;
  reservations: number;
  soldTickets: number;
  grossRevenue: number;
  checkins: number;
}

export interface OrganizerAnalytics {
  totalEvents: number;
  totalSoldTickets: number;
  totalRevenue: number;
  checkinRate: number;
}

export function summarizeAnalytics(snapshots: EventSalesSnapshot[]): OrganizerAnalytics {
  const totalEvents = snapshots.length;
  const totalSoldTickets = snapshots.reduce((sum, item) => sum + item.soldTickets, 0);
  const totalRevenue = snapshots.reduce((sum, item) => sum + item.grossRevenue, 0);
  const totalCheckins = snapshots.reduce((sum, item) => sum + item.checkins, 0);

  return {
    totalEvents,
    totalSoldTickets,
    totalRevenue,
    checkinRate: totalSoldTickets === 0 ? 0 : totalCheckins / totalSoldTickets
  };
}
