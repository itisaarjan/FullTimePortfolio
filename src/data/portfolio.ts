export interface Portfolio {
  name: string;
  role: string;
  location: string;
  blurb: string;
  links: {
    email: string;
    github: string;
    linkedin: string;
    resume?: string;
  };
  skills: string[];
  experience: {
    company: string;
    title: string;
    period: string;
    bullets: string[];
  }[];
  projects: {
    name: string;
    slug: string;
    tag: string;
    link?: string;
    desc: string;
    tech: string[];
  }[];
  education: {
    school: string;
    degree: string;
    period: string;
    highlights?: string[];
  }[];
  honors?: {
    title: string;
    issuer: string;
    date: string;
    description: string;
  }[];
}

export const portfolio: Portfolio = {
  name: "Arjan Subedi",
  role: "Software Development Engineer",
  location: "Tampa, FL",
  blurb: "Computer Science student at University of South Florida with a passion for building scalable software solutions. Recently completed an internship at AWS Lambda and working on cloud-native applications. I love creating impactful projects that solve real-world problems.",
  links: {
    email: "arjansubedi@usf.edu",
    github: "https://github.com/itisaarjan",
    linkedin: "https://linkedin.com/in/arjansubedi",
    resume: "http://arjansubedi.me/Portfolio/"
  },
  skills: [
    "Python", "C/C++", "Java", "TypeScript", "SQL", "HTML/CSS",
    "React", "Node.js", "Express.js", "Tailwind CSS", "JWT",
    "AWS", "DynamoDB", "Docker", "Git",
    "PostgreSQL", "MongoDB", "REST APIs", "Microservices", "GitHub Actions",
    "JUnit", "Mockito", "Guice"
  ],
  experience: [
    {
      company: "University of South Florida",
      title: "Undergraduate Teaching Assistant",
      period: "Current",
      bullets: [
        "Delivered personalized support to over 70 students across CIS 3213 & COP 2510 courses",
        "Taught Python programming with emphasis on logical problem-solving and modular design",
        "Facilitated lab walkthroughs and guided collaborative peer discussions on cybersecurity concepts",
        "Improved average student performance by 12% through targeted support and guidance"
      ]
    },
    {
      company: "Amazon Web Services (AWS)",
      title: "SDE Intern – AWS Lambda",
      period: "Summer 2025",
      bullets: [
        "Engineered an internal monitoring service to automate detection and isolation of gray hosts, enabling resilient Availability Zone (AZ) failover",
        "Implemented dual traffic shift mechanisms driven by host-level health metrics using ArcZonalShift and S3-based signaling",
        "Developed a lightweight, single-threaded backend service in Java using Guice for dependency injection",
        "Utilized DynamoDB and CloudFormation for scalable, fault-tolerant deployments with comprehensive testing"
      ]
    },
    {
      company: "Simrik Med LLC",
      title: "Software Developer",
      period: "Summer 2024",
      bullets: [
        "Spearheaded development of SimrikMed.com, a HIPAA-compliant virtual healthcare platform",
        "Architected and built the front-end using React.js and Tailwind CSS, ensuring responsive and user-friendly interface",
        "Designed and implemented backend microservices and RESTful APIs using Node.js and Express.js, resulting in 30% improvement in system efficiency",
        "Managed deployment on Render, maintaining 99.9% uptime and optimal performance for healthcare platform",
        "Developed scalable database management system using MongoDB, reducing data retrieval time by 40%"
      ]
    }
  ],
  projects: [
    {
      name: "CloudShop",
      slug: "cloudshop",
      tag: "E-commerce",
      link: "https://github.com/itisaarjan/cloudshop",
      desc: "A scalable e-commerce platform with microservices architecture, enabling seamless product browsing, purchasing, and payments.",
      tech: ["TypeScript", "React", "Node.js", "AWS", "DynamoDB", "Stripe"]
    },
    {
      name: "Personal Finance Tracker",
      slug: "personal-finance-tracker",
      tag: "Finance",
      link: "https://github.com/itisaarjan/PersonalFinanceTracker",
      desc: "A comprehensive personal finance management application for tracking expenses, income, and financial goals with detailed analytics.",
      tech: ["React", "Node.js", "Express", "MongoDB", "Chart.js", "JWT"]
    },
    {
      name: "SimrikMed",
      slug: "simrikmed",
      tag: "Healthcare",
      link: "https://simrikmed.com",
      desc: "A HIPAA-compliant virtual healthcare platform providing telemedicine services with secure patient-doctor communication.",
      tech: ["React", "Node.js", "Express", "MongoDB", "Tailwind CSS", "Render"]
    },
    {
      name: "Stock Wave Analyzer",
      slug: "stock-wave-analyzer",
      tag: "Data Analysis",
      link: "https://github.com/itisaarjan/Stock-Wave-Analyzer",
      desc: "A Windows Forms application for visualizing historical candlestick data with technical analysis tools and Fibonacci retracement.",
      tech: ["C#", "Windows Forms", ".NET", "Data Visualization", "Technical Analysis"]
    },
    {
      name: "WanderLust",
      slug: "wanderlust",
      tag: "Travel Platform",
      link: "https://wanderlust-fwwe.onrender.com/listings",
      desc: "A full-stack travel listing platform inspired by Airbnb, enabling users to list hotels, places, and experiences.",
      tech: ["React", "Node.js", "Express", "MongoDB", "Mapbox", "JWT", "Cloudinary"]
    }
  ],
  education: [
    {
      school: "University of South Florida",
      degree: "Bachelor of Science in Computer Science",
      period: "May 2026",
      highlights: [
        "GPA: 3.97/4.00, Dean's List",
        "Related Coursework: Data Structures & Algorithms, Software System Development, Database Management Systems, Artificial Intelligence, Linear Algebra, Probability and Statistics, Computer Architecture"
      ]
    }
  ],
  honors: [
    {
      title: "USF CAS Dean's List of Scholars",
      issuer: "University of South Florida",
      date: "2022-2025",
      description: "Recognized for unwavering commitment to academics and exceptional performance across five semesters (Fall 2022, Spring 2023, Fall 2023, Spring 2024, Spring 2025)."
    },
    {
      title: "USF Undergraduate Engineer's Scholarship",
      issuer: "University of South Florida",
      date: "Aug 2023",
      description: "Honored to have been awarded undergraduate engineering scholarships for demonstrating excellence across academics, extracurricular involvements, and a range of achievements."
    },
    {
      title: "USF Green and Gold Presidential Award",
      issuer: "University of South Florida",
      date: "Aug 2022",
      description: "As a result of outstanding academic results and extracurriculars, received the presidential scholarship, the biggest scholarship an international student can get at USF."
    },
    {
      title: "Duke of Edinburgh International Award",
      issuer: "Duke of Edinburgh's International Award Foundation",
      date: "Aug 2017",
      description: "Proud recipient of the esteemed Duke of Edinburgh International Bronze Award, recognized by the Duke of Edinburgh's International Award Foundation."
    }
  ]
};
