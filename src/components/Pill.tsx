import { motion } from 'framer-motion';
import clsx from 'clsx';

interface PillProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary';
  size?: 'sm' | 'md';
  className?: string;
}

export function Pill({ 
  children, 
  variant = 'default', 
  size = 'md',
  className = '' 
}: PillProps) {
  const baseClasses = 'inline-flex items-center rounded-full border font-medium transition-all duration-200';
  
  const variantClasses = {
    default: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700',
    primary: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700',
    secondary: 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm'
  };

  return (
    <motion.span
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={clsx(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </motion.span>
  );
}
