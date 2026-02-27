import { Link } from "react-router";
import { Home, ArrowLeft } from "lucide-react";

export function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-8xl font-bold text-white/10 mb-4">404</div>
        <h1 className="text-2xl font-bold text-white mb-2">Trang không tồn tại</h1>
        <p className="text-white/50 mb-8 text-sm">
          Trang bạn tìm kiếm không tồn tại hoặc đã bị xóa.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors text-sm min-h-[44px]"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </button>
          <Link to="/">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl transition-colors text-sm min-h-[44px]">
              <Home className="w-4 h-4" />
              Trang chủ
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
