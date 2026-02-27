import { Link } from "react-router";
import { Calendar, MapPin, Ticket } from "lucide-react";
import { Card } from "./ui/card";
import { Event } from "../lib/types";
import { formatCurrency, formatShortDate } from "../lib/utils";

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const lowestPrice = Math.min(...event.tickets.map((t) => t.price));
  const availableTickets = event.tickets.reduce((sum, t) => sum + t.available, 0);

  return (
    <Link to={`/event/${event.id}`}>
      <Card className="gap-0 overflow-hidden cursor-pointer hover:shadow-xl transition-all hover:-translate-y-1">
        <div className="aspect-video overflow-hidden bg-gray-200">
          <img
            src={event.imageUrl}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="p-4">
          <div className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded mb-2">
            {event.category}
          </div>
          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
            {event.title}
          </h3>
          <div className="space-y-1.5 text-sm text-gray-600 mb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>{formatShortDate(event.date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="line-clamp-1">{event.venue}</span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div>
              <div className="text-xs text-gray-500">Từ</div>
              <div className="font-semibold text-gray-900">
                {formatCurrency(lowestPrice)}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Ticket className="w-4 h-4" />
              <span>
                {availableTickets > 0 ? `${availableTickets} vé` : "Hết vé"}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
