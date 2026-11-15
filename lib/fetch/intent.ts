import { sevaSkills } from "../signup-profile";
import type { FetchEvent, FetchIntent } from "./types";

type Skill = typeof sevaSkills[number];

const skillAliases: ReadonlyArray<[Skill, RegExp]> = [
  ["Music & bhajans", /\b(sing(?:er|ers|ing)?|vocal(?:ist|ists)?|bhajan(?:s)?|kirtan|musician(?:s)?|music|chant(?:er|ing)?|guitar(?:ist|ists)?|drummer(?:s)?)\b|गायक|गायिका|गायन|संगीत|भजन|कीर्तन|ਗਾਇਕ|ਸੰਗੀਤ|ਭਜਨ|ਕੀਰਤਨ/iu],
  ["Photography", /\b(photograph(?:y|er|ers)?|photo(?:s|grapher)?|camera(?:man|person)?|picture(?:s)?)\b|फोटो|फोटोग्राफ|कैमरा|ਫੋਟੋ|ਫੋਟੋਗ੍ਰਾਫਰ/iu],
  ["Setup & logistics", /\b(set[ -]?up|logistic(?:s)?|arrang(?:e|ement|ements|ing)|chairs?|stage|equipment|pack(?:ing|ers)?)\b|व्यवस्था|सेटअप|मंच|ਸੈੱਟਅੱਪ|ਪ੍ਰਬੰਧ|ਸਟੇਜ/iu],
  ["Kitchen seva", /\b(cook(?:s|ing)?|kitchen|food|meal(?:s)?|catering|chef(?:s)?|langar)\b|रसोई|खाना|भोजन|लंगर|ਰਸੋਈ|ਲੰਗਰ|ਖਾਣਾ/iu],
  ["Decor", /\b(decor(?:ate|ation|ations|ator|ators)?|flower(?:s)?|rangoli|artwork)\b|सजावट|रंगोली|ਸਜਾਵਟ|ਫੁੱਲ/iu],
  ["Driving", /\b(driv(?:e|er|ers|ing)|transport(?:ation)?|pick[ -]?up|carpool|chauffeur(?:s)?)\b|ड्राइवर|गाड़ी|वाहन|ਡਰਾਈਵਰ|ਗੱਡੀ/iu],
  ["Tech & AV", /\b(tech(?:nical|nician|nicians)?|audio|video|a\s?\/?\s?v|sound|mic(?:rophone)?|projector|computer|laptop)\b|तकनीक|साउंड|माइक|ਤਕਨੀਕੀ|ਮਾਈਕ|ਆਵਾਜ਼/iu],
  ["Translation", /\b(translat(?:e|or|ors|ion|ions|ing)|interpret(?:er|ers|ing)?|bilingual|language support)\b|अनुवाद|दुभाषिया|भाषा|ਅਨੁਵਾਦਕ|ਤਰਜਮਾ|ਦੁਭਾਸ਼ੀਏ/iu],
  ["Registration desk", /\b(registr(?:ation|ar)|check[ -]?in|front desk|welcome desk)\b|पंजीकरण|ਰਜਿਸਟ੍ਰੇਸ਼ਨ/iu],
  ["Greeting & hospitality", /\b(greet(?:ing|ers)?|hospitality|usher(?:s)?|welcome|host(?:s|ing)?)\b|स्वागत|अतिथि|ਸਵਾਗਤ|ਮਹਿਮਾਨ/iu],
  ["Kids activities", /\b(kids?|children|childcare|crafts? for kids|youth)\b|बच्चे|बच्चों|ਬੱਚੇ|ਬੱਚਿਆਂ/iu],
  ["Teaching", /\b(teach(?:er|ers|ing)?|instruct(?:or|ors|ion)?|tutor(?:s|ing)?)\b|शिक्षक|पढ़ाना|सिखाना|ਅਧਿਆਪਕ|ਸਿਖਾਉਣ/iu],
  ["Social media", /\b(social media|instagram|facebook|posts?|reels?|content creat(?:or|ors|ion))\b|सोशल मीडिया|ਸੋਸ਼ਲ ਮੀਡੀਆ/iu],
  ["Community Outreach", /\b(outreach|community engagement|flyer(?:s)?|publicity|promotion|canvass(?:ing)?)\b|समुदाय|प्रचार|ਕਮਿਊਨਿਟੀ|ਸਮੁਦਾਇ/iu],
];

