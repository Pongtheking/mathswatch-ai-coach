import { SKILL_BY_ID, SKILLS } from "@/lib/curriculum/data";

export type VideoChannel = "1st Class Maths" | "Maths Genie" | "YouTube";

export type SkillVideo = {
  title: string;
  channel: VideoChannel;
  youtubeId?: string;
  href: string;
  query: string;
};

const YOUTUBE_SEARCH = "https://www.youtube.com/results?search_query=";

function yt(id: string, title: string, channel: VideoChannel = "1st Class Maths"): SkillVideo {
  return {
    title,
    channel,
    youtubeId: id,
    href: `https://www.youtube.com/watch?v=${id}`,
    query: title,
  };
}

function search(query: string, title = query): SkillVideo {
  return {
    title,
    // Channel-search URLs often fail in an embedded or mobile browser. A
    // normal YouTube GCSE-topic search is robust and returns playable videos
    // for this exact skill when a confirmed direct link is not curated yet.
    channel: "YouTube",
    href: YOUTUBE_SEARCH + encodeURIComponent(`GCSE Maths ${query} walkthrough`),
    query,
  };
}

/**
 * Direct watch URLs are used when a 1st Class Maths (or Maths Genie) video is
 * confirmed. Every other skill opens normal YouTube results narrowed to the
 * exact GCSE topic, rather than a channel page that may not load a video.
 */
const CONFIRMED: Record<string, SkillVideo> = {
  "num.hcf-lcm": yt("kHLwbPwvTtw", "HCF and LCM"),
  "num.percentages": yt("7Jl1BRhXls4", "Percentages of an Amount"),
  "num.reverse-percentages": yt("MzDpBzXqZU8", "Reverse Percentages"),
  "num.standard-form": yt("y-ybXWmmSs8", "Standard Form"),
  "num.surds": yt("I_Mys8RNt30", "Calculating With Surds"),
  "num.bounds": yt("38aztTAQJDs", "Upper and Lower Bounds"),

  "alg.simultaneous": yt("kVhABlRQOGc", "Simultaneous Equations"),
  "alg.quadratic-formula": yt("522V7v8Y1fQ", "The Quadratic Formula"),
  "alg.completing-square": yt("a7WJRrRuSTc", "Completing the Square"),
  "alg.algebraic-fractions": yt("YtHMjuB9f_g", "Algebraic Fractions"),
  "alg.functions": yt("lSRehCwoxs8", "Composite Functions"),

  "rat.growth-decay": yt("JxzhTD50dQg", "Compound Interest"),

  "geo.constructions": yt("3viWgGJmkFo", "Constructions"),
  "geo.transformations": yt("3RlioQo8qwE", "Reflections"),
  "geo.circle-theorems": yt("dBIlCD_JF9Q", "Circle Theorems"),
  "geo.bearings": yt("GdKgyXYlNO8", "Bearings"),
  "geo.trig-right": yt("lRDHqGqRNwg", "Trigonometry (SOHCAHTOA)"),
  "geo.vectors": yt("PxDfkq3FMaw", "Vectors"),
  "geo.3d-trig": yt("99CL-tNyNR0", "3D Trigonometry and Pythagoras"),
  "geo.circles": yt("d3qMfo5EBcU", "Area and Circumference"),
  "geo.exact-trig": yt("WaXSOuFOFsE", "Exact Trig Values"),
  "geo.loci": yt("hyC-dmLk3JA", "Loci"),
  "geo.cones-spheres": yt("JPMiew-11iI", "Volume and Surface Area of Spheres"),

  "pro.tree-diagrams": yt("Z5BX-LbG7mI", "Probability Tree Diagrams"),
  "pro.conditional": yt("nIeMiayWVvw", "Conditional Probability"),
  "pro.venn": yt("WHfef-NghN8", "Sets and Venn Diagrams"),

  "sta.histograms": yt("g7Jnrf0g2tQ", "Drawing Histograms"),
  "sta.cumulative-frequency": yt("PzBE82c1dfY", "Cumulative Frequency Diagrams"),

  "gra.quadratic": yt("qveAZLu2xFA", "Quadratic Graphs"),
  "gra.transformations": yt("ctVr9NpSiL4", "Transformations of Graphs"),
};

