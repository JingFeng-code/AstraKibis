import { characters, phrases, taiwanPhrases, variants, localTerms } from "./zh-tw-dictionary.ts";
function compile(dict: Record<string, string>) {
  const max = Math.max(1, ...Object.keys(dict).map(key => key.length));
  return (text: string): string => {
    let out = "";
    for (let i = 0; i < text.length;) {
      let matched = false;
      for (let len = Math.min(max, text.length - i); len > 0; len--) {
        const key = text.slice(i, i + len);
        if (Object.hasOwn(dict, key)) { out += dict[key]; i += len; matched = true; break; }
      }
      if (!matched) { out += text[i]; i++; }
    }
    return out;
  };
}
const toTraditional = compile({ ...characters, ...phrases, ...localTerms });
const toTaiwan = compile({ ...variants, ...taiwanPhrases });
export function toTaiwanUi(text: string): string {
  if (Object.hasOwn(localTerms, text)) return localTerms[text]!;
  return text.split(/(\{\w+\}|https?:\/\/[^\s]+)/g).map((part, i) =>
    i % 2 ? part : toTaiwan(toTraditional(part))
  ).join("");
}
