import React from 'react';

interface ProfileAvatarProps {
  url?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function ProfileAvatar({ url, name, size = 'md' }: ProfileAvatarProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const sizeClasses = {
    sm: 'w-[36px] h-[36px] text-[13px]',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full border-2 border-ccd-surface flex items-center justify-center overflow-hidden bg-ccd-active text-white font-semibold shadow-[0_0_0_1px_#8B6914] shrink-0`}
    >
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className="font-serif font-bold">{getInitials(name)}</span>
      )}
    </div>
  );
}
