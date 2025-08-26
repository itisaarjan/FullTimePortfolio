import { motion } from 'framer-motion';
import { portfolio } from '../data/portfolio';
import { Card } from './Card';

export function Honors() {
  if (!portfolio.honors || portfolio.honors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
        className="text-center"
      >
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Recognition for academic excellence and outstanding achievements throughout my educational journey.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        viewport={{ once: true }}
        className="grid gap-6 md:grid-cols-2"
      >
        {portfolio.honors.map((honor, index) => (
          <motion.div
            key={honor.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            viewport={{ once: true }}
          >
            <Card as="article" className="h-full">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {honor.title}
                  </h3>
                  <p className="text-blue-600 dark:text-blue-400 font-medium">
                    {honor.issuer}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {honor.date}
                  </p>
                </div>
                
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {honor.description}
                </p>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
