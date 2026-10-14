(function (g) {
  'use strict';

  var LEVELS = [
    { v: -2, t: 'Much worse' },
    { v: -1, t: 'Slightly worse' },
    { v: 0, t: 'Same' },
    { v: 1, t: 'Slightly better' },
    { v: 2, t: 'Much better' }
  ];

  var M = function (label, hint) { return { label: label, hint: hint }; };

  var PROFILES = {
    underarm: { e: 4, W: 12,
      measures: [M('Underarm tone', 'Better = more even and lighter'), M('Skin comfort', 'Better = less dryness or irritation'), M('Freshness through the day', 'Better = stays fresh for longer')],
      why: 'Underarm tone depends on how quickly the top layer of skin renews and how much pigment it holds. The surface renews roughly every four to six weeks, and a visible change usually takes a few of those cycles.',
      phases: { settle: 'Fragrance, texture and comfort show up first. Tone rarely changes yet.', signs: 'Some people see a slightly more even tone in good light. Many do not yet, and that is normal.', verdict: 'If tone is unchanged after regular use, it is fair to ask whether this product suits you.' } },
    hairgrow: { e: 8, W: 16,
      measures: [M('Thin spots and hair density', 'Better = thin spots look fuller'), M('Hair fall level', 'Better = less hair in the wash and on the brush'), M('Scalp feel', 'Better = less sticky or oily after use')],
      why: 'Hair grows about a centimetre a month, and each strand spends months in its growth phase. New growth has to get long enough to see, so scalp coverage changes slowly. Most routines need three to four months before a fair look.',
      phases: { settle: 'Scalp feel and the application routine settle first. New hair is not visible yet.', signs: 'Less hair fall can come before more hair. Thin spots change last.', verdict: 'Compare photos in the same light. If thin spots look the same after regular use, it is fair to ask whether this suits you.' } },
    hairgummy: { e: 8, W: 16,
      measures: [M('Hair density and thickness', 'Better = fuller, thicker hair'), M('Hair fall level', 'Better = less hair in the wash and on the brush'), M('Nails and skin', 'Better = stronger nails, clearer skin')],
      why: 'Supplements work from the inside, and hair only shows new growth after months because each strand grows about a centimetre a month. Most people judge hair supplements after three to four months of daily use.',
      phases: { settle: 'Little changes visibly yet. Take them daily and note any stomach upset.', signs: 'Less shedding can come first. Nails sometimes change before hair.', verdict: 'If hair fall and density look the same after steady daily use, it is fair to ask whether this suits you.' } },
    shampoo: { e: 2, W: 8,
      measures: [M('Hair fall in the wash', 'Better = fewer strands'), M('Scalp feel', 'Better = clean, not dry or itchy'), M('Softness and frizz', 'Better = softer, easier to comb')],
      why: 'Shampoo and conditioner change how hair feels from the first washes. Reducing hair fall takes longer because it follows the hair growth cycle, which runs in months.',
      phases: { settle: 'Softness and scalp feel change first. Hair fall changes slowly.', signs: 'Some people see slightly less hair fall in the wash.', verdict: 'If hair fall is unchanged after regular washes, it is fair to ask whether this suits you, or whether something else is causing it.' } },
    dandruff: { e: 1, W: 4,
      measures: [M('Flakes', 'Better = fewer visible flakes'), M('Scalp itch', 'Better = less itching'), M('Scalp comfort', 'Better = less dryness or oiliness')],
      why: 'Dandruff is linked to yeast on the scalp and oil build-up. Medicated products usually need a few weeks of regular use, and flakes can return if you stop.',
      phases: { settle: 'Itch often eases first. Flakes can take a couple of weeks.', signs: 'Flakes should be reducing. Use it as directed on the pack.', verdict: 'If flakes and itch are unchanged after four weeks of regular use, consider asking a pharmacist or doctor.' } },
    bodywash: { e: 2, W: 6,
      measures: [M('Bumps and roughness', 'Better = smoother, fewer bumps'), M('Skin moisture after the shower', 'Better = less tight or dry'), M('Skin softness', 'Better = softer to the touch')],
      why: 'An exfoliating product smooths the surface over a few weeks. Bumps need steady use across a couple of skin renewal cycles, while dryness can show up within days.',
      phases: { settle: 'Skin can feel smoother or drier quite quickly. Bumps change slowly.', signs: 'Rough patches and bumps start to soften for some people. Watch for dryness.', verdict: 'If bumps are unchanged, or skin stays dry, this may not be the right fit.' } },
    bodyacne: { e: 2, W: 8,
      measures: [M('Body breakouts', 'Better = fewer new pimples'), M('Redness and marks', 'Better = calmer skin'), M('Skin dryness', 'Better = less tight or dry')],
      why: 'Body acne follows the skin renewal cycle. Pimples form over weeks, so most routines need about two months of steady use before a fair judgement. Active ingredients can dry the skin, so watch comfort.',
      phases: { settle: 'Dryness can show up before clearer skin does.', signs: 'Fewer new breakouts can appear. Old marks fade later.', verdict: 'If breakouts are the same after regular use, it is fair to ask a pharmacist or dermatologist.' } },
    moisture: { e: 1, W: 4,
      measures: [M('Dryness and roughness', 'Better = smoother, less dry'), M('Skin softness', 'Better = softer to the touch'), M('Comfort', 'Better = no stinging or itching')],
      why: 'Moisturising products work on the surface. Skin often feels better within days, while very rough areas such as heels and elbows need a few weeks of daily use.',
      phases: { settle: 'Skin usually feels softer within days.', signs: 'Rough patches begin to smooth out with daily use.', verdict: 'If dryness is unchanged after daily use, it is fair to ask whether this suits you.' } },
    stretch: { e: 8, W: 16,
      measures: [M('Look of the marks', 'Better = fainter, flatter marks'), M('Itch and tightness', 'Better = less itch or tightness'), M('Skin firmness', 'Better = skin feels firmer')],
      why: 'Stretch marks are changes in the deeper skin layers, so they fade slowly and not always fully. Newer, redder marks respond more than older, paler ones. A fair look needs three to four months of daily use.',
      phases: { settle: 'Itch and dryness may ease first. The marks look the same.', signs: 'Newer marks can start to look slightly less red.', verdict: 'Compare photos in the same light. Older marks may change little, which is common.' } },
    pigment: { e: 4, W: 12,
      measures: [M('Dark patches', 'Better = lighter and more even'), M('Skin comfort', 'Better = less dryness or irritation'), M('Skin texture', 'Better = smoother')],
      why: 'Pigmentation fades as pigmented skin cells are shed and replaced, which takes several skin cycles. Sun can darken patches again, so daily sun protection matters.',
      phases: { settle: 'Texture and comfort change first. Patches look the same.', signs: 'Some people see patches softening in good light.', verdict: 'If patches are unchanged after regular use with sun protection, it is fair to ask a dermatologist.' } },
    sun: { e: 1, W: 4,
      measures: [M('Tan and burn protection', 'Better = less tan or redness after sun'), M('How it feels on skin', 'Better = not sticky, greasy or white'), M('Comfort', 'Better = no stinging or breakouts')],
      why: 'Sunscreen protects from the first use if you apply enough and reapply when outdoors. You judge it by how skin looks and feels after sun. A tan fades over weeks, so de-tan products need a few weeks of regular use.',
      phases: { settle: 'Check the feel first: texture, white cast and any stinging.', signs: 'Notice whether you tan or redden less after similar time outdoors.', verdict: 'If you still burn or tan quickly with correct use, ask a pharmacist or dermatologist about a better fit.' } },
    magnesium: { e: 2, W: 6,
      measures: [M('Sleep quality', 'Better = fall asleep easier, wake less'), M('Stress and tension', 'Better = feel calmer, less tight'), M('Energy through the day', 'Better = fewer slumps')],
      why: 'Supplements build up in the body, so effects on sleep and stress appear over weeks. They vary a lot between people.',
      phases: { settle: 'Some people feel a little different early. Many notice nothing for a couple of weeks.', signs: 'Sleep or tension may start to ease.', verdict: 'If nothing has changed after regular use, it is fair to ask whether it suits you. Check with a doctor if you take medicines or have a health condition.' } },
    multivit: { e: 4, W: 8,
      measures: [M('Energy through the day', 'Better = fewer slumps'), M('How you feel overall', 'Better = more well'), M('Stomach comfort', 'Better = no nausea or discomfort')],
      why: 'A multivitamin mainly fills gaps in your diet. If you had a gap, energy can improve over weeks. If you did not, you may notice little.',
      phases: { settle: 'Take it at the same time daily. Stomach comfort shows up first.', signs: 'Some people notice steadier energy.', verdict: 'If you notice no change after regular use, your diet may already cover it. A doctor can check for specific gaps.' } },
    acv: { e: 2, W: 8,
      measures: [M('Digestion and bloating', 'Better = less bloating'), M('Appetite and cravings', 'Better = steadier appetite'), M('Stomach comfort', 'Better = no acidity or discomfort')],
      why: 'Effects on digestion build with regular use and depend on your diet. Gummies alone are not a weight loss plan.',
      phases: { settle: 'Notice stomach comfort first.', signs: 'Some people feel less bloated.', verdict: 'If you notice no change, or you get acidity, it may not suit you. Ask a pharmacist or doctor.' } },
    other: { e: 3, W: 10,
      measures: [M('Main result you want', 'Better = closer to what you hoped for'), M('Comfort', 'Better = no dryness or irritation'), M('How it feels to use', 'Better = you enjoy using it')],
      why: 'Different products work on different timelines. As a general guide, a fair judgement often needs several weeks of regular use. Check your pack for directions.',
      phases: { settle: 'Comfort and feel show up first.', signs: 'Some people start to see the result they wanted.', verdict: 'If nothing has changed after regular use, it is fair to ask whether it suits you.' } }
  };

  var CATALOG = [
    { cat: 'Hair care', items: [
      ['biotin', 'Biotin Hair Gummies', 'hairgummy'], ['ppgummy', 'Hair Gummies for Post-Pregnancy Hair Fall', 'hairgummy'],
      ['ahgs', 'Advanced Hair Growth Serum', 'hairgrow'], ['ahgpack', 'Advanced Hair Growth Pack with Roll On', 'hairgrow'],
      ['folli', 'Folli Advanced+ Hair Growth Serum Roll On', 'hairgrow'], ['hgspray', 'Hair Growth Serum Spray', 'hairgrow'],
      ['strengthen', 'Hair Strengthening Serum', 'hairgrow'], ['hgpack', 'Hair Growth Pack', 'hairgrow'], ['massager', 'Scalp Massager (used with serums)', 'hairgrow'],
      ['kshampoo', 'Keratin Shampoo for Hair Fall', 'shampoo'], ['kcond', 'Keratin Conditioner', 'shampoo'], ['cleankit', 'Hair Cleansing and Conditioning Kit', 'shampoo'],
      ['ketoshampoo', '1% Ketoconazole Dandruff Shampoo', 'dandruff'], ['zptoshampoo', '1% ZPTO Anti-Dandruff Shampoo', 'dandruff'],
      ['dserum', 'Anti-Dandruff Serum', 'dandruff'], ['dandkit', 'Dandruff & Hairfall Kit', 'dandruff'] ] },
    { cat: 'Underarm and pigmentation', items: [
      ['ur4', '4% AHA BHA Underarm Roll On', 'underarm'], ['ur6', '6% AHA BHA Underarm Roll On (Flora)', 'underarm'],
      ['urkit', 'Underarm Pigmentation Kit', 'underarm'], ['pigcream', 'Pigmentation Repair Cream', 'pigment'] ] },
    { cat: 'Body wash, scrubs and acne', items: [
      ['sa1wash', '1% Salicylic Acid Body Wash', 'bodywash'], ['sacerwash', '1% Salicylic Ceramide Body Wash', 'bodywash'],
      ['ahabhawash', '5% AHA BHA Exfoliating Body Wash', 'bodywash'], ['aha2wash', '2% AHA Body Wash', 'bodywash'],
      ['nia5wash', '5% Niacinamide Body Wash', 'bodywash'], ['hyawash', 'Hyaluronic Acid Body Wash Mousse', 'bodywash'],
      ['balm', 'Salicylic Acid Cleansing Balm', 'bodywash'], ['scrub', '10% AHA Body Scrub', 'bodywash'],
      ['strawkit', 'Strawberry Skin Exfoliation Kit', 'bodywash'], ['bodypack', 'AHA-BHA Body Pack', 'bodywash'],
      ['bpwash', '2.5% Benzoyl Peroxide Body Wash', 'bodyacne'], ['acnespray', '3% AHA BHA Body Acne Spray', 'bodyacne'], ['acnepack', 'Body Acne Pack', 'bodyacne'] ] },
    { cat: 'Lotions and body care', items: [
      ['urea10', '10% Urea Body Lotion', 'moisture'], ['urea20', '20% Urea Lotion', 'moisture'], ['mag10', '10% Magnesium Body Lotion', 'moisture'],
      ['nia10', '10% Niacinamide Body Lotion', 'moisture'], ['lactic5', '5% Lactic Acid Body Lotion', 'moisture'], ['footroll', '20% Urea Foot Roll On', 'moisture'],
      ['stretch', 'Anti-Stretch Mark Serum Roll On', 'stretch'] ] },
    { cat: 'Sun protection', items: [
      ['detan', 'De-Tan SPF 50+ Body Sunscreen Lotion', 'sun'], ['sunlotion', 'Body Sunscreen Lotion with SPF 50', 'sun'], ['sunspray', 'Body Sunscreen Spray with SPF 50', 'sun'],
      ['sunlight', 'Ultra Light Sunscreen SPF50', 'sun'], ['sunduo', 'Sun Care Duo for Face and Body', 'sun'] ] },
    { cat: 'Nutrition gummies', items: [
      ['magnesium', 'Magnesium Glycinate Gummies', 'magnesium'], ['multivit', 'Multivitamin Gummies', 'multivit'], ['acvgummy', 'Apple Cider Vinegar Gummies', 'acv'] ] },
    { cat: 'Something else', items: [ ['other', 'Other Be Bodywise product', 'other'] ] }
  ];

  var PRODUCTS = {};
  CATALOG.forEach(function (grp) {
    grp.items.forEach(function (it) {
      var p = PROFILES[it[2]];
      PRODUCTS[it[0]] = { id: it[0], name: it[1], cat: grp.cat, e: p.e, W: p.W, measures: p.measures, why: p.why, phases: p.phases };
    });
  });

  [['roll', 'Underarm roll-on', 'underarm'], ['serum', 'Hair growth serum', 'hairgrow'], ['wash', 'Exfoliating body wash', 'bodywash']].forEach(function (x) {
    var p = PROFILES[x[2]];
    PRODUCTS[x[0]] = { id: x[0], name: x[1], cat: 'Earlier version', legacy: true, e: p.e, W: p.W, measures: p.measures, why: p.why, phases: p.phases };
  });

  g.SG_CATALOG = { LEVELS: LEVELS, PROFILES: PROFILES, CATALOG: CATALOG, PRODUCTS: PRODUCTS };
})(typeof window !== 'undefined' ? window : globalThis);