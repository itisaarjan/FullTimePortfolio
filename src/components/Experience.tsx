import { motion } from 'framer-motion';
import { portfolio } from '../data/portfolio';
import { Card } from './Card';
import { Pill } from './Pill';

export function Experience() {
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
          My professional journey and the impact I've made along the way.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        viewport={{ once: true }}
        className="grid gap-6 md:grid-cols-2 auto-rows-fr"
      >
        {portfolio.experience.map((job, index) => (
          <motion.div
            key={`${job.company}-${job.title}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            viewport={{ once: true }}
            className="flex"
          >
            {job.company.includes('AWS') || job.company.includes('Amazon') ? (
              <Card as="article" className="h-full">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* AWS logo avatar */}
                      <div className="h-10 w-10 grid place-items-center shrink-0">
                        <img
                          src="/logos/aws-svgrepo-com (1).svg"
                          alt="Amazon Web Services logo"
                          className="h-8 w-8"
                        />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {job.title}
                        </h3>
                        <a
                          href="https://aws.amazon.com/"
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[#FF9900] hover:underline font-medium"
                        >
                          {job.company}
                        </a>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[#FF9900]/15 text-[#FF9900] ring-1 ring-[#FF9900]/30 px-3 py-1 text-xs font-medium">
                      {job.period}
                    </span>
                  </div>
                  
                  <ul className="space-y-2">
                    {job.bullets.map((bullet, bulletIndex) => (
                      <li
                        key={bulletIndex}
                        className="text-gray-600 dark:text-gray-400 leading-relaxed list-disc list-inside"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ) : job.company.includes('University of South Florida') || job.company.includes('USF') ? (
              <Card as="article" className="h-full">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* USF logo avatar */}
                      <div className="h-10 w-10 grid place-items-center shrink-0">
                        <img
                          src="/src/images/usflogo.png"
                          alt="University of South Florida logo"
                          className="h-8 w-8"
                        />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {job.title}
                        </h3>
                        <p className="text-[#00A651] hover:underline font-medium">
                          {job.company}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[#00A651]/15 text-[#00A651] ring-1 ring-[#00A651]/30 px-3 py-1 text-xs font-medium">
                      {job.period}
                    </span>
                  </div>
                  
                  <ul className="space-y-2">
                    {job.bullets.map((bullet, bulletIndex) => (
                      <li
                        key={bulletIndex}
                        className="text-gray-600 dark:text-gray-400 leading-relaxed list-disc list-inside"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ) : job.company.includes('Simrik Med') || job.company.includes('SimrikMed') ? (
              <Card as="article" className="h-full">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Simrik Med logo avatar */}
                      <div className="h-12 w-12 grid place-items-center shrink-0">
                        <img
                          src="/src/images/simrikmedlogo.png"
                          alt="Simrik Med LLC logo"
                          className="h-10 w-10"
                        />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {job.title}
                        </h3>
                        <p className="text-[#DC143C] hover:underline font-medium">
                          {job.company}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-[#DC143C]/15 text-[#DC143C] ring-1 ring-[#DC143C]/30 px-3 py-1 text-xs font-medium">
                      {job.period}
                    </span>
                  </div>
                  
                  <ul className="space-y-2">
                    {job.bullets.map((bullet, bulletIndex) => (
                      <li
                        key={bulletIndex}
                        className="text-gray-600 dark:text-gray-400 leading-relaxed list-disc list-inside"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            ) : (
              <Card as="article" className="h-full">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {job.title}
                      </h3>
                      <p className="text-lg text-blue-600 dark:text-blue-400 font-medium">
                        {job.company}
                      </p>
                    </div>
                    <Pill variant="secondary" size="sm">
                      {job.period}
                    </Pill>
                  </div>
                  
                  <ul className="space-y-2">
                    {job.bullets.map((bullet, bulletIndex) => (
                      <li
                        key={bulletIndex}
                        className="text-gray-600 dark:text-gray-400 leading-relaxed list-disc list-inside"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
