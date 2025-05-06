import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface RetroButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  isActive?: boolean;
  animateWidth?: boolean;
  initialWidth?: number;
  expandedWidth?: number;
}

const buttonStyles = {
  base: 'relative px-4 py-2 font-steps-mono text-sm border-2 border-black',
  active: 'bg-[#ff4444]',
  inactive: 'bg-[#f5e6d3]',
  disabled: 'cursor-not-allowed',
  enabled: 'cursor-pointer',
} as const;

const buttonShadow = {
  boxShadow: `
    4px 4px 0px #000,
    inset 2px 2px 0px rgba(255, 255, 255, 0.3)
  `
} as const;

export default function RetroButton({ 
  children, 
  onClick, 
  className = '', 
  disabled = false,
  type = 'button',
  isActive = false,
  animateWidth = false,
  initialWidth = 45,
  expandedWidth = 100
}: RetroButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        ${buttonStyles.base}
        ${isActive ? buttonStyles.active : buttonStyles.inactive}
        ${disabled ? buttonStyles.disabled : buttonStyles.enabled}
        ${className}
      `}
      whileHover={!disabled ? { y: -2 } : {}}
      whileTap={!disabled ? { y: 2 } : {}}
      style={buttonShadow}
      animate={animateWidth ? { width: isActive ? expandedWidth : initialWidth } : {}}
      initial={false}
    >
      <div className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </div>
    </motion.button>
  );
} 