import { Link } from "react-router";
import { Ticket, UserCheck, Calendar, Shield } from "lucide-react";

export default function RoleSelector() {
  const roles = [
    {
      title: "Người Mua / Bán",
      titleEn: "Buyer / Seller",
      description: "Khám phá sự kiện, mua vé và bán vé chợ đen",
      icon: Ticket,
      path: "/buyer",
      color: "bg-blue-500",
    },
    {
      title: "Nhân Viên Check-in",
      titleEn: "Staff",
      description: "Quét QR code và xác minh vé tại cổng",
      icon: UserCheck,
      path: "/staff",
      color: "bg-green-500",
    },
    {
      title: "Ban Tổ Chức",
      titleEn: "Organizer",
      description: "Quản lý sự kiện và theo dõi doanh thu",
      icon: Calendar,
      path: "/organizer",
      color: "bg-purple-500",
    },
    {
      title: "Quản Trị Viên",
      titleEn: "Platform Admin",
      description: "Xử lý khiếu nại, duyệt KYC và giám sát nền tảng",
      icon: Shield,
      path: "/admin",
      color: "bg-orange-500",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-5xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Vé Việt - Event Ticketing Platform
          </h1>
          <p className="text-gray-600">
            Chọn vai trò để truy cập hệ thống / Select your role to access the platform
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {roles.map((role) => (
            <Link
              key={role.path}
              to={role.path}
              className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all border border-gray-100 hover:border-gray-200"
            >
              <div className="flex items-start gap-4">
                <div className={`${role.color} rounded-xl p-3 text-white group-hover:scale-110 transition-transform`}>
                  <role.icon className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">
                    {role.title}
                  </h2>
                  <p className="text-sm text-gray-500 mb-2">{role.titleEn}</p>
                  <p className="text-gray-600">{role.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Demo System - All data is mocked for demonstration purposes</p>
          <p className="mt-1">Current Date: Friday, February 27, 2026</p>
        </div>
      </div>
    </div>
  );
}
