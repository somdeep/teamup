import { readText } from "./auth-input";

export const expertiseGroups = [
  {
    name: "Courses",
    options: ["Happiness Program", "SKY Breath Meditation", "Sri Sri Yoga", "Sahaj Samadhi Meditation"],
  },
  {
    name: "Seva skills",
    options: ["Community Outreach", "Event Setup", "Food Service", "Photography", "Registration", "Teaching"],
  },
];

const allowedExpertise = new Set(expertiseGroups.flatMap(group => group.options));

export function readSignupProfile(form: FormData) {
  const name = readText(form, "fullName").trim();
  const intent = readText(form, "role");
  const phone = readText(form, "phone").trim();
  const lastCourse = readText(form, "lastCourse").trim();
  const expertise = [...new Set(form.getAll("expertise"))];

  if (!name || name.length > 100 || (intent !== "Teacher" && intent !== "Volunteer")) {
    return { error: "Enter a valid name and signup preference." } as const;
  }
  if (phone.length > 32) return { error: "Enter a phone number with at most 32 characters." } as const;
  if (lastCourse.length > 120) return { error: "Enter a course name with at most 120 characters." } as const;

  const selections = expertise.filter((value): value is string => typeof value === "string" && allowedExpertise.has(value));
  if (selections.length !== expertise.length) return { error: "Choose courses and skills from the list." } as const;

  return {
    profile: {
      display_name: name,
      signup_intent: intent,
      ...(phone ? { contact_phone: phone } : {}),
      ...(lastCourse ? { last_course: lastCourse } : {}),
      ...(selections.length ? { signup_expertise: selections } : {}),
    },
  } as const;
}
