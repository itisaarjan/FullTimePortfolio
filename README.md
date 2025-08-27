# Arjan Subedi - Portfolio

A modern, responsive portfolio website built with React, TypeScript, and Tailwind CSS. Features smooth animations, dark mode support, and a clean, professional design.

## 🚀 Features

- **Responsive Design**: Works perfectly on all devices (320px → 1440+)
- **Dark Mode**: Toggle between light and dark themes
- **Smooth Animations**: Powered by Framer Motion
- **Accessibility**: WCAG compliant with proper focus states and ARIA labels
- **SEO Optimized**: Meta tags, Open Graph, and structured data
- **Performance**: Optimized images, lazy loading, and efficient animations
- **Modern Stack**: React 18, TypeScript, Tailwind CSS, Vite

## 📋 Sections

1. **Hero**: Introduction with profile photo and call-to-action buttons
2. **Skills**: Technology stack displayed as interactive pills
3. **Experience**: Work history with impact-focused bullet points
4. **Projects**: Portfolio showcase with image placeholders
5. **Education**: Academic background and certifications
6. **Contact**: Social links and contact information

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Build Tool**: Vite
- **Package Manager**: npm

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd FullTimePortfolio
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

## 📝 Customization Guide

### 1. Update Personal Information

Edit `src/data/portfolio.ts` to replace the sample data with your information:

```typescript
export const portfolio: Portfolio = {
  name: "Your Name",
  role: "Your Role",
  location: "Your Location",
  blurb: "Your personal description...",
  links: {
    email: "your.email@example.com",
    github: "https://github.com/yourusername",
    linkedin: "https://linkedin.com/in/yourusername",
    resume: "https://your-resume-link.com" // Optional
  },
  // ... update other sections
};
```

### 2. Add Your Images

#### Profile Photo
- Place your profile photo as `/public/profile.jpg`
- If no image is provided, a gradient avatar with initials will be displayed

#### Project Screenshots
- Create project screenshots and place them in `/public/projects/`
- Name them according to the project slugs in your data:
  - `ecommerce-platform.png`
  - `task-manager.png`
  - `weather-dashboard.png`
  - etc.

### 3. Customize Colors

Modify the color scheme in `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        DEFAULT: "hsl(var(--primary))",
        foreground: "hsl(var(--primary-foreground))",
      },
      // ... other colors
    },
  },
},
```

Or update CSS variables in `src/index.css`:

```css
:root {
  --primary: 221.2 83.2% 53.3%; /* Blue */
  --primary-foreground: 210 40% 98%;
  /* ... other variables */
}
```

### 4. Update SEO Meta Tags

Edit `index.html` to update:
- Page title
- Meta description
- Open Graph tags
- Twitter Card tags

### 5. Modify Animations

Customize animations in individual components or create new motion variants in `src/components/Motion.tsx`.

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── Nav.tsx         # Navigation bar
│   ├── Hero.tsx        # Hero section
│   ├── Section.tsx     # Section wrapper
│   ├── Skills.tsx      # Skills section
│   ├── Experience.tsx  # Work experience
│   ├── Projects.tsx    # Projects showcase
│   ├── Education.tsx   # Education section
│   ├── Contact.tsx     # Contact section
│   ├── Card.tsx        # Reusable card component
│   ├── Pill.tsx        # Skill/tag pill component
│   ├── ThemeToggle.tsx # Dark/light mode toggle
│   ├── ScrollToTop.tsx # Floating scroll button
│   └── Motion.tsx      # Animation utilities
├── hooks/              # Custom React hooks
│   ├── useActiveSection.ts
│   └── useTheme.ts
├── data/               # Portfolio data
│   └── portfolio.ts
├── App.tsx             # Main app component
├── main.tsx            # App entry point
└── index.css           # Global styles
```

## 🎨 Design System

### Colors
- **Primary**: Blue accent color for buttons and highlights
- **Secondary**: Muted colors for backgrounds and borders
- **Foreground**: Text colors that adapt to theme
- **Muted**: Subtle text and border colors

### Typography
- **Headings**: Bold, large text for section titles
- **Body**: Readable, medium-weight text
- **Small**: Compact text for labels and metadata

### Spacing
- **Container**: `max-w-6xl` with responsive padding
- **Sections**: `py-16 md:py-24` for generous spacing
- **Components**: Consistent gap spacing using Tailwind's spacing scale

## 🔧 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## 📱 Responsive Breakpoints

- **Mobile**: 320px - 768px
- **Tablet**: 768px - 1024px
- **Desktop**: 1024px+

## ♿ Accessibility Features

- **Skip Links**: Jump to main content
- **Focus States**: Visible focus indicators
- **ARIA Labels**: Proper labeling for screen readers
- **Color Contrast**: WCAG AA compliant (4.5:1 ratio)
- **Semantic HTML**: Proper heading hierarchy and landmarks
- **Keyboard Navigation**: Full keyboard accessibility

## 📧 Contact Form Setup

The portfolio includes a modern contact form that sends emails to `arjansubedi2021@gmail.com` using AWS Lambda and API Gateway.

### 🛠️ Setup Instructions:

1. **Deploy the Lambda function:**
   ```bash
   cd lambda
   npm install
   npm run build
   ```

2. **Deploy the CDK infrastructure:**
   ```bash
   cd cdk
   npm run build
   cdk deploy
   ```

3. **Configure Lambda environment variables** in the AWS Lambda console:
   - `SMTP_HOST`: smtp.gmail.com
   - `SMTP_PORT`: 587
   - `SMTP_USER`: your-email@gmail.com
   - `SMTP_PASS`: your-app-password
   - `CONTACT_TO_EMAIL`: arjansubedi2021@gmail.com
   - `FROM_EMAIL`: Portfolio <no-reply@arjansubedi.com>

4. **Update the frontend API URL** in your environment variables:
   ```bash
   cp env.example .env.local
   # Update VITE_API_BASE_URL with your API Gateway URL
   ```

### 📧 Email Configuration:

**Gmail Setup:**
1. Enable 2-factor authentication
2. Generate an App Password
3. Use the App Password in `SMTP_PASS`

### 🔒 Security Features:
- ✅ Honeypot field to prevent spam
- ✅ Rate limiting (1 request per 10 seconds per IP)
- ✅ Client-side and server-side validation
- ✅ Minimum submit time (1.5 seconds)
- ✅ CORS protection
- ✅ Serverless architecture (no EC2 needed)

## 🚀 Deployment
1. Infrastructure deployed via AWS CDK
2. Automatic deployment on push to main branch
3. OIDC authentication for secure AWS access
4. CloudFront CDN for global performance
5. Custom domain with SSL certificate
6. Visit: **https://arjansubedi.com**
7. ✅ Successfully deployed and live!

### Vercel (Alternative)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy automatically on push

### Netlify
1. Build the project: `npm run build`
2. Upload the `dist` folder to Netlify
3. Configure build settings if needed

### Other Platforms
The built files in the `dist` folder can be deployed to any static hosting service.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Animated with [Framer Motion](https://www.framer.com/motion/)
- Icons from [Heroicons](https://heroicons.com/)

---

**Need help?** Feel free to open an issue or reach out for support!
