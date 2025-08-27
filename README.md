# Arjan Subedi - Portfolio

A modern, responsive portfolio website built with React, TypeScript, and Tailwind CSS. Features smooth animations, dark mode, and a serverless contact form.

## 🌟 Features

- **Modern Design**: Clean, professional layout with smooth animations
- **Dark/Light Mode**: Toggle between themes with persistent preference
- **Responsive**: Optimized for all devices and screen sizes
- **Accessibility**: WCAG compliant with semantic HTML and ARIA labels
- **Contact Form**: Serverless contact form powered by EmailJS
- **SEO Optimized**: Meta tags, structured data, and performance optimized
- **Auto Deployment**: CI/CD pipeline with GitHub Actions

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Framer Motion
- **Form Handling**: React Hook Form, Zod validation
- **Email Service**: EmailJS (serverless email delivery)
- **Deployment**: AWS S3, CloudFront, Route 53
- **CI/CD**: GitHub Actions with OIDC authentication

## 🚀 Live Demo

Visit: [https://arjansubedi.com](https://arjansubedi.com)

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/itisaarjan/FullTimePortfolio.git
cd FullTimePortfolio

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🔧 Configuration

### EmailJS Setup

The contact form uses EmailJS for serverless email delivery. To set up:

1. **Create EmailJS Account**: Sign up at [emailjs.com](https://www.emailjs.com/)
2. **Add Email Service**: Connect your email provider (Gmail, Outlook, etc.)
3. **Create Email Template**: Use variables `{{from_name}}`, `{{from_email}}`, `{{message}}`
4. **Get API Keys**: Copy your Public Key, Service ID, and Template ID

### GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

- `REACT_APP_EMAILJS_PUBLIC_KEY`: Your EmailJS Public Key
- `REACT_APP_EMAILJS_SERVICE_ID`: Your EmailJS Service ID
- `REACT_APP_EMAILJS_TEMPLATE_ID`: Your EmailJS Template ID
- `AWS_ROLE_ARN`: AWS IAM role ARN for deployment
- `S3_BUCKET_NAME`: S3 bucket name for hosting
- `CLOUDFRONT_DISTRIBUTION_ID`: CloudFront distribution ID (optional)

## 🏗️ Project Structure

```
src/
├── components/          # React components
│   ├── ContactSection.tsx
│   ├── Hero.tsx
│   ├── Skills.tsx
│   ├── Experience.tsx
│   ├── Projects.tsx
│   ├── Education.tsx
│   ├── Honors.tsx
│   └── Section.tsx
├── data/               # Portfolio content
│   └── portfolio.ts
├── types/              # TypeScript type definitions
│   └── images.d.ts
├── images/             # Project images
└── App.tsx             # Main application component
```

## 🚀 Deployment

The project automatically deploys to AWS S3 via GitHub Actions:

1. **Push to main branch** triggers deployment
2. **GitHub Actions** builds the project with EmailJS configuration
3. **AWS S3** hosts the static files
4. **CloudFront** serves content with CDN optimization
5. **Route 53** provides custom domain routing

## 📝 Customization

### Content Updates

Edit `src/data/portfolio.ts` to update your information:

- Personal details
- Skills and technologies
- Work experience
- Projects
- Education
- Honors and awards

### Styling

- **Colors**: Modify Tailwind CSS classes in components
- **Animations**: Adjust Framer Motion properties
- **Layout**: Update component structure and spacing

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 📞 Contact

- **Website**: [arjansubedi.com](https://arjansubedi.com)
- **Email**: arjansubedi2021@gmail.com
- **LinkedIn**: [Your LinkedIn]
- **GitHub**: [@itisaarjan](https://github.com/itisaarjan)
