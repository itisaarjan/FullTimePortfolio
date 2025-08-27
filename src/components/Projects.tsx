import { motion, AnimatePresence } from 'framer-motion';
import { portfolio } from '../data/portfolio';
import { Card } from './Card';
import { Pill } from './Pill';
import { useState } from 'react';
import { X, ExternalLink, Code, Copy, CheckCircle } from 'lucide-react';

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
  const [selectedProject, setSelectedProject] = useState<typeof portfolio.projects[0] | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const handleProjectClick = (project: typeof portfolio.projects[0]) => {
    console.log('Project clicked:', project.name);
    setSelectedProject(project);
    // Fetch real code snippets from GitHub
    fetchProjectSnippets(project.slug);
  };

  const handleCloseModal = () => {
    setSelectedProject(null);
  };

  const handleCopyCode = async (code: string, language: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopySuccess(`${language} copied!`);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Dynamic GitHub repository configurations with file patterns
  const getProjectConfig = (projectSlug: string) => {
    const configs: Record<string, { repo: string; filePatterns: { label: string; pattern: string; language: string }[] }> = {
      'cloudshop': {
        repo: 'itisaarjan/cloudshop',
        filePatterns: [
          { label: 'CI/CD Pipeline', pattern: '.github/workflows/', language: 'yaml' },
          { label: 'CDK Stack', pattern: 'code/cdk/lib/', language: 'typescript' },
          { label: 'README', pattern: 'README.md', language: 'markdown' }
        ]
      },
      'personal-finance-tracker': {
        repo: 'itisaarjan/PersonalFinanceTracker',
        filePatterns: [
          { label: 'API Routes', pattern: 'server/routes/', language: 'javascript' },
          { label: 'Server Setup', pattern: 'server/server.js', language: 'javascript' },
          { label: 'README', pattern: 'README.md', language: 'markdown' }
        ]
      },
      'simrikmed': {
        repo: 'itisaarjan/simrikmed',
        filePatterns: [
          { label: 'Main App', pattern: 'src/App.jsx', language: 'jsx' },
          { label: 'Service Component', pattern: 'src/Components/', language: 'jsx' },
          { label: 'README', pattern: 'README.md', language: 'markdown' }
        ]
      },
      'wanderlust': {
        repo: 'itisaarjan/wanderlust',
        filePatterns: [
          { label: 'Map Component', pattern: 'public/js/map.js', language: 'javascript' },
          { label: 'Listing Routes', pattern: 'routes/listing.js', language: 'javascript' },
          { label: 'README', pattern: 'README.md', language: 'markdown' }
        ]
      },
      'stock-wave-analyzer': {
        repo: 'itisaarjan/Stock-Wave-Analyzer',
        filePatterns: [
          { label: 'Main Application', pattern: 'Proj 2/Program.cs', language: 'csharp' },
          { label: 'Chart Display', pattern: 'Proj 2/ChartDisplayForm.cs', language: 'csharp' },
          { label: 'CandleStick Model', pattern: 'Proj 2/CandleStick.cs', language: 'csharp' }
        ]
      }
    };
    return configs[projectSlug];
  };

  // Fetch real code from GitHub using dynamic discovery
  const [snippets, setSnippets] = useState<Record<string, { label: string; code: string; language: string; error?: string }[]>>({});
  const [loading, setLoading] = useState(false);

  const fetchProjectSnippets = async (projectSlug: string) => {
    const config = getProjectConfig(projectSlug);
    if (!config) return;

    setLoading(true);
    const projectSnippets: { label: string; code: string; language: string; error?: string }[] = [];

    try {
      // Step 1: Get the latest commit SHA
      const commitsResponse = await fetch(`https://api.github.com/repos/${config.repo}/commits/main`);
      if (!commitsResponse.ok) {
        throw new Error(`Failed to get latest commit: ${commitsResponse.status}`);
      }
      const commitData = await commitsResponse.json();
      const latestSha = commitData.sha;

      // Step 2: Get the repository tree recursively
      const treeResponse = await fetch(`https://api.github.com/repos/${config.repo}/git/trees/${latestSha}?recursive=1`);
      if (!treeResponse.ok) {
        throw new Error(`Failed to get repository tree: ${treeResponse.status}`);
      }
      const treeData = await treeResponse.json();
      const allFiles = treeData.tree.filter((item: any) => item.type === 'blob').map((item: any) => item.path);

      // Step 3: Find matching files for each pattern
      for (const filePattern of config.filePatterns) {
        try {
          let matchingFiles = allFiles.filter((filePath: string) => {
            if (filePattern.pattern.endsWith('/')) {
              // Directory pattern - find files in that directory
              return filePath.startsWith(filePattern.pattern) && 
                     !filePath.includes('/node_modules/') && 
                     !filePath.includes('/.git/');
            } else {
              // Exact file pattern
              return filePath === filePattern.pattern;
            }
          });

          // For directory patterns, pick the most relevant file
          if (filePattern.pattern.endsWith('/') && matchingFiles.length > 0) {
            // Prioritize files that look like main components/configs
            const priorityFiles = matchingFiles.filter((f: string) => 
              f.includes('index') || f.includes('main') || f.includes('app') || 
              f.includes('config') || f.includes('setup') || f.includes('deploy')
            );
            matchingFiles = priorityFiles.length > 0 ? [priorityFiles[0]] : [matchingFiles[0]];
          }

          if (matchingFiles.length > 0) {
            const selectedFile = matchingFiles[0];
            const fileResponse = await fetch(`https://api.github.com/repos/${config.repo}/contents/${selectedFile}?ref=main`);
            
            if (fileResponse.ok) {
              const fileData = await fileResponse.json();
              const contentResponse = await fetch(fileData.download_url);
              if (contentResponse.ok) {
                const code = await contentResponse.text();
                // Limit content to first 100 lines
                const lines = code.split('\n').slice(0, 100);
                const truncatedContent = lines.join('\n');
                
                projectSnippets.push({
                  label: `${filePattern.label} (${selectedFile.split('/').pop()})`,
                  code: truncatedContent,
                  language: filePattern.language
                });
              } else {
                projectSnippets.push({
                  label: filePattern.label,
                  code: `// Could not load content from ${selectedFile}`,
                  language: filePattern.language
                });
              }
            } else {
              projectSnippets.push({
                label: filePattern.label,
                code: `// Could not load ${selectedFile} from GitHub`,
                language: filePattern.language
              });
            }
          } else {
            projectSnippets.push({
              label: filePattern.label,
              code: `// No files found matching pattern: ${filePattern.pattern}`,
              language: filePattern.language
            });
          }
        } catch (error) {
          projectSnippets.push({
            label: filePattern.label,
            code: `// Error processing pattern ${filePattern.pattern}: ${error}`,
            language: filePattern.language
          });
        }
      }
    } catch (error) {
      console.error('Error fetching project snippets:', error);
      projectSnippets.push({
        label: 'Error',
        code: `// Failed to fetch repository data: ${error}`,
        language: 'text'
      });
    } finally {
      setLoading(false);
    }

    setSnippets(prev => ({ ...prev, [projectSlug]: projectSnippets }));
  };

  const getProjectSnippets = (projectSlug: string) => {
    return snippets[projectSlug] || [];
  };

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
            <Card as="article" className="flex flex-col h-full w-full group cursor-pointer" onClick={() => handleProjectClick(project)}>
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

                  {/* Project Actions */}
                  <div className="flex items-center justify-between mt-auto">
                    {/* Deep Dive Button */}
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProjectClick(project);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 dark:from-gray-600 dark:to-gray-700 hover:from-gray-600 hover:to-gray-700 dark:hover:from-gray-500 dark:hover:to-gray-600 text-white font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 border border-gray-600 dark:border-gray-500"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Code size={16} />
                      Deep Dive
                    </motion.button>

                    {/* View Project Link */}
                    {project.link && (
                      <motion.a
                        href={project.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        whileHover={{ x: 4 }}
                        onClick={(e) => e.stopPropagation()}
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
              </div>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Deep Dive Modal */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedProject.name}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Deep Dive - Code & Architecture
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {/* Project Overview */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Project Overview
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {selectedProject.desc}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedProject.tech.map((tech) => (
                      <Pill key={tech} variant="default" size="sm">
                        {tech}
                      </Pill>
                    ))}
                  </div>
                  {selectedProject.link && (
                    <a
                      href={selectedProject.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      <ExternalLink size={16} />
                      View Live Project
                    </a>
                  )}
                </div>

                {/* Code Snippets */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Code size={20} />
                    Code Snippets
                  </h3>
                  <div className="space-y-4">
                    {loading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600 dark:text-gray-400">Loading code from GitHub...</p>
                      </div>
                    ) : (
                      getProjectSnippets(selectedProject.slug).map((snippet, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {snippet.label}
                          </h4>
                          <button
                            onClick={() => handleCopyCode(snippet.code, snippet.language)}
                            className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                          >
                            {copySuccess === `${snippet.language} copied!` ? (
                              <CheckCircle size={14} />
                            ) : (
                              <Copy size={14} />
                            )}
                            {copySuccess === `${snippet.language} copied!` ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <div className="p-4">
                          <pre className="text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
                            <code>{snippet.code}</code>
                          </pre>
                        </div>
                      </div>
                    ))
                  )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
