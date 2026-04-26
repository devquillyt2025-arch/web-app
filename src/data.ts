import type { ResumeData, SectionKey, TemplateDefinition } from "./types";

export const sectionLabels: Record<SectionKey, string> = {
  summary: "Summary",
  education: "Education",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  certifications: "Certifications",
  languages: "Languages",
};

export const defaultSectionOrder: SectionKey[] = [
  "summary",
  "education",
  "experience",
  "projects",
  "skills",
  "certifications",
  "languages",
];

export const templates: TemplateDefinition[] = [
  { id: "fresher-classic", name: "Fresher Classic", category: "Fresher", layout: "classic", description: "Simple one-page campus resume" },
  { id: "fresher-compact", name: "Fresher Compact", category: "Fresher", layout: "compact", description: "Dense layout for internships" },
  { id: "fresher-campus", name: "Fresher Campus", category: "Fresher", layout: "centered", description: "Clean header for placements" },
  { id: "fresher-simple", name: "Fresher Simple", category: "Fresher", layout: "accent", description: "Minimal accent line" },
  { id: "professional-clean", name: "Professional Clean", category: "Professional", layout: "classic", description: "ATS-friendly professional format" },
  { id: "professional-modern", name: "Professional Modern", category: "Professional", layout: "accent", description: "Modern spacing without graphics" },
  { id: "professional-compact", name: "Professional Compact", category: "Professional", layout: "compact", description: "More content on one page" },
  { id: "professional-executive", name: "Professional Executive", category: "Professional", layout: "centered", description: "Senior-friendly structure" },
  { id: "creative-minimal", name: "Creative Minimal", category: "Creative", layout: "accent", description: "Subtle creative styling" },
  { id: "creative-sidebar", name: "Creative Sidebar", category: "Creative", layout: "sidebar", description: "Left rail for contact and skills" },
  { id: "creative-accent", name: "Creative Accent", category: "Creative", layout: "accent", description: "Clean layout with color accent" },
];

export const emptyResume: ResumeData = {
  personal: {
    fullName: "",
    title: "",
    email: "",
    phone: "",
    location: "",
    website: "",
    linkedin: "",
    github: "",
    summary: "",
  },
  education: [
    {
      id: "edu-1",
      institution: "",
      degree: "",
      field: "",
      startDate: "",
      endDate: "",
      location: "",
      score: "",
    },
  ],
  experience: [],
  projects: [],
  skills: [{ id: "skill-1", title: "Technical Skills", skills: "" }],
  certifications: [],
  languages: [],
  settings: {
    templateId: "fresher-classic",
    accentColor: "#2563eb",
    sectionOrder: defaultSectionOrder,
  },
};

export const sampleResume: ResumeData = {
  personal: {
    fullName: "Aarav Sharma",
    title: "Frontend Developer",
    email: "aarav@example.com",
    phone: "+91 98765 43210",
    location: "Bengaluru, India",
    website: "aarav.dev",
    linkedin: "linkedin.com/in/aarav",
    github: "github.com/aarav",
    summary:
      "Frontend developer focused on building fast, accessible web interfaces with React, TypeScript, and clean UI systems.",
  },
  education: [
    {
      id: "edu-1",
      institution: "Visvesvaraya Technological University",
      degree: "B.Tech",
      field: "Computer Science",
      startDate: "2020",
      endDate: "2024",
      location: "Karnataka",
      score: "CGPA 8.4",
    },
  ],
  experience: [
    {
      id: "exp-1",
      company: "BrightApps",
      role: "Frontend Intern",
      startDate: "Jan 2024",
      endDate: "Jun 2024",
      location: "Remote",
      description:
        "Built responsive React components used across customer dashboards.\nImproved form performance by reducing unnecessary re-renders.",
    },
  ],
  projects: [
    {
      id: "project-1",
      name: "Expense Tracker",
      link: "github.com/aarav/expense-tracker",
      technologies: "React, TypeScript, LocalStorage",
      bullets: ["Created a mobile-friendly expense tracker with category summaries."],
    },
  ],
  skills: [
    { id: "skill-1", title: "Frontend", skills: "React, TypeScript, JavaScript, HTML, CSS" },
    { id: "skill-2", title: "Tools", skills: "Git, Vite, Figma, Chrome DevTools" },
  ],
  certifications: [{ id: "cert-1", name: "Responsive Web Design", issuer: "freeCodeCamp", year: "2023" }],
  languages: [
    { id: "lang-1", name: "English", level: "Professional" },
    { id: "lang-2", name: "Hindi", level: "Native" },
  ],
  settings: {
    templateId: "fresher-classic",
    accentColor: "#2563eb",
    sectionOrder: defaultSectionOrder,
  },
};
