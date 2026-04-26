export type SectionKey =
  | "summary"
  | "education"
  | "experience"
  | "projects"
  | "skills"
  | "certifications"
  | "languages";

export type ResumeData = {
  personal: {
    fullName: string;
    title: string;
    email: string;
    phone: string;
    location: string;
    website: string;
    linkedin: string;
    github: string;
    summary: string;
  };
  education: EducationItem[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  skills: SkillGroup[];
  certifications: CertificationItem[];
  languages: LanguageItem[];
  settings: {
    templateId: string;
    accentColor: string;
    sectionOrder: SectionKey[];
    fontSize: "xs" | "s" | "m" | "l";
  };
};

export type EducationItem = {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  location: string;
  score: string;
};

export type ExperienceItem = {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  location: string;
  description: string;
  bullets?: string[];
};

export type ProjectItem = {
  id: string;
  name: string;
  link: string;
  technologies: string;
  description?: string;
  bullets: string[];
};

export type SkillGroup = {
  id: string;
  title: string;
  skills: string;
};

export type CertificationItem = {
  id: string;
  name: string;
  issuer: string;
  year: string;
};

export type LanguageItem = {
  id: string;
  name: string;
  level: string;
};

export type TemplateCategory = "Fresher" | "Professional" | "Creative";

export type TemplateDefinition = {
  id: string;
  name: string;
  category: TemplateCategory;
  layout: "classic" | "compact" | "sidebar" | "accent" | "centered";
  description: string;
};
