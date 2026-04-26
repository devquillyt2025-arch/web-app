import { sampleResume } from "./data";
import type { ResumeData } from "./types";

const STORAGE_KEY = "light-resume-builder:v1";

export function loadResume(): ResumeData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : sampleResume;
  } catch {
    return sampleResume;
  }
}

export function saveResume(resume: ResumeData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(resume));
}

export function clearSavedResume() {
  localStorage.removeItem(STORAGE_KEY);
}
