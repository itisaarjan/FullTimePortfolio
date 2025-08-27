import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'article';
  onClick?: () => void;
}

export function Card({ children, className = '', as: Component = 'div', onClick }: CardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Component
        className={clsx(
          'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200 p-6',
          'focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2',
          className
        )}
        onClick={onClick}
      >
        {children}
      </Component>
    </motion.div>
  );
}
