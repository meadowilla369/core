import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft, Camera, Save, Smile, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import MobileLayout from "@/components/mobile/MobileLayout";
import ProfileAvatar from "@/components/mobile/ProfileAvatar";
import { profileFallback } from "@/lib/fallback-data";
import { getInitials } from "@/lib/format";
import type { ProfileAvatarCustomization } from "@/lib/profile-customization";
import { useProfileCustomization, useProfileSummary } from "@/hooks/use-profile";

const emojiPresets = ["😀", "😎", "🎧", "🎟️", "🎤", "✨", "🔥", "💜", "🪩", "🚀", "⭐", "🏟️"];
const maxAvatarFileSize = 1_500_000;

function readAvatarFile(file: File): Promise<ProfileAvatarCustomization> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Vui lòng chọn file ảnh."));
      return;
    }

    if (file.size > maxAvatarFileSize) {
      reject(new Error("Ảnh đại diện nên nhỏ hơn 1.5MB để lưu trên thiết bị."));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve({ type: "image", dataUrl: reader.result });
      } else {
        reject(new Error("Không đọc được ảnh này."));
      }
    };
    reader.onerror = () => reject(new Error("Không đọc được ảnh này."));
    reader.readAsDataURL(file);
  });
}

const ProfileEditPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data } = useProfileSummary();
  const profile = data ?? profileFallback;
  const { customization, setCustomization } = useProfileCustomization();
  const initialDisplayName = customization.displayName ?? profile.displayName;
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatar, setAvatar] = useState<ProfileAvatarCustomization | undefined>(
    customization.avatar
  );
  const [mode, setMode] = useState<"image" | "emoji">(avatar?.type ?? "emoji");
  const [emojiValue, setEmojiValue] = useState(avatar?.type === "emoji" ? avatar.value : "");
  const [error, setError] = useState<string | null>(null);

  const initials = useMemo(
    () => getInitials(displayName.trim() || profile.email || profile.displayName),
    [displayName, profile.displayName, profile.email]
  );

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setError(null);
      const nextAvatar = await readAvatarFile(file);
      setAvatar(nextAvatar);
      setMode("image");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không đọc được ảnh này.");
    } finally {
      event.target.value = "";
    }
  };

  const handleEmojiChange = (value: string) => {
    const nextValue = value.trim().slice(0, 16);
    setEmojiValue(nextValue);
    setMode("emoji");
    setAvatar(nextValue ? { type: "emoji", value: nextValue } : undefined);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = displayName.trim();
    if (!nextName) {
      setError("Tên hiển thị không được để trống.");
      return;
    }

    setCustomization({
      displayName: nextName,
      avatar
    });
    navigate("/profile");
  };

  return (
    <MobileLayout>
      <header className="sticky safe-area-sticky-top z-40 border-b border-foreground/10 bg-background/95 backdrop-blur-sm">
        <div className="flex min-h-[64px] items-center gap-3 p-4">
          <Link
            to="/profile"
            className="flex h-11 w-11 items-center justify-center border border-foreground/20 transition-colors hover:bg-foreground/10"
            aria-label="Quay lại hồ sơ"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Sửa Hồ Sơ</h1>
            <p className="font-mono text-[10px] uppercase tracking-wider text-foreground/40">
              Lưu trên thiết bị này
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6 p-4">
        <section className="border border-foreground/10 bg-card">
          <div className="flex items-center gap-4 border-b border-foreground/10 p-4">
            <ProfileAvatar
              avatar={avatar}
              initials={initials}
              className="h-24 w-24"
              textClassName="text-4xl"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-medium">{displayName || profile.displayName}</p>
              <p className="mt-1 font-mono text-xs text-foreground/45">{profile.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 border-b border-foreground/10">
            <button
              type="button"
              onClick={() => setMode("image")}
              className={`flex min-h-[48px] items-center justify-center gap-2 border-r border-foreground/10 font-mono text-xs uppercase tracking-wider transition-colors ${
                mode === "image" ? "bg-foreground text-background" : "text-foreground/55"
              }`}
            >
              <Camera className="h-4 w-4" />
              Ảnh
            </button>
            <button
              type="button"
              onClick={() => setMode("emoji")}
              className={`flex min-h-[48px] items-center justify-center gap-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                mode === "emoji" ? "bg-foreground text-background" : "text-foreground/55"
              }`}
            >
              <Smile className="h-4 w-4" />
              Emoji
            </button>
          </div>

          <div className="p-4">
            {mode === "image" ? (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 border border-foreground/20 font-mono text-xs uppercase tracking-wider transition-colors hover:bg-foreground/10"
                >
                  <Camera className="h-4 w-4" />
                  Chọn ảnh từ máy
                </button>
                <p className="font-mono text-[10px] leading-relaxed text-foreground/40">
                  Ảnh được lưu local trên trình duyệt, chưa đồng bộ sang thiết bị khác.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block space-y-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-foreground/45">
                    Gõ hoặc dán emoji từ bàn phím
                  </span>
                  <input
                    value={emojiValue}
                    onChange={(event) => handleEmojiChange(event.target.value)}
                    placeholder="🎧"
                    className="h-12 w-full border border-foreground/20 bg-background px-3 text-2xl outline-none transition-colors placeholder:text-foreground/25 focus:border-foreground/50"
                  />
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {emojiPresets.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleEmojiChange(emoji)}
                      className="flex aspect-square items-center justify-center border border-foreground/15 text-2xl transition-colors hover:bg-foreground/10"
                      aria-label={`Chọn emoji ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-2">
          <label
            htmlFor="profile-display-name"
            className="font-mono text-[10px] uppercase tracking-wider text-foreground/45"
          >
            Tên người dùng
          </label>
          <input
            id="profile-display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="h-12 w-full border border-foreground/20 bg-background px-3 text-base outline-none transition-colors placeholder:text-foreground/25 focus:border-foreground/50"
            placeholder="Tên hiển thị"
          />
        </section>

        {error && (
          <div className="border border-destructive/40 bg-destructive/10 px-3 py-2">
            <p className="font-mono text-[10px] leading-relaxed text-destructive">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <button
            type="submit"
            className="flex min-h-[52px] items-center justify-center gap-2 bg-foreground px-4 font-mono text-xs uppercase tracking-wider text-background transition-opacity hover:opacity-90"
          >
            <Save className="h-4 w-4" />
            Lưu thay đổi
          </button>
          <button
            type="button"
            onClick={() => {
              setAvatar(undefined);
              setEmojiValue("");
            }}
            className="flex h-[52px] w-[52px] items-center justify-center border border-foreground/20 transition-colors hover:bg-foreground/10"
            aria-label="Xóa avatar tùy chỉnh"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </form>
    </MobileLayout>
  );
};

export default ProfileEditPage;
