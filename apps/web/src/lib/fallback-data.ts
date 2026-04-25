import type {
  EventCardView,
  EventDetailView,
  MarketplaceEventView,
  ProfileSummaryView,
  TicketCardView,
  TicketTierView
} from "@ticket-platform/shared-types";

export const homeFeaturedFallback: EventCardView[] = [
  {
    id: "1",
    name: "Cyber Symphony 2025",
    date: "15 Th3",
    location: "Tokyo",
    category: "Hòa nhạc",
    price: "2.800.000₫"
  },
  {
    id: "2",
    name: "Neon Nights",
    date: "22 Th4",
    location: "Las Vegas",
    category: "Lễ hội",
    price: "2.100.000₫"
  },
  {
    id: "3",
    name: "Digital Horizons",
    date: "10 Th5",
    location: "Berlin",
    category: "Công nghệ",
    price: "1.050.000₫"
  },
  {
    id: "4",
    name: "Echo Chamber",
    date: "08 Th6",
    location: "NYC",
    category: "Hòa nhạc",
    price: "1.750.000₫"
  }
];

export const homeUpcomingFallback: EventCardView[] = [
  {
    id: "5",
    name: "Summer Slam",
    date: "20 Th7",
    location: "Miami",
    category: "Thể thao",
    price: "3.500.000₫"
  },
  {
    id: "6",
    name: "Đêm Hài Kịch",
    date: "05 Th8",
    location: "Chicago",
    category: "Hài kịch",
    price: "820.000₫"
  },
  {
    id: "7",
    name: "Phantom Opera",
    date: "12 Th9",
    location: "London",
    category: "Kịch",
    price: "2.200.000₫"
  }
];

export const discoverFallback: EventCardView[] = [
  ...homeFeaturedFallback,
  ...homeUpcomingFallback,
  {
    id: "8",
    name: "Jazz In The Park",
    date: "01 Th10",
    location: "NYC",
    category: "Hòa nhạc",
    price: "580.000₫"
  },
  {
    id: "9",
    name: "World Cup Final",
    date: "18 Th11",
    location: "Doha",
    category: "Thể thao",
    price: "11.600.000₫"
  }
];

export const marketplaceFallback: MarketplaceEventView[] = [
  {
    id: "m1",
    eventName: "Cyber Symphony 2025",
    dayVolume: "8.400.000₫",
    dayChange: -15.1,
    floorPrice: "1.200.000₫",
    floorChange: -1.6,
    listings: [
      { id: "l1", tier: "Phổ Thông", price: "1.200.000₫" },
      { id: "l2", tier: "VIP", price: "3.500.000₫" }
    ]
  },
  {
    id: "m2",
    eventName: "Neon Nights Festival",
    dayVolume: "4.200.000₫",
    dayChange: 12.3,
    floorPrice: "950.000₫",
    floorChange: 5.2,
    listings: [
      { id: "l5", tier: "Phổ Thông", price: "950.000₫" },
      { id: "l6", tier: "VIP", price: "2.800.000₫" }
    ]
  }
];

export const upcomingTicketsFallback: TicketCardView[] = [
  {
    id: "t1",
    eventName: "Cyber Symphony 2025",
    date: "15 Th3, 2025",
    time: "20:00",
    location: "Tokyo Dome, Nhật Bản",
    ticketType: "VIP"
  },
  {
    id: "t2",
    eventName: "Neon Nights Festival",
    date: "22 Th4, 2025",
    time: "18:00",
    location: "Las Vegas Strip",
    ticketType: "Phổ thông"
  }
];

export const pastTicketsFallback: TicketCardView[] = [
  {
    id: "t3",
    eventName: "Digital Horizons",
    date: "10 Th12, 2024",
    time: "19:30",
    location: "Berlin Arena",
    ticketType: "Tiêu chuẩn"
  }
];

export const eventDetailFallback: EventDetailView = {
  id: "1",
  name: "Cyber Symphony 2025",
  category: "Hòa nhạc",
  date: "15 Th3, 2025",
  time: "20:00 - 23:30",
  location: "Tokyo Dome",
  address: "1-3-61 Koraku, Bunkyo, Tokyo 112-0004",
  price: { min: 2800000, max: 10500000 },
  description:
    "Trải nghiệm tương lai của âm nhạc tại Cyber Symphony 2025. Sự kết hợp đột phá giữa nhạc điện tử, dàn nhạc giao hưởng và các bản nhạc được tạo bởi AI, trình diễn trong không gian hình ảnh tuyệt đẹp.",
  lineup: ["Neural Beats", "Quantum Strings", "AI Orchestra", "Synth Wave"],
  attendees: 12500
};

export const eventTicketTierFallback: TicketTierView[] = [
  { name: "Phổ Thông", price: "2.800.000₫", perks: ["Vào cổng", "Khu vực đứng"] },
  {
    name: "VIP",
    price: "5.800.000₫",
    perks: ["Ưu tiên vào cổng", "Khu vực ngồi", "Đồ uống miễn phí"]
  },
  {
    name: "Platinum",
    price: "10.500.000₫",
    perks: ["Vào hậu trường", "Ghế ngồi cao cấp", "Open bar", "Gặp gỡ nghệ sĩ"]
  }
];

export const profileFallback: ProfileSummaryView = {
  displayName: "Nguyễn Tuấn",
  email: "tuan@email.com",
  avatarInitials: "NT",
  attendedEvents: 12,
  upcomingEvents: 5,
  spendSummary: "19.7tr"
};
