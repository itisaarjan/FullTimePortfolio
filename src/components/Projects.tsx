import { motion } from 'framer-motion';
import { portfolio } from '../data/portfolio';
import { Card } from './Card';
import { Pill } from './Pill';

// Import project images
import stockWaveAnalyzerImg from '../images/StockWaveAnalyzer.png';
import wanderLustImg from '../images/WanderLust.png';
import financeTrackerImg from '../images/FinanceTracker.png';
import simrikMedImg from '../images/SimrikMed.png';

function getInitials(slug: string): string {
  return slug
    .split('-')
    .map(word => word[0])
    .join('')
    .toUpperCase();
}

// Map project slugs to their images
const projectImages: Record<string, string> = {
  'stock-wave-analyzer': stockWaveAnalyzerImg,
  'wanderlust': wanderLustImg,
  'personal-finance-tracker': financeTrackerImg,
  'simrikmed': simrikMedImg,
};

export function Projects() {
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
          A collection of projects that showcase my skills and passion for building meaningful applications.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        viewport={{ once: true }}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {portfolio.projects.map((project, index) => (
          <motion.div
            key={project.slug}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            viewport={{ once: true }}
            className="flex"
          >
            <Card as="article" className="flex flex-col h-full w-full group">
              <div className="flex flex-col h-full space-y-4">
                {/* Project Image */}
                <div className="relative aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex-shrink-0">
                  {projectImages[project.slug] ? (
                    <img
                      src={projectImages[project.slug]}
                      alt={`${project.name} screenshot`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {getInitials(project.slug)}
                      </span>
                    </div>
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>

                {/* Project Info */}
                <div className="flex flex-col flex-grow space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                      {project.name}
                    </h3>
                    <Pill variant="primary" size="sm">
                      {project.tag}
                    </Pill>
                  </div>
                  
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed flex-grow">
                    {project.desc}
                  </p>

                  {/* Tech Stack */}
                  <div className="flex flex-wrap gap-2">
                    {project.tech.map((tech) => (
                      <Pill key={tech} variant="default" size="sm">
                        {tech}
                      </Pill>
                    ))}
                  </div>

                  {/* Project Link */}
                  {project.link && (
                    <motion.a
                      href={project.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 mt-auto"
                      whileHover={{ x: 4 }}
                    >
                      View Project
                      <svg
                        className="w-4 h-4 ml-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </motion.a>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