const SEARCH_TITLES: Record<string, string> = {
  "num.integers": "Integers",
  "num.negatives": "Negative numbers",
  "num.prime-factors": "Prime factors",
  "num.fractions": "Fractions",
  "num.decimals": "Decimals",
  "num.ratio": "Ratio",
  "num.indices": "Indices",
  "num.recurring-decimals": "Recurring decimals",
  "num.order-ops": "BIDMAS order of operations",
  "num.rounding": "Rounding significant figures",
  "num.estimation": "Estimation",
  "num.fdp": "Fractions decimals percentages",
  "num.fraction-of-amount": "Fraction of an amount",
  "num.error-intervals": "Error intervals",
  "num.product-rule": "Product rule for counting",
  "alg.simplifying": "Simplifying expressions",
  "alg.expanding": "Expanding brackets",
  "alg.expanding-double": "Expanding double brackets",
  "alg.factorising-linear": "Factorising",
  "alg.factorising-quadratic": "Factorising quadratics",
  "alg.rearranging": "Changing the subject",
  "alg.solving-linear": "Solving equations",
  "alg.solving-quadratic": "Solving quadratic equations",
  "alg.inequalities": "Inequalities",
  "alg.sequences": "Sequences",
  "alg.nth-term-linear": "nth term",
  "alg.nth-term-quadratic": "Quadratic nth term",
  "alg.iteration": "Iteration",
  "alg.proof": "Algebraic proof",
  "alg.equation-of-line": "Straight line graphs",
  "alg.parallel-perpendicular": "Parallel and perpendicular lines",
  "alg.linear-quadratic-sim": "Quadratic simultaneous equations",
  "alg.quadratic-inequalities": "Quadratic inequalities",
  "alg.identities": "Identities",
  "rat.ratio": "Ratio problems",
  "rat.direct-proportion": "Direct proportion",
  "rat.inverse-proportion": "Inverse proportion",
  "rat.best-buys": "Best buys",
  "rat.speed": "Speed distance time",
  "rat.density": "Density",
  "rat.pressure": "Pressure",
  "rat.compound-measures": "Compound measures",
  "rat.recipes": "Recipes proportion",
  "rat.currency": "Exchange rates",
  "rat.scale-drawings": "Scale drawings",
  "geo.angles": "Angles in parallel lines",
  "geo.polygons": "Angles in polygons",
  "geo.congruence": "Congruence",
  "geo.similarity": "Similar shapes",
  "geo.pythagoras": "Pythagoras",
  "geo.trig-sine-cosine": "Sine rule cosine rule",
  "geo.area": "Area of shapes",
  "geo.volume": "Volume of prisms",
  "geo.surface-area": "Surface area",
  "geo.sectors": "Sectors and arcs",
  "geo.triangle-area-trig": "Area of a triangle sine",
  "geo.similar-area-volume": "Similar areas volumes",
  "geo.plans-elevations": "Plans and elevations",
  "pro.basic": "Probability scale",
  "pro.sample-spaces": "Sample space diagrams",
  "pro.frequency-trees": "Frequency trees",
  "pro.relative-frequency": "Relative frequency",
  "pro.independent": "Independent events",
  "sta.averages": "Mean median mode",
  "sta.frequency-tables": "Averages from tables",
  "sta.grouped-data": "Averages from grouped data",
  "sta.box-plots": "Box plots",
  "sta.scatter": "Scatter graphs",
  "sta.sampling": "Sampling",
  "sta.pie-charts": "Pie charts",
  "sta.capture-recapture": "Capture recapture",
  "sta.stratified": "Stratified sampling",
  "gra.linear": "Straight line graphs",
  "gra.cubic": "Cubic graphs",
  "gra.reciprocal": "Reciprocal graphs",
  "gra.real-life": "Real life graphs",
  "gra.trig-graphs": "Trig graphs",
  "gra.exponential": "Exponential graphs",
  "gra.area-under": "Area under a graph",
  "gra.velocity-time": "Velocity time graphs",
  "gra.solving-graphically": "Solving equations graphically",
};

export const SKILL_VIDEOS: Record<string, SkillVideo> = { ...CONFIRMED };

for (const skill of SKILLS) {
  if (!SKILL_VIDEOS[skill.id]) {
    const q = SEARCH_TITLES[skill.id] ?? skill.name;
    SKILL_VIDEOS[skill.id] = search(q, skill.name);
  }
}

export function videoForSkill(skillId: string | undefined | null): SkillVideo | null {
  if (!skillId) return null;
  if (SKILL_VIDEOS[skillId]) return SKILL_VIDEOS[skillId];
  const skill = SKILL_BY_ID[skillId];
  if (skill) return search(skill.name);
  return null;
}

const NAME_TO_ID = Object.fromEntries(SKILLS.map((s) => [s.name.toLowerCase(), s.id]));

export function videoForSkillName(name: string | undefined | null): SkillVideo | null {
  if (!name) return null;
  const id = NAME_TO_ID[name.toLowerCase()];
  if (id) return videoForSkill(id);
  return search(name);
}

export function firstVideoForSkills(skillIds: Array<string | undefined | null>): SkillVideo | null {
  for (const id of skillIds) {
    const v = videoForSkill(id);
    if (v) return v;
  }
  return null;
}

export function thumbnailUrl(video: SkillVideo): string | null {
  if (!video.youtubeId) return null;
  return `https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`;
}

export function embedUrl(video: SkillVideo): string | null {
  if (!video.youtubeId) return null;
  return `https://www.youtube-nocookie.com/embed/${video.youtubeId}?rel=0&modestbranding=1&playsinline=1`;
}
