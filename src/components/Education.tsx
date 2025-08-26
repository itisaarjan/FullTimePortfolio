import { motion } from 'framer-motion';
import { portfolio } from '../data/portfolio';
import { Card } from './Card';
import { Pill } from './Pill';

export function Education() {
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
          My educational background and continuous learning journey.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        viewport={{ once: true }}
        className="grid gap-6 md:grid-cols-2"
      >
        {portfolio.education.map((edu, index) => (
          <motion.div
            key={`${edu.school}-${edu.degree}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            viewport={{ once: true }}
          >
            <Card as="article" className="h-full">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {edu.school}
                    </h3>
                    <p className="text-lg text-blue-600 dark:text-blue-400 font-medium">
                      {edu.degree}
                    </p>
                  </div>
                  <Pill variant="secondary" size="sm">
                    {edu.period}
                  </Pill>
                </div>
                
                {edu.highlights && (
                  <ul className="space-y-2">
                    {edu.highlights.map((highlight, highlightIndex) => (
                      <li
                        key={highlightIndex}
                        className="text-gray-600 dark:text-gray-400 leading-relaxed list-disc list-inside"
                      >
                        {highlight}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
