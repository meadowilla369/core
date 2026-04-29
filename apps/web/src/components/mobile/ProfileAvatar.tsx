import type { ProfileAvatarCustomization } from "@/lib/profile-customization";

interface ProfileAvatarProps {
  avatar?: ProfileAvatarCustomization;
  initials: string;
  className?: string;
  imageClassName?: string;
  textClassName?: string;
}

const ProfileAvatar = ({
  avatar,
  initials,
  className = "h-16 w-16",
  imageClassName = "h-full w-full object-cover",
  textClassName = "text-xl"
}: ProfileAvatarProps) => {
  return (
    <div
      className={`${className} flex shrink-0 items-center justify-center overflow-hidden border border-foreground/20 bg-muted`}
    >
      {avatar?.type === "image" ? (
        <img src={avatar.dataUrl} alt="" className={imageClassName} />
      ) : (
        <span className={`${textClassName} font-medium leading-none`}>
          {avatar?.type === "emoji" ? avatar.value : initials}
        </span>
      )}
    </div>
  );
};

export default ProfileAvatar;
