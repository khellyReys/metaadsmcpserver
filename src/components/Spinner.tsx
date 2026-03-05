import React from 'react';
import { Loader } from 'lucide-react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type SpinnerVariant = 'default' | 'white' | 'loader';

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'w-4 h-4',
  sm: 'w-5 h-5',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-32 h-32',
  '2xl': 'w-20 h-20',
};

const variantClasses: Record<Exclude<SpinnerVariant, 'loader'>, string> = {
  default: 'border-blue-600 dark:border-blue-400',
  white: 'border-white',
};

// Half-arc: only bottom border visible (semicircle)
const borderWidthClasses: Record<SpinnerSize, string> = {
  xs: 'border-b-2',
  sm: 'border-b-2',
  md: 'border-b-2',
  lg: 'border-b-4',
  xl: 'border-b-4',
  '2xl': 'border-b-4',
};

interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
}

/**
 * Single source of truth for loading spinners across the app.
 * Use size for context: xs/sm in buttons, md/lg in content, xl for full-page.
 * Use variant="white" on dark/colored buttons.
 * Use variant="loader" for the Lucide Loader icon (e.g. server step).
 */
const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'default',
  className = '',
}) => {
  if (variant === 'loader') {
    return (
      <Loader
        role="status"
        aria-label="Loading"
        className={`animate-spin ${sizeClasses[size]} ${className}`.trim()}
      />
    );
  }

  return (
    <div
      role="status"
      aria-label="Loading"
      className={`rounded-full animate-spin ${sizeClasses[size]} ${borderWidthClasses[size]} ${variantClasses[variant]} ${className}`.trim()}
    />
  );
};

export default Spinner;
