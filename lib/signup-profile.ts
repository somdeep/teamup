import { readText } from "./auth-input";

export const sevaSkills = [
  "Community Outreach", "Decor", "Driving", "Greeting & hospitality", "Kids activities", "Kitchen seva",
  "Music & bhajans", "Photography", "Registration desk", "Setup & logistics", "Social media", "Teaching",
  "Tech & AV", "Translation",
] as const;

export const expertiseGroups = [
  {
    name: "Courses",
    options: [
      "ART Excel", "Art of Living Part 1", "Art of Living Part 2", "Deep Dive Retreat", "Deep Sleep & Anxiety Relief",
      "DSN", "IP Junior Program", "IP Kids Program", "IP Teens Program", "Sahaj Samadhi Meditation", "Sanyam",
      "Shakti Kriya", "SKY Happiness Retreat", "Sri Sri Yoga Program", "VTP", "YES!",
    ],
  },
  {
    name: "Seva skills",
    options: sevaSkills,
  },
];

const allowedExpertise = new Set(expertiseGroups.flatMap(group => group.options));

export type SignupRole = "Teacher" | "Volunteer" | "Member";

export function isSignupIntent(value: unknown): value is SignupRole {
  return value === "Teacher" || value === "Volunteer" || value === "Member";
}

export function isJoinIntent(value: unknown): value is Exclude<SignupRole, "Member"> {
  return value === "Teacher" || value === "Volunteer";
}

function isProfileName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 100;
}

export type SignupProfileInput = {
  display_name: string;
  signup_intent: SignupRole;
  location: string;
  contact_phone?: string;
  last_course?: string;
  signup_expertise?: string[];
};

export function readSignupProfile(form: FormData): { profile: SignupProfileInput } | { error: string } {
  const name = readText(form, "fullName").trim();
  const intent = readText(form, "role");
  const phone = readText(form, "phone").trim();
  const location = readText(form, "location").trim();
  const lastCourse = readText(form, "lastCourse").trim();
  const expertise = [...new Set(form.getAll("expertise"))];

  if (!isProfileName(name) || !isJoinIntent(intent)) {
    return { error: "Enter a valid name and signup preference." } as const;
  }
  if (!location || location.length > 100) return { error: "Enter your city or area." } as const;
  if (phone.length > 32) return { error: "Enter a phone number with at most 32 characters." } as const;
  if (lastCourse.length > 120) return { error: "Enter a course name with at most 120 characters." } as const;

  const selections = expertise.filter((value): value is string => typeof value === "string" && allowedExpertise.has(value));
  if (selections.length !== expertise.length) return { error: "Choose courses and skills from the list." } as const;

  return {
    profile: {
      display_name: name,
      signup_intent: intent,
      location,
      ...(phone ? { contact_phone: phone } : {}),
      ...(lastCourse ? { last_course: lastCourse } : {}),
      ...(selections.length ? { signup_expertise: selections } : {}),
    },
  } as const;
}
