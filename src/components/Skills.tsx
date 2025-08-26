import { motion } from 'framer-motion';
import { portfolio } from '../data/portfolio';
import { Pill } from './Pill';

export function Skills() {
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
          Here are the technologies and tools I work with to bring ideas to life.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        viewport={{ once: true }}
        className="flex flex-wrap gap-3 justify-center"
      >
        {portfolio.skills.map((skill, index) => (
          <motion.div
            key={skill}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            viewport={{ once: true }}
          >
            <Pill variant="default" size="md">
              {skill}
            </Pill>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
