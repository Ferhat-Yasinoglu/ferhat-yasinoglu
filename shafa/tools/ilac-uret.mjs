#!/usr/bin/env node
// Hazır ilaç listesini (app/veri/ilaclar.json) üretir: Shafa'nın kendi
// listesi + nuskha'nın ilaç ADLARI.
//
//   node tools/ilac-uret.mjs                  → farkı özetler, dosyaya yazmaz
//   node tools/ilac-uret.mjs --yaz            → app/veri/ilaclar.json'u yazar
//   node tools/ilac-uret.mjs --nuskha <drugs.json> [--kaynak-yaz] [--yaz]
//
// Kaynak varsayılan olarak depodaki kopyadır (tools/kaynak/nuskha-ilaclar.json):
// üretim öbür depo olmadan da tekrarlanabilsin. `--kaynak-yaz` verilen
// nuskha dosyasını ayıklayıp o kopyanın yerine yazar.
//
// NEDEN nuskha'nın dose/timing/tariqa/n alanları okunur okunmaz siliniyor:
// onlar ilaç başına hazır kullanım (ör. Amoxil → «۱ دانه · روزانه ۳ بار ·
// 15»). Shafa reçete ÖNERMİYOR; kullanım kararı hekimin. Bu alanlar
// kopyaya da, listeye de girmiyor; bir test ve `npm run kontrol` bunu koruyor.
//
// Kimlik kararlılığı: önceki liste (app/veri/ilaclar.json) kimliklerin
// kaynağıdır. Oradaki her satır olduğu gibi kalır (kimliği `hid` asla
// değişmez, silinmez — birinin cihazında o kimlikle kayıt olabilir); nuskha
// satırı önceki bir satırla aynı ürünse o satıra katılır, değilse sıradaki
// kimlikle eklenir. Aynı girdiyle ikinci çalıştırma aynı dosyayı verir
// (test/ilac-uret.test.js).
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { ilacAnahtari } from '../app/js/paylasilan/ilac-listesi.js';
import { FORMLAR } from '../app/js/paylasilan/ilac.js';

const LISTE_YOLU = new URL('../app/veri/ilaclar.json', import.meta.url);
export const KAYNAK_YOLU = new URL('./kaynak/nuskha-ilaclar.json', import.meta.url);

/** nuskha'dan ASLA alınmayan alanlar (ilaç başına hazır kullanım). */
export const YASAK_KAYNAK = ['dose', 'timing', 'tariqa', 'n'];
/** Listede bulunabilecek alanlar; başka alan (ör. kullanim, sure) = hata. */
export const IZINLI_ALANLAR = ['hid', 'ad', 'etkenMadde', 'form', 'doz', 'marka', 'kisa', 'grup', 'receteli', 'sik', 'eski'];

const ACIKLAMA = 'Yaygın ilaçların adı, etken maddesi, şekli ve dozu (güç). Bu bir AD sözlüğüdür: '
  + 'kullanım şekli, doz aralığı, süre ve endikasyon taşımaz; o karar hekimindir. '
  + '3. sürüm: nuskha listesinden ad, şekil ve güç eklendi (hid kalıcı kimlik, grup ilaç grubu, '
  + 'marka ticari ad işareti, kisa kâğıttaki Latin önek). nuskha’nın ilaç başına hazır '
  + 'kullanım/zaman/tarika/adet değerleri bilerek ALINMADI.';

/* ---------------------------------------------------------------- gruplar
   BNF bölüm mantığı; birkaç pratik ayrımla (antibiyotik öbür enfeksiyon
   ilaçlarından, ağrı kesici sinir-ruhtan, kan sulandırıcı kalpten ayrı).
   Süzgeçte bu sırayla görünüyor. */
export const GRUPLAR = [
  ['antibiyotik', 'آنتی‌بیوتیک', 'Antibiotics & anti-TB'],
  ['qarch_viros', 'ضد قارچ و ضد ویروس', 'Antifungals & antivirals'],
  ['parazit', 'ضد کرم، پرازیت و ملاریا', 'Anthelmintics, antiprotozoals & antimalarials'],
  ['musakkin', 'مسکن و ضد التهاب', 'Analgesics & anti-inflammatories'],
  ['mide', 'معده و روده', 'Gastrointestinal'],
  ['tanaffus', 'تنفسی، سرفه و زکام', 'Respiratory, cough & cold'],
  ['hassasiyat', 'ضد حساسیت', 'Antihistamines & allergy'],
  ['qalb', 'قلب، فشار خون و چربی', 'Cardiovascular & lipids'],
  ['khun', 'رقیق‌کننده و بندکننده خون', 'Antithrombotics & haemostatics'],
  ['shakar', 'مرض شکر (دیابت)', 'Diabetes'],
  ['hormon', 'هورمون، تایرایید و کورتیزون', 'Hormones, thyroid & corticosteroids'],
  ['zanan', 'زنان، ولادی و مجاری ادرار', 'Obstetrics, gynaecology & urology'],
  ['asab', 'اعصاب و روان', 'Neurology & psychiatry'],
  ['mafasil', 'مفاصل، عضلات و استخوان', 'Musculoskeletal, gout & bone'],
  ['vitamin', 'ویتامین، منرال و آهن', 'Vitamins, minerals & iron'],
  ['jild', 'جلدی (موضعی)', 'Skin (topical)'],
  ['gosh_chashm', 'چشم، گوش، بینی و دهان', 'Eye, ear, nose & mouth (topical)'],
  ['serum', 'سیروم و مایعات وریدی', 'IV fluids'],
];
const GRUP_ANAHTARLARI = new Set(GRUPLAR.map(([k]) => k));

