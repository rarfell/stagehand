import { motion } from 'framer-motion';
import { MicIcon, SquareIcon, ArrowRightIcon } from 'raster-react';
import { ReactNode } from 'react';
import { useEffect, useState } from 'react';

interface IconWrapperProps {
  children: ReactNode;
  className?: string;
}

const IconWrapper = ({ children, className = '' }: IconWrapperProps) => (
  <div className={`flex items-center justify-center w-[24px] h-[24px] ${className}`}>
    {children}
  </div>
);

const iconProps = {
  size: 24,
  color: 'currentColor',
  strokeWidth: 0.5,
  radius: 0.5,
} as const;

// 8-bit style microphone icon
export const MicrophoneIcon = () => (
  <IconWrapper>
    <MicIcon {...iconProps} />
  </IconWrapper>
);

// 8-bit style arrow icon
export const ArrowIcon = () => (
  <IconWrapper>
    <ArrowRightIcon {...iconProps} />
  </IconWrapper>
); 