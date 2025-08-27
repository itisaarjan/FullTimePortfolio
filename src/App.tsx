import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { Section } from './components/Section';
import { Skills } from './components/Skills';
import { Experience } from './components/Experience';
import { Projects } from './components/Projects';
import { Education } from './components/Education';
import { Honors } from './components/Honors';
import ContactSection from './components/ContactSection';
import { ScrollToTop } from './components/ScrollToTop';
import { portfolio } from './data/portfolio';

function App() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Skip to content link for accessibility */}
      <a href="#skills" className="skip-link">
        Skip to content
      </a>

      <Nav />
      
      <main>
        <Hero />
        
        <Section id="skills" title="Skills">
          <Skills />
        </Section>

        <Section id="experience" title="Work Experience">
          <Experience />
        </Section>

        <Section id="projects" title="Projects">
          <Projects />
        </Section>

        <Section id="education" title="Education">
          <Education />
        </Section>

        <Section id="honors" title="Honors & Awards">
          <Honors />
        </Section>

        <ContactSection />
      </main>

      <footer className="py-8 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            © {currentYear} {portfolio.name}. Built with React, TypeScript, and Tailwind CSS.
          </p>
        </div>
      </footer>

      <ScrollToTop />
    </div>
  );
}

export default App;