/* ---------------------------------------------------------------- şekiller
   nuskha şekli → [Shafa şekli, kâğıttaki Latin önek (yoksa formKisa), yer].
   FORMLAR bilerek genişletilmedi: 2-3 nadir şekil için yeni sözlük anahtarı
   ve sayfa süzgeci gerekirdi; kaybolan yalnız basılan sözcüktü, `kisa` onu
   geri veriyor. */
const SEKIL = {
  Tab: ['tablet', null, ''], Cap: ['kapsul', null, ''],
  Syp: ['surup', null, ''], Susp: ['surup', 'Susp', ''],
  Amp: ['ampul', null, ''], Vial: ['ampul', 'Vial', ''], Inj: ['ampul', 'Inj', ''], Inf: ['ampul', 'Inf', ''],
  Cream: ['krem', 'Cream', ''], Oint: ['krem', null, ''], Gel: ['krem', 'Gel', ''], Lotion: ['krem', 'Lotion', ''],
  Shampoo: ['diger', 'Shampoo', ''], Powder: ['posetl', 'Powder', ''],
  Drops: ['damla', null, ''], 'Eye Drops': ['damla', 'Eye Drops', 'eye'], 'Ear Drops': ['damla', 'Ear Drops', 'ear'],
  'Nasal Spray': ['sprey', 'Nasal Spray', 'nose'], Inhaler: ['sprey', 'Inhaler', ''],
  Supp: ['fitil', null, ''], Sachet: ['posetl', null, ''], Mouthwash: ['diger', 'Mouthwash', 'mouth'],
};
/** `kisa` yalnız bunlardan biri olabilir (test de bakıyor). */
export const KISALAR = ['Susp', 'Vial', 'Inj', 'Inf', 'Cream', 'Gel', 'Lotion', 'Eye Drops', 'Ear Drops', 'Nasal Drops',
  'Nasal Spray', 'Inhaler', 'Eye Oint', 'Oral Gel', 'Oral Paste', 'Vag Tab', 'Mouthwash', 'Shampoo', 'Powder'];

/* nuskha etken adı → [etkenMadde (INN), jenerik ada eklenen niteleyici, yer, kisa].
   Parantez içi ya eş anlamlıdır (atılır) ya yer/salım bilgisidir (kalır). */
const NITELIK = {
  'Cholecalciferol (Vitamin D3)': ['Colecalciferol', '', '', null],
  Cholecalciferol: ['Colecalciferol', '', '', null],
  'Vitamin A + Cholecalciferol (Vitamin D3)': ['Vitamin A + Colecalciferol', '', '', null],
  'Calcium Carbonate + Cholecalciferol': ['Calcium carbonate + Colecalciferol', '', '', null],
  'Ascorbic Acid (Vitamin C)': ['Ascorbic acid', '', '', null],
  'Vitamin A (Retinol)': ['Retinol', '', '', null],
  'Vitamin E (Tocopherol)': ['Tocopherol', '', '', null],
  'Phytomenadione (Vitamin K1)': ['Phytomenadione', '', '', null],
  'Epinephrine (Adrenaline)': ['Adrenaline', '', '', null],
  'Adrenaline (Epinephrine)': ['Adrenaline', '', '', null],
  'Nystatin (oral)': ['Nystatin', '', '', null],
  'Montelukast (chewable)': ['Montelukast', 'chewable', '', null],
  'Acetylcysteine (effervescent)': ['Acetylcysteine', 'effervescent', '', null],
  'Theophylline (SR)': ['Theophylline', 'SR', '', null],
  'Metformin XR': ['Metformin', 'XR', '', null],
  'Gliclazide MR': ['Gliclazide', 'MR', '', null],
  'Clotrimazole (vaginal)': ['Clotrimazole', 'vaginal', 'vagina', 'Vag Tab'],
  'Miconazole (oral gel)': ['Miconazole', 'oral gel', 'mouth', 'Oral Gel'],
  'Acyclovir (eye ointment)': ['Acyclovir', 'eye ointment', 'eye', 'Eye Oint'],
  'Chloramphenicol (eye ointment)': ['Chloramphenicol', 'eye ointment', 'eye', 'Eye Oint'],
  'Tetracycline (eye ointment)': ['Tetracycline', 'eye ointment', 'eye', 'Eye Oint'],
  'Triamcinolone acetonide (oral paste)': ['Triamcinolone acetonide', 'oral paste', 'mouth', 'Oral Paste'],
  'Sodium Chloride (nasal)': ['Sodium chloride', 'nasal drops', 'nose', 'Nasal Drops'],
  'Sodium chloride (nasal drops)': ['Sodium chloride', 'nasal drops', 'nose', 'Nasal Drops'],
  'Xylometazoline (paediatric nasal drops)': ['Xylometazoline', 'nasal drops', 'nose', 'Nasal Drops'],
  'Benzoic acid + Salicylic acid (Whitfield)': ['Benzoic acid + Salicylic acid', '', '', null],
  'Sodium Chloride 0.9% (Normal Saline)': ['Sodium chloride 0.9%', 'Normal Saline', '', null],
  'Dextrose 5% (D5W)': ['Dextrose 5%', '', '', null],
  'Dextrose 5% + Sodium Chloride 0.9% (DNS)': ['Dextrose 5% + Sodium chloride 0.9%', 'DNS', '', null],
  'Multivitamin + Minerals (Prenatal)': ['Multivitamin + Minerals', 'prenatal', '', null],
  'Insulin Human Regular (Soluble)': ['Insulin human regular', '', '', null],
  'Insulin Isophane (NPH)': ['Insulin human isophane', '', '', null],
  'Iron (III) Hydroxide Polymaltose': ['Iron(III) hydroxide polymaltose', '', '', null],
  'Iron (III) Hydroxide Polymaltose + Folic Acid': ['Iron(III) hydroxide polymaltose + Folic acid', '', '', null],
  'Chloroquine phosphate': ['Chloroquine', '', '', null],
  'Phenytoin Sodium': ['Phenytoin', '', '', null],
  'Clomiphene Citrate': ['Clomifene', '', '', null],
  Beclomethasone: ['Beclometasone', '', '', null],
  Chlorpheniramine: ['Chlorphenamine', '', '', null],
  Cefalexin: ['Cefalexin', '', '', null],
  Aspirin: ['Acetylsalicylic acid', '', '', null],
  Diclofenac: ['Diclofenac', '', '', null],
};
/* Yalnız birleştirme anahtarı için aynı molekülün yazım farkları (ekrandaki
   ad kaynağın yazımını korur). */
const ESANLAM = {
  cephalexin: 'cefalexin', chlorpheniramine: 'chlorphenamine', beclomethasone: 'beclometasone',
  aspirin: 'acetylsalicylic acid', 'clomiphene citrate': 'clomifene', clomiphene: 'clomifene',
  epinephrine: 'adrenaline', cholecalciferol: 'colecalciferol', 'phenytoin sodium': 'phenytoin',
  'chloroquine phosphate': 'chloroquine', 'insulin isophane': 'insulin human isophane',
  hypromellose: 'artificial tears', carboxymethylcellulose: 'artificial tears',
};

/* ---------------------------------------------------------------- grup tablosu
   Kanonik INN (küçük harf) → grup. Karışım tam yazılmamışsa ilk bileşeninin
   grubunu alır. */
const GRUP = {};
const g = (grup, ...adlar) => {
  if (!GRUP_ANAHTARLARI.has(grup)) throw new Error('bilinmeyen grup ' + grup);
  for (const a of adlar) GRUP[a] = grup;
};
g('antibiyotik', 'amoxicillin', 'amoxicillin + clavulanic acid', 'ampicillin', 'ampicillin + cloxacillin', 'cloxacillin',
  'benzathine benzylpenicillin', 'phenoxymethylpenicillin', 'cefalexin', 'cefadroxil', 'cefradine', 'cefuroxime', 'cefixime',
  'ceftriaxone', 'cefotaxime', 'ceftazidime', 'azithromycin', 'clarithromycin', 'erythromycin', 'ciprofloxacin', 'levofloxacin',
  'ofloxacin', 'moxifloxacin', 'doxycycline', 'tetracycline', 'metronidazole', 'tinidazole', 'sulfamethoxazole + trimethoprim',
  'trimethoprim + sulfamethoxazole', 'nitrofurantoin', 'gentamicin', 'amikacin', 'clindamycin', 'fosfomycin',
  'rifampicin', 'isoniazid', 'ethambutol', 'pyrazinamide', 'rifampicin + isoniazid', 'rifampicin + isoniazid + pyrazinamide',
  'rifampicin + isoniazid + pyrazinamide + ethambutol', 'chloramphenicol', 'tobramycin', 'mupirocin', 'fusidic acid');
g('qarch_viros', 'fluconazole', 'itraconazole', 'terbinafine', 'griseofulvin', 'clotrimazole', 'miconazole', 'nystatin',
  'ketoconazole', 'acyclovir', 'valacyclovir', 'oseltamivir', 'tenofovir disoproxil fumarate', 'entecavir', 'sofosbuvir',
  'daclatasvir', 'sofosbuvir + velpatasvir');
g('parazit', 'albendazole', 'mebendazole', 'pyrantel pamoate', 'nitazoxanide', 'praziquantel', 'ivermectin',
  'metronidazole + diloxanide furoate', 'chloroquine', 'primaquine', 'artemether + lumefantrine', 'artesunate');
g('musakkin', 'paracetamol', 'paracetamol + caffeine', 'paracetamol + orphenadrine', 'ibuprofen', 'diclofenac',
  'diclofenac sodium', 'diclofenac potassium', 'mefenamic acid', 'naproxen', 'naproxen sodium', 'meloxicam', 'piroxicam',
  'celecoxib', 'etoricoxib', 'aceclofenac', 'ketorolac', 'tramadol', 'tramadol + paracetamol', 'metamizole',
  'acetylsalicylic acid', 'nimesulide', 'dexketoprofen', 'ketoprofen', 'indomethacin');
g('mafasil', 'tizanidine', 'baclofen', 'methocarbamol', 'eperisone', 'thiocolchicoside', 'allopurinol', 'colchicine',
  'febuxostat', 'alendronic acid', 'ibandronic acid', 'zoledronic acid');
g('asab', 'sumatriptan', 'rizatriptan', 'ergotamine + caffeine', 'flunarizine', 'carbamazepine', 'sodium valproate',
  'phenytoin', 'phenobarbital', 'levetiracetam', 'pregabalin', 'gabapentin', 'clonazepam', 'diazepam', 'alprazolam',
  'bromazepam', 'amitriptyline', 'fluoxetine', 'sertraline', 'escitalopram', 'paroxetine', 'imipramine', 'haloperidol',
  'chlorpromazine', 'risperidone', 'olanzapine', 'quetiapine', 'trihexyphenidyl', 'betahistine', 'cinnarizine');
g('mide', 'omeprazole', 'esomeprazole', 'pantoprazole', 'rabeprazole', 'lansoprazole', 'famotidine',
  'aluminium hydroxide + magnesium hydroxide', 'aluminium hydroxide + magnesium hydroxide + simethicone',
  'sodium alginate + sodium bicarbonate + calcium carbonate', 'oxetacaine + aluminium hydroxide + magnesium hydroxide',
  'sucralfate', 'metoclopramide', 'domperidone', 'itopride', 'ondansetron', 'dimenhydrinate', 'prochlorperazine',
  'hyoscine butylbromide', 'drotaverine', 'mebeverine', 'chlordiazepoxide + clidinium', 'simethicone', 'lactulose',
  'bisacodyl', 'ispaghula husk', 'oral rehydration salts', 'loperamide', 'racecadotril', 'saccharomyces boulardii',
  'bacillus clausii', 'bismuth subcitrate', 'cinchocaine + hydrocortisone', 'policresulen + cinchocaine',
  'diosmin + hesperidin', 'ursodeoxycholic acid', 'pancreatin');
g('tanaffus', 'salbutamol', 'ipratropium + salbutamol', 'ipratropium bromide', 'beclometasone', 'budesonide',
  'salmeterol + fluticasone', 'budesonide + formoterol', 'fluticasone propionate', 'tiotropium', 'aminophylline',
  'theophylline', 'terbutaline', 'montelukast', 'dextromethorphan', 'guaifenesin', 'bromhexine', 'ambroxol',
  'acetylcysteine', 'aminophylline + diphenhydramine + ammonium chloride + menthol', 'ambroxol + levosalbutamol + guaifenesin',
  'triprolidine + pseudoephedrine');
g('hassasiyat', 'cetirizine', 'levocetirizine', 'loratadine', 'desloratadine', 'fexofenadine', 'chlorphenamine',
  'pheniramine', 'promethazine', 'hydroxyzine', 'cyproheptadine', 'ketotifen', 'adrenaline');
g('qalb', 'amlodipine', 'nifedipine', 'diltiazem', 'verapamil', 'captopril', 'enalapril', 'lisinopril', 'ramipril',
  'losartan', 'losartan + hydrochlorothiazide', 'valsartan', 'valsartan + hydrochlorothiazide', 'amlodipine + valsartan',
  'telmisartan', 'telmisartan + hydrochlorothiazide', 'irbesartan', 'atenolol', 'atenolol + chlorthalidone',
  'metoprolol tartrate', 'metoprolol succinate', 'bisoprolol', 'nebivolol', 'propranolol', 'carvedilol',
  'hydrochlorothiazide', 'indapamide', 'furosemide', 'spironolactone', 'spironolactone + furosemide', 'methyldopa',
  'atorvastatin', 'rosuvastatin', 'simvastatin', 'amlodipine + atorvastatin', 'isosorbide dinitrate',
  'isosorbide mononitrate', 'glyceryl trinitrate', 'digoxin', 'trimetazidine', 'amiodarone', 'omega-3 fatty acids');
g('khun', 'clopidogrel', 'warfarin', 'rivaroxaban', 'apixaban', 'enoxaparin', 'tranexamic acid');
g('shakar', 'metformin', 'glibenclamide', 'gliclazide', 'glimepiride', 'metformin + glibenclamide', 'sitagliptin',
  'sitagliptin + metformin', 'vildagliptin', 'vildagliptin + metformin', 'linagliptin', 'empagliflozin', 'dapagliflozin',
  'pioglitazone', 'acarbose', 'insulin human regular', 'insulin human isophane', 'insulin human biphasic 30/70',
  'insulin glargine', 'insulin aspart', 'insulin aspart biphasic 30/70');
g('hormon', 'levothyroxine', 'carbimazole', 'methimazole', 'propylthiouracil', 'prednisolone', 'dexamethasone',
  'hydrocortisone sodium succinate', 'methylprednisolone', 'methylprednisolone sodium succinate', 'triamcinolone acetonide',
  'betamethasone dipropionate + betamethasone sodium phosphate', 'cabergoline');
g('zanan', 'levonorgestrel + ethinylestradiol', 'levonorgestrel', 'medroxyprogesterone acetate', 'norethisterone',
  'dydrogesterone', 'progesterone', 'estradiol valerate', 'clomifene', 'letrozole', 'cyproterone acetate + ethinylestradiol',
  'hydroxyprogesterone caproate', 'oxytocin', 'tamsulosin', 'finasteride', 'oxybutynin', 'disodium hydrogen citrate');
g('vitamin', 'calcium carbonate', 'calcium carbonate + colecalciferol', 'colecalciferol', 'calcitriol', 'ferrous sulfate',
  'ferrous sulfate + folic acid', 'ferrous sulfate + folic acid + ascorbic acid + vitamin b complex',
  'iron(iii) hydroxide polymaltose', 'iron(iii) hydroxide polymaltose + folic acid', 'iron sucrose',
  'ferric carboxymaltose', 'folic acid', 'vitamin b complex', 'thiamine + pyridoxine + cyanocobalamin', 'cyanocobalamin',
  'hydroxocobalamin', 'methylcobalamin', 'thiamine', 'pyridoxine', 'vitamin a + colecalciferol', 'multivitamin',
  'multivitamin + minerals', 'vitamin b complex + ascorbic acid + vitamin e + zinc', 'vitamin b complex + ascorbic acid',
  'calcium lactate gluconate + calcium carbonate', 'calcium gluconate', 'zinc sulfate', 'retinol', 'tocopherol',
  'ascorbic acid', 'phytomenadione');
g('jild', 'permethrin', 'benzyl benzoate', 'crotamiton', 'sulfur', 'hydrocortisone', 'betamethasone', 'betamethasone valerate',
  'clobetasol propionate', 'mometasone furoate', 'fusidic acid + betamethasone valerate',
  'clotrimazole + betamethasone dipropionate', 'povidone-iodine', 'silver sulfadiazine', 'benzoic acid + salicylic acid',
  'calamine', 'benzoyl peroxide', 'adapalene', 'tretinoin', 'hydroquinone', 'minoxidil');
g('gosh_chashm', 'ciprofloxacin + dexamethasone', 'tobramycin + dexamethasone', 'prednisolone acetate', 'fluorometholone',
  'olopatadine', 'sodium cromoglicate', 'naphazoline + pheniramine', 'artificial tears', 'timolol', 'sodium bicarbonate',
  'xylometazoline', 'oxymetazoline', 'sodium chloride', 'chlorhexidine gluconate', 'benzydamine');
g('serum', 'ringer lactate', 'sodium chloride 0.9%', 'dextrose 5%', 'dextrose 5% + sodium chloride 0.9%');

/* Reçetesiz (OTC) sayılanlar — Afganistan pratiği, bilerek dar tutuldu.
   Yalnız ilaçlar sayfasındaki «نسخه‌ای / بدون نسخه» rozetini belirliyor. */
const OTC = new Set(['paracetamol', 'paracetamol + caffeine', 'ibuprofen', 'acetylsalicylic acid',
  'aluminium hydroxide + magnesium hydroxide', 'aluminium hydroxide + magnesium hydroxide + simethicone',
  'sodium alginate + sodium bicarbonate + calcium carbonate', 'simethicone', 'lactulose', 'bisacodyl', 'ispaghula husk',
  'oral rehydration salts', 'zinc sulfate', 'loperamide', 'saccharomyces boulardii', 'bacillus clausii', 'cetirizine',
  'levocetirizine', 'loratadine', 'desloratadine', 'fexofenadine', 'chlorphenamine', 'dextromethorphan', 'guaifenesin',
  'bromhexine', 'ambroxol', 'acetylcysteine', 'albendazole', 'mebendazole', 'pyrantel pamoate', 'clotrimazole',
  'miconazole', 'terbinafine', 'hydrocortisone', 'calamine', 'benzoyl peroxide', 'povidone-iodine',
  'chlorhexidine gluconate', 'benzydamine', 'artificial tears', 'sodium chloride', 'xylometazoline', 'oxymetazoline',
  'acyclovir', 'permethrin', 'benzyl benzoate', 'benzoic acid + salicylic acid', 'diclofenac']);
/* Yalnız cilde/göze sürülen hâli OTC; ağızdan ya da iğne hâli reçeteli kalır. */
const OTC_TOPIKAL = new Set(['acyclovir', 'clotrimazole', 'miconazole', 'terbinafine', 'hydrocortisone', 'diclofenac']);

/* nuskha'nın kendi içindeki tekrarları: [atılan, aynısı olan]. Satır sırası
   yerine içerikle (etken|marka|güç|birim|şekil) yazılı: kaynak değişip satır
   kayarsa yanlış satır sessizce atılmasın, üretim dursun. */
const NUSKHA_TEKRAR = [
  ['Sodium chloride (nasal drops)||0.9|%|Drops', 'Sodium Chloride (nasal)||0.9|%|Drops'],
  ['Xylometazoline (paediatric nasal drops)|Otrivin|0.05|%|Drops', 'Xylometazoline|Otrivin|0.05|%|Drops'],
  ['Benzoic acid + Salicylic acid||6/3|%|Oint', 'Benzoic acid + Salicylic acid (Whitfield)||6/3|%|Oint'],
  ['Cholecalciferol (Vitamin D3)||50000|IU|Cap', 'Cholecalciferol||50000|IU|Cap'],
  ['Nystatin||100000|IU/ml|Susp', 'Nystatin (oral)||100000|IU/ml|Drops'],
  ['Clomiphene Citrate|Clomid|50|mg|Tab', 'Clomifene|Clomid|50|mg|Tab'],
  ['Adrenaline (Epinephrine)||1|mg/ml|Amp', 'Epinephrine (Adrenaline)||1|mg/ml|Amp'],
];
/* Anahtarın göremediği aynı ürünler (şekil yazımı farklı) → Shafa kimliği. */
const ELLE_BIRLESTIR = [
  ['Oral Rehydration Salts||20.5|g|Sachet', 'h0052'],   // ORS poşeti = «per 1 L» ORS
  ['Nystatin (oral)||100000|IU/ml|Drops', 'h0035'],     // ağız damlası = Nystatin süspansiyonu
];
/* Nerede kullanıldığı yazmayan nuskha damlaları. */
const DAMLA_YERI = { xylometazoline: 'nose', oxymetazoline: 'nose' };
/* ad|doz|form çakışmasını ayırmak için ada eklenen sözcük (krem ≠ merhem). */
const SEKIL_SOZU = { Oint: 'ointment', Cream: 'cream', Gel: 'gel', Lotion: 'lotion', Drops: 'drops' };
/* Kâğıtta okunaklı durmayan jenerik adlar. */
const AD_DUZELT = {
  'Sodium Chloride 0.9% (Normal Saline)': 'Normal saline (NaCl 0.9%)',
  'Dextrose 5% (D5W)': 'Dextrose 5% (D5W)',
  'Dextrose 5% + Sodium Chloride 0.9% (DNS)': 'DNS (Dextrose 5% + NaCl 0.9%)',
};

/* ---------------------------------------------------------------- yardımcılar */
const sade = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const imza = (n) => [n.generic, n.brand, n.strength, n.unit, n.form].map((x) => String(x ?? '').trim()).join('|');

/** 'Clavulanic Acid' → 'Clavulanic acid'; 'B', 'D3', 'NPH', '(III)' olduğu gibi. */
function kucult(bilesen) {
  const [ilk, ...kalan] = bilesen.split(' ');
  const kucuklenir = (x) => {
    const govde = x.slice(1);
    return x.length > 1 && /\p{Lu}/u.test(x[0]) && govde === govde.toLowerCase() && govde !== govde.toUpperCase();
  };
  return [ilk, ...kalan.map((x) => (kucuklenir(x) ? x.toLowerCase() : x))].join(' ');
}

/** Güç + birim: '250' 'mg/5ml' → '250 mg/5 ml'; '1200000' 'IU' → '1,200,000 IU'.
 *  Nokta ondalık ayraçtır; binlik ayraç virgül (Türk yazımı «100.000»
 *  kâğıtta 100 okunuyordu, bin kat). */
export function dozYaz(guc, birim) {
  let s = String(guc ?? '').trim();
  let u = String(birim ?? '').trim();
  if (!s && !u) return '';
  if (u === '%') return `${s}%`;
  if (u === 'mg/IU' && s.includes('/')) {
    const [a, b] = s.split(/\/(.*)/s);
    return `${a} mg/${b} IU`;
  }
  u = u.replace(/\/(\d+(?:\.\d+)?)ml$/, '/$1 ml');
  if (/IU|units/.test(u)) s = s.replace(/\d+/g, (n) => (n.length >= 5 ? n.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : n));
  return s ? `${s} ${u}`.trim() : u;
}

const dozKanon = (d) => sade(d).replace(/—/g, '').replace(/,/g, '').replace(/ /g, '');
const etkenKanon = (e) => String(e ?? '').split('+').map((p) => ESANLAM[sade(p)] ?? sade(p)).map((p) => p.trim()).sort().join(' + ');

/** Shafa'nın kendi satırında yer adın içinde yazılı («… eye drops»). */
function adinYeri(ad) {
  const a = sade(ad);
  for (const [k, yer] of [['eye', 'eye'], ['ear drops', 'ear'], ['nasal', 'nose'], ['artificial tears', 'eye']]) {
    if (a.includes(k)) return yer;
  }
  return '';
}

/* Listeye girmiş satırın yeri: nuskha'dan gelende `kisa` söylüyor (ad
   markaysa yeri adından okunamaz: «Otrivin»). İkinci çalıştırmada nuskha
   satırı kendi eski hâlini ancak böyle buluyor. */
const KISA_YERI = {
  'Eye Drops': 'eye', 'Eye Oint': 'eye', 'Ear Drops': 'ear', 'Nasal Drops': 'nose', 'Nasal Spray': 'nose',
  'Oral Gel': 'mouth', 'Oral Paste': 'mouth', Mouthwash: 'mouth', 'Vag Tab': 'vagina',
};
const satirYeri = (r) => KISA_YERI[r.kisa] || adinYeri(r.ad);

/** Grup: önce kullanıldığı yer (göz/kulak/burun/ağız, vajina), sonra cilde
 *  sürülen şekiller, sonra INN tablosu. Cilde sürülen ağrı kesici (Voltaren
 *  Emulgel) ağrıda, hemoroid kremi mide-bağırsakta kalır. */
function grupBul(etken, form, kisa, yer) {
  if (['eye', 'ear', 'nose', 'mouth'].includes(yer)) return 'gosh_chashm';
  if (yer === 'vagina') return 'zanan';
  const e = ESANLAM[sade(etken)] ?? sade(etken);
  const temel = GRUP[e] || GRUP[e.split(' + ')[0]];
  if (form === 'krem' || ['Shampoo', 'Powder', 'Lotion'].includes(kisa)) {
    return ['musakkin', 'mide'].includes(temel) ? temel : 'jild';
  }
  return temel;
}

/** Birleştirme anahtarı (saklanan kimlik değil). Markalı üründe ad (yer
 *  niteleyicisiyle: «Daktarin oral gel»), jenerikte etken madde. Krem yuvası
 *  aynı ürünün kremini ve merhemini ayrı tutuyor. */
const anahtarKur = (marka, ad, etken, doz, form, yer, kremYuvasi) =>
  JSON.stringify([marka ? 'b' : 'g', marka ? sade(ad) : etkenKanon(etken), dozKanon(doz), form, yer, form === 'krem' ? kremYuvasi : '']);

/** Alanları hep aynı sırada yazar: iki çalıştırma bayt bayt aynı dosyayı versin. */
const sirala = (r) => Object.fromEntries(IZINLI_ALANLAR.filter((k) => r[k] !== undefined).map((k) => [k, r[k]]));

/* ---------------------------------------------------------------- üretim */

/**
 * @param {{ilaclar: object[]}} onceki  önceki liste (kimliklerin kaynağı; v2'de hid yok)
 * @param {object[]} nuskhaSatirlari    nuskha `drugs` (yasak alanlar burada da atılır)
 * @returns {{belge: object, rapor: string[]}}
 */
export function ilacListesiUret(onceki, nuskhaSatirlari) {
  const rapor = [];
  const out = [];
  const anahtar = new Map();   // birleştirme anahtarı → out dizini (ilk gelen kazanır)
  const tekilAd = new Map();   // ilacAnahtari (ad|doz|form) → out dizini
  const dizinle = (k, i) => { if (!anahtar.has(k)) anahtar.set(k, i); };

  // 1) Önceki listenin her satırı olduğu gibi. Kimliği olmayana (v2'den
  //    geçişte hepsi) dosya sırasıyla sıradaki kimlik veriliyor.
  let enBuyuk = Math.max(0, ...onceki.ilaclar.map((h) => Number(/^h(\d{4})$/.exec(h.hid || '')?.[1] || 0)));
  for (const h of onceki.ilaclar) {
    const r = { ...h };
    if (!r.hid) r.hid = `h${String(++enBuyuk).padStart(4, '0')}`;
    const yer = satirYeri(r);
    if (!r.grup) r.grup = grupBul(r.etkenMadde, r.form, r.kisa, yer);
    const i = out.push(sirala(r)) - 1;
    // Kisasız krem: Shafa'nın kendi krem satırları kremdir (kâğıtta «Oint»
    // basılsa da), nuskha'dan gelmiş kisasız krem merhemdir. Hangisi olduğu
    // satırdan okunamıyor; iki yuvaya da yazılıyor, ilk gelen kazanıyor.
    const yuvalar = r.form === 'krem' && !r.kisa ? ['Cream', 'Oint'] : [r.kisa || ''];
    for (const y of yuvalar) dizinle(anahtarKur(r.marka, r.ad, r.etkenMadde, r.doz, r.form, yer, y), i);
    tekilAd.set(ilacAnahtari(r), i);
  }

  // 2) nuskha satırları
  const atilanlar = new Map(NUSKHA_TEKRAR);
  const elle = new Map(ELLE_BIRLESTIR);
  const kullanilan = new Set();
  const sayac = { ayni: 0, elle: 0, ic_tekrar: 0, ad_carpisti: 0, eklendi: 0 };
  for (const ham of nuskhaSatirlari) {
    // Yalnız ad alanları okunuyor; dose/timing/tariqa/n bu satırdan öteye geçmiyor.
    const n = { form: ham.form, generic: ham.generic, brand: ham.brand, strength: ham.strength, unit: ham.unit, frequent: ham.frequent };
    const im = imza(n);
    if (atilanlar.has(im)) {
      kullanilan.add(im); sayac.ic_tekrar++;
      rapor.push(`DROP ${im}: ${atilanlar.get(im)} ile aynı`);
      continue;
    }
    if (!SEKIL[n.form]) throw new Error(`bilinmeyen nuskha şekli: ${n.form} (${im})`);
    let [form, kisa, yer] = SEKIL[n.form];
    const nit = NITELIK[n.generic];
    let etken, nitelik = '', nYer = '', nKisa = null;
    if (nit) [etken, nitelik, nYer, nKisa] = nit;
    else etken = String(n.generic).replace(/\s+/g, ' ').trim().split('+').map((x) => kucult(x.trim())).join(' + ');
    yer = nYer || yer || (n.form === 'Drops' ? DAMLA_YERI[sade(etken)] || '' : '');
    if (yer === 'nose' && n.form === 'Drops' && !nKisa) nKisa = 'Nasal Drops';
    kisa = nKisa || kisa;
    let doz = dozYaz(n.strength, n.unit);
    if (['Inhaler', 'Nasal Spray'].includes(n.form) && n.unit === 'mcg') doz += '/dose';
    const marka = String(n.brand || '').trim();
    let ad;
    if (marka) {
      ad = marka + (nitelik && nYer ? ` ${nitelik}` : '');   // 'Daktarin oral gel' ≠ 'Daktarin' kremi
    } else {
      ad = etken + (nitelik ? ` ${nitelik}` : '');
      if (!nitelik) {
        if (yer === 'eye' && form === 'damla') ad += ' eye drops';
        if (yer === 'ear') ad += ' ear drops';
        if (yer === 'nose') ad += form === 'sprey' ? ' nasal spray' : ' nasal drops';
        if (yer === 'mouth') ad += ' mouthwash';
      }
      if (AD_DUZELT[n.generic]) ad = AD_DUZELT[n.generic];
    }
    if (yer === 'vagina') form = 'fitil';                    // vajinal tablet → شیاف, kâğıtta 'Vag Tab'
    const grup = grupBul(etken, form, kisa, yer);
    if (!grup) throw new Error(`grubu bulunamadı: ${etken} (${im}) — GRUP tablosuna ekle`);
    const ek = etkenKanon(etken);
    const topikal = ['krem', 'damla', 'sprey', 'diger'].includes(form) || ['Powder', 'Vag Tab'].includes(kisa);
    let otc = (OTC.has(ek) && (!OTC_TOPIKAL.has(ek) || topikal)) || grup === 'vitamin';
    if (grup === 'vitamin' && form === 'ampul') otc = false;  // iğne asla reçetesiz değil
    const r = { ad, etkenMadde: etken, form, doz, marka: marka ? 1 : undefined, kisa: kisa || undefined, grup, receteli: !otc, sik: n.frequent ? 1 : undefined };

    if (elle.has(im)) {
      kullanilan.add(im); sayac.elle++;
      const j = out.findIndex((x) => x.hid === elle.get(im));
      if (j === -1) throw new Error(`elle birleştirmenin hedefi yok: ${elle.get(im)}`);
      rapor.push(`MERGE(elle) ${im} → ${out[j].hid} ${out[j].ad} ${out[j].doz}`);
      if (n.frequent) out[j] = sirala({ ...out[j], sik: 1 });
      continue;
    }
    const k = anahtarKur(marka, ad, etken, doz, form, yer, kisa || 'Oint');
    if (anahtar.has(k)) {
      const j = anahtar.get(k);
      sayac.ayni++;
      rapor.push(`MERGE ${im} → ${out[j].hid} ${out[j].ad} ${out[j].doz}`);
      if (n.frequent) out[j] = sirala({ ...out[j], sik: 1 });
      continue;
    }
    // Anahtarı farklı ama ad|doz|form'u aynı: aynı markanın kremi ile merhemi.
    if (tekilAd.has(ilacAnahtari(r)) && SEKIL_SOZU[n.form]) {
      rapor.push(`RENAME ${im}: ${r.ad} → ${r.ad} ${SEKIL_SOZU[n.form]} (ad|doz|form çakışması)`);
      r.ad = `${r.ad} ${SEKIL_SOZU[n.form]}`;
    }
    if (tekilAd.has(ilacAnahtari(r))) {
      sayac.ad_carpisti++;
      rapor.push(`MERGE(ad|doz|form) ${im} → ${out[tekilAd.get(ilacAnahtari(r))].hid}`);
      continue;
    }
    r.hid = `h${String(++enBuyuk).padStart(4, '0')}`;
    const i = out.push(sirala(r)) - 1;
    sayac.eklendi++;
    dizinle(k, i);
    tekilAd.set(ilacAnahtari(r), i);
  }
  const kullanilmayan = [...atilanlar.keys(), ...elle.keys()].filter((im) => !kullanilan.has(im));
  if (kullanilmayan.length) throw new Error('kaynakta bulunamayan elle kurallar (kaynak değişmiş): ' + kullanilmayan.join(' ; '));

  const belge = {
    surum: 3,
    aciklama: ACIKLAMA,
    gruplar: GRUPLAR.map(([anahtar, ad, en]) => ({ anahtar, ad, en })),
    ilaclar: out,
  };
  const hatalar = listeyiDenetle(belge);
  if (hatalar.length) throw new Error('üretilen liste geçersiz:\n' + hatalar.join('\n'));
  rapor.unshift(`toplam ${out.length} (önceki ${onceki.ilaclar.length}); ${JSON.stringify(sayac)}`);
  return { belge, rapor };
}