const countWords = new Map<string, number>([
  ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5], ["six", 6], ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10],
  ["un", 1], ["une", 1], ["deux", 2], ["trois", 3], ["quatre", 4], ["cinq", 5],
  ["एक", 1], ["दो", 2], ["तीन", 3], ["चार", 4], ["पांच", 5], ["पाँच", 5],
  ["ਇੱਕ", 1], ["ਇਕ", 1], ["ਦੋ", 2], ["ਤਿੰਨ", 3], ["ਚਾਰ", 4], ["ਪੰਜ", 5],
]);

const ignoredEventTokens = new Set(["event", "seva", "help", "helpers", "volunteer", "volunteers", "find", "need", "for", "the", "my"]);

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function quantityFrom(raw: string) {
  const converted = raw.replace(/[०-९]/g, char => String(char.charCodeAt(0) - 0x0966))
    .replace(/[੦-੯]/g, char => String(char.charCodeAt(0) - 0x0a66));
  const digits = converted.match(/(?:^|\s)(\d{1,2})(?=\s|$)/u);
  if (digits) return Number(digits[1]);
  const words = normalize(converted).split(/\s+/u);
  for (const word of words) if (countWords.has(word)) return countWords.get(word) ?? null;
  return null;
}

function eventTokens(title: string) {
  return normalize(title).split(/\s+/u).filter(token => token.length > 2 && !ignoredEventTokens.has(token));
}

function resolveEvent(raw: string, events: FetchEvent[], selectedEventId?: string) {
  const query = normalize(raw);
  const direct = events.filter(event => query.includes(normalize(event.title)));
  if (direct.length === 1) return { event: direct[0], ambiguous: false };
  if (direct.length > 1) return { event: null, ambiguous: true };

  const scored = events.map(event => ({
    event,
    score: eventTokens(event.title).filter(token => query.split(/\s+/u).includes(token)).length,
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  if (scored.length && (scored.length === 1 || scored[0].score > scored[1].score)) {
    return { event: scored[0].event, ambiguous: false };
  }
  if (scored.length > 1 && scored[0].score === scored[1].score) return { event: null, ambiguous: true };
  return { event: events.find(event => event.id === selectedEventId) ?? null, ambiguous: false };
}

export function parseFetchIntent(raw: string, events: FetchEvent[], selectedEventId?: string): FetchIntent {
  const text = raw.trim().slice(0, 350);
  const skills = skillAliases.filter(([, alias]) => alias.test(text)).map(([skill]) => skill);
  const quantity = quantityFrom(text);
  const { event, ambiguous } = resolveEvent(text, events, selectedEventId);
  const urgentOnly = /\b(urgent|priority|last[ -]?minute|emergency|asap)\b/iu.test(text);
  let skillSource: FetchIntent["skillSource"] = skills.length ? "query" : null;
  let interpretedSkills = [...new Set(skills)];
  let clarification: string | null = null;

  if (!text) clarification = "Tell Fetch what kind of volunteer you need.";
  else if (quantity !== null && (quantity < 1 || quantity > 20)) clarification = "Choose a quantity between 1 and 20.";
  else if (ambiguous) clarification = "Which event did you mean? Choose it below and try again.";
  else if (!event) clarification = events.length
    ? "Choose an upcoming event before asking Fetch."
    : "Create an upcoming event before asking Fetch to find volunteers.";

  if (!clarification && !interpretedSkills.length) {
    const onlyApprovedSkill = event?.required_skills.length === 1
      ? sevaSkills.find(skill => skill === event.required_skills[0])
      : undefined;
    if (onlyApprovedSkill) {
      interpretedSkills = [onlyApprovedSkill];
      skillSource = "event";
    } else {
      clarification = event?.required_skills.length
        ? `Which skill do you need for ${event.title}? Try one of its saved skills: ${event.required_skills.join(", ")}.`
        : "Which skill do you need? Try “singers”, “photographers”, or “setup helpers”.";
    }
  }

  return {
    raw: text,
    eventId: event?.id ?? null,
    eventTitle: event?.title ?? null,
    skills: interpretedSkills,
    quantity,
    urgentOnly,
    skillSource,
    clarification,
  };
}

export function approvedFetchSkills() {
  return sevaSkills;
}
