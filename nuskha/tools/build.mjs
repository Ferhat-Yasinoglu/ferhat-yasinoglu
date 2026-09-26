// data/*.json را داخل index.html می‌گذارد تا برنامه یک فایل باشد و بدون انترنت باز شود.
//   node nuskha/tools/build.mjs
// دوباره اجرا کردن بی‌خطر است: فقط سطر `const DATA = ...;` عوض می‌شود.
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('..', import.meta.url);
const read = p => JSON.parse(readFileSync(new URL(p, dir), 'utf8'));

const { version, drugs } = read('data/drugs.json');
const clinical = read('data/clinical.json');

/** «Cap: Zetrol (Azithromycin) 250 mg» — همان شکلی که در لیست و نسخه دیده می‌شود. */
function drugName(d) {
  const core = d.brand ? `${d.brand} (${d.generic})` : d.generic;
  const str = d.unit === '%' ? `${d.strength}%` : [d.strength, d.unit].filter(Boolean).join(' ');
  return `${d.form}: ${core}${str ? ' ' + str : ''}`;
}

const seen = new Set();
const out = [];
for (const d of drugs) {
  const name = drugName(d);
  const key = name.toLowerCase().replace(/\s+/g, ' ');
  if (seen.has(key)) continue;
  seen.add(key);
  out.push({
    name, brand: d.brand || '', generic: d.generic, form: d.form, strength: d.strength, unit: d.unit,
    dose: d.dose || '', timing: d.timing || '', tariqa: d.tariqa || '', n: d.n || '',
    notes: '', frequent: !!d.frequent, fav: false,
  });
}
out.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));

const DATA = {
  version,
  drugs: out,
  symptoms: clinical.symptoms,
  labGroups: clinical.labGroups,
  diagnoses: clinical.diagnoses,
  doseOptions: clinical.doseOptions,
  timingOptions: clinical.timingOptions,
  tariqaOptions: clinical.tariqaOptions,
};

const file = new URL('index.html', dir);
const html = readFileSync(file, 'utf8');
const re = /^const DATA = .*;$/m;
if (!re.test(html)) throw new Error('index.html: سطر `const DATA = ...;` پیدا نشد');
// `</` در JSON می‌تواند تگ script را ببندد.
const json = JSON.stringify(DATA).replace(/<\//g, '<\\/');
writeFileSync(file, html.replace(re, () => `const DATA = ${json};`));
console.log(`index.html: ${out.length} دوا، ${DATA.symptoms.length} علامه، ${DATA.labGroups.length} گروپ لابراتوار، ${DATA.diagnoses.length} تشخیص (نسخه‌ی لیست ${version})`);