/**
 * Üretilen (ya da gönderilen) listenin değişmezleri. Hem üretim sonunda hem
 * `npm run kontrol`'de çalışıyor: vitest olmadan da liste ilaç başına
 * kullanım taşıyamasın.
 * @returns {string[]} hata cümleleri
 */
export function listeyiDenetle(belge) {
  const h = [];
  const formlar = new Set(FORMLAR.map(([k]) => k));
  const gruplar = new Set((belge.gruplar || []).map((x) => x.anahtar));
  const hidler = new Set();
  const adlar = new Set();
  for (const r of belge.ilaclar || []) {
    const kim = `${r.hid || '?'} ${r.ad}`;
    const fazla = Object.keys(r).filter((k) => !IZINLI_ALANLAR.includes(k));
    if (fazla.length) h.push(`${kim}: izinsiz alan ${fazla.join(', ')} (liste ilaç başına kullanım/doz/süre taşımaz)`);
    if (!/^h\d{4}$/.test(r.hid || '')) h.push(`${kim}: hid biçimi`);
    if (hidler.has(r.hid)) h.push(`${kim}: hid tekrarı`);
    hidler.add(r.hid);
    if (adlar.has(ilacAnahtari(r))) h.push(`${kim}: ad|doz|form tekrarı`);
    adlar.add(ilacAnahtari(r));
    if (!formlar.has(r.form)) h.push(`${kim}: şekil ${r.form}`);
    if (!gruplar.has(r.grup)) h.push(`${kim}: grup ${r.grup}`);
    if (r.kisa !== undefined && !KISALAR.includes(r.kisa)) h.push(`${kim}: kisa ${r.kisa}`);
    if (r.marka !== undefined && r.marka !== 1) h.push(`${kim}: marka yalnız 1`);
    if (typeof r.doz !== 'string' || /\b[1-9]\d{0,2}\.\d{3}\b/.test(r.doz) || /%\d/.test(r.doz)) h.push(`${kim}: doz yazımı «${r.doz}»`);
  }
  return h;
}

/** Bir ilaç bir satır: fark okunur kalsın (indent'li yazımdan ~%35 küçük). */
export function belgeMetni(belge) {
  const satirli = (dizi) => '[\n' + dizi.map((x) => '  ' + JSON.stringify(x)).join(',\n') + '\n ]';
  return '{\n'
    + ` "surum": ${belge.surum},\n`
    + ` "aciklama": ${JSON.stringify(belge.aciklama)},\n`
    + ` "gruplar": ${satirli(belge.gruplar)},\n`
    + ` "ilaclar": ${satirli(belge.ilaclar)}\n}\n`;
}

/** nuskha dosyasından depoya konan kopyayı kurar: yalnız ad alanları. */
export function kaynakKopyasi(nuskha, not) {
  return {
    kaynak: not,
    drugs: nuskha.drugs.map((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !YASAK_KAYNAK.includes(k)))),
  };
}

async function calistir(argv) {
  const arg = (ad) => { const i = argv.indexOf(ad); return i === -1 ? null : argv[i + 1]; };
  const nuskhaYolu = arg('--nuskha');
  let kaynak;
  if (nuskhaYolu) {
    const ham = JSON.parse(await readFile(nuskhaYolu, 'utf8'));
    kaynak = kaynakKopyasi(ham, `github.com/Ferhat-Yasinoglu/nuskha data/drugs.json (sürüm ${ham.version}); `
      + `ayıklanan alanlar: ${YASAK_KAYNAK.join(', ')} — ilaç başına hazır kullanım Shafa'ya alınmaz. `
      + 'Yeniden üretmek: node tools/ilac-uret.mjs --nuskha <drugs.json> --kaynak-yaz');
    if (argv.includes('--kaynak-yaz')) {
      await writeFile(KAYNAK_YOLU, belgeMetniKaynak(kaynak));
      console.log('kaynak kopyası yazıldı:', KAYNAK_YOLU.pathname);
    }
  } else {
    kaynak = JSON.parse(await readFile(KAYNAK_YOLU, 'utf8'));
  }
  const onceki = JSON.parse(await readFile(LISTE_YOLU, 'utf8'));
  const { belge, rapor } = ilacListesiUret(onceki, kaynak.drugs);
  console.log(rapor.join('\n'));
  const metin = belgeMetni(belge);
  const eski = await readFile(LISTE_YOLU, 'utf8');
  if (metin === eski) { console.log('liste değişmedi'); return; }
  if (argv.includes('--yaz')) {
    await writeFile(LISTE_YOLU, metin);
    console.log('yazıldı:', LISTE_YOLU.pathname);
  } else {
    console.log('liste değişecek; yazmak için --yaz');
  }
}

const belgeMetniKaynak = (k) => '{\n'
  + ` "kaynak": ${JSON.stringify(k.kaynak)},\n`
  + ' "drugs": [\n' + k.drugs.map((d) => '  ' + JSON.stringify(d)).join(',\n') + '\n ]\n}\n';

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  calistir(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exit(1); });
}
