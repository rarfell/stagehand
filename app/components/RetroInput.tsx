import { forwardRef } from 'react';

interface RetroInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const inputStyles = {
  base: `
    w-full px-4 py-3 font-steps-mono text-sm
    bg-[#222222] text-white placeholder-gray-400
    border-2 border-black
    outline-none focus:outline-none focus:ring-0 focus:border-black
  `,
  shadow: `
    4px 4px 0px #000,
    inset 2px 2px 0px rgba(255, 255, 255, 0.1)
  `,
  gradient: `
    linear-gradient(
      45deg,
      transparent 0%,
      rgba(255, 255, 255, 0.05) 50%,
      transparent 100%
    )
  `,
} as const;

const RetroInput = forwardRef<HTMLInputElement, RetroInputProps>(({ 
  className = '', 
  ...props 
}, ref) => {
  return (
    <div className="relative flex-1">
      <input
        ref={ref}
        {...props}
        className={`${inputStyles.base} ${className}`}
        style={{ boxShadow: inputStyles.shadow }}
      />
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ background: inputStyles.gradient }}
      />
    </div>
  );
});

RetroInput.displayName = 'RetroInput';

export default RetroInput; 