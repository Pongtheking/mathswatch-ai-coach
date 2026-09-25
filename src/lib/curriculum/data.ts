import type { SkillDef, TopicDef } from "@/lib/curriculum/types";

export const TOPICS: TopicDef[] = [
  { id: "number", name: "Number", category: "Number", description: "Integers through surds, bounds and standard form." },
  { id: "algebra", name: "Algebra", category: "Algebra", description: "The language of GCSE Maths — and the Grade 9 bottleneck." },
  { id: "ratio", name: "Ratio, proportion and rates", category: "Ratio", description: "Ratio, proportion, compound measures, growth and decay." },
  { id: "geometry", name: "Geometry", category: "Geometry", description: "Shape, space, Pythagoras, trigonometry and vectors." },
  { id: "probability", name: "Probability", category: "Probability", description: "From basic chance to conditional probability." },
  { id: "statistics", name: "Statistics", category: "Statistics", description: "Averages, charts and statistical diagrams." },
  { id: "graphs", name: "Graphs", category: "Graphs", description: "Linear, quadratic and real-life graphs." },
];

const S = (
  partial: Omit<SkillDef, "related" | "mistakes" | "prereq"> & {
    prereq?: string[];
    related?: string[];
    mistakes?: string[];
  },
): SkillDef => ({
  prereq: [],
  related: [],
  mistakes: [],
  ...partial,
});

export const SKILLS: SkillDef[] = [
  S({ id: "num.integers", name: "Integers", category: "Number", subtopic: "Integers", topicId: "number", tier: "foundation", difficulty: 2, relevance: 8, gradeMin: 1, gradeMax: 4, examFreq: 7, mistakes: ["Sign errors with negatives"] }),
  S({ id: "num.negatives", name: "Negative numbers", category: "Number", subtopic: "Integers", topicId: "number", tier: "foundation", difficulty: 3, relevance: 8, gradeMin: 2, gradeMax: 5, examFreq: 8, prereq: ["num.integers"], mistakes: ["Minus a negative", "Directed number on a number line"] }),
  S({ id: "num.prime-factors", name: "Prime factors", category: "Number", subtopic: "Factors", topicId: "number", tier: "foundation", difficulty: 4, relevance: 7, gradeMin: 3, gradeMax: 5, examFreq: 6, prereq: ["num.integers"], mistakes: ["Missing a prime", "Product of primes notation"] }),
  S({ id: "num.hcf-lcm", name: "HCF and LCM", category: "Number", subtopic: "Factors", topicId: "number", tier: "foundation", difficulty: 4, relevance: 7, gradeMin: 3, gradeMax: 6, examFreq: 6, prereq: ["num.prime-factors"], related: ["num.fractions"] }),
  S({ id: "num.fractions", name: "Fractions", category: "Number", subtopic: "Fractions", topicId: "number", tier: "both", difficulty: 4, relevance: 10, gradeMin: 3, gradeMax: 7, examFreq: 10, prereq: ["num.integers"], mistakes: ["Adding denominators", "Not using a common denominator", "Dividing by flipping the wrong fraction"] }),
  S({ id: "num.decimals", name: "Decimals", category: "Number", subtopic: "Decimals", topicId: "number", tier: "foundation", difficulty: 3, relevance: 8, gradeMin: 2, gradeMax: 5, examFreq: 7, related: ["num.fractions"] }),
  S({ id: "num.percentages", name: "Percentages", category: "Number", subtopic: "Percentages", topicId: "number", tier: "both", difficulty: 4, relevance: 10, gradeMin: 3, gradeMax: 7, examFreq: 10, prereq: ["num.fractions", "num.decimals"], mistakes: ["Percentage of vs percentage change", "Multiplier errors"] }),
  S({ id: "num.ratio", name: "Ratio", category: "Number", subtopic: "Ratio", topicId: "number", tier: "both", difficulty: 5, relevance: 9, gradeMin: 4, gradeMax: 7, examFreq: 9, prereq: ["num.fractions"], mistakes: ["Sharing in a ratio without summing parts", "Ratio vs fraction mix-up"] }),
  S({ id: "num.standard-form", name: "Standard form", category: "Number", subtopic: "Standard form", topicId: "number", tier: "both", difficulty: 5, relevance: 8, gradeMin: 4, gradeMax: 7, examFreq: 8, prereq: ["num.indices"], mistakes: ["Index arithmetic", "Not writing A × 10^n with 1 ≤ A < 10"] }),
  S({ id: "num.indices", name: "Indices", category: "Number", subtopic: "Indices", topicId: "number", tier: "both", difficulty: 5, relevance: 9, gradeMin: 4, gradeMax: 8, examFreq: 9, prereq: ["num.integers"], mistakes: ["Adding instead of multiplying powers", "Negative and fractional indices"] }),
  S({ id: "num.surds", name: "Surds", category: "Number", subtopic: "Surds", topicId: "number", tier: "higher", difficulty: 7, relevance: 8, gradeMin: 6, gradeMax: 9, examFreq: 7, prereq: ["num.indices"], mistakes: ["Not rationalising the denominator", "√(a+b) treated as √a+√b"] }),
  S({ id: "num.bounds", name: "Bounds", category: "Number", subtopic: "Bounds", topicId: "number", tier: "higher", difficulty: 7, relevance: 8, gradeMin: 6, gradeMax: 9, examFreq: 7, prereq: ["num.decimals"], mistakes: ["Upper/lower bound swapped in division", "Truncation vs rounding"] }),
  S({ id: "num.recurring-decimals", name: "Recurring decimals", category: "Number", subtopic: "Decimals", topicId: "number", tier: "higher", difficulty: 6, relevance: 6, gradeMin: 6, gradeMax: 8, examFreq: 5, prereq: ["num.fractions"], mistakes: ["Algebraic conversion slips"] }),

  S({ id: "alg.simplifying", name: "Simplifying expressions", category: "Algebra", subtopic: "Simplifying", topicId: "algebra", tier: "foundation", difficulty: 3, relevance: 10, gradeMin: 3, gradeMax: 6, examFreq: 9, mistakes: ["Collecting unlike terms"] }),
  S({ id: "alg.expanding", name: "Expanding brackets", category: "Algebra", subtopic: "Expanding", topicId: "algebra", tier: "both", difficulty: 4, relevance: 10, gradeMin: 4, gradeMax: 7, examFreq: 10, prereq: ["alg.simplifying"], mistakes: ["Missing the second term when expanding", "Sign errors"] }),
  S({ id: "alg.factorising-linear", name: "Factorising linear", category: "Algebra", subtopic: "Factorising", topicId: "algebra", tier: "foundation", difficulty: 4, relevance: 8, gradeMin: 4, gradeMax: 6, examFreq: 8, prereq: ["alg.expanding"] }),
  S({ id: "alg.factorising-quadratic", name: "Factorising quadratics", category: "Algebra", subtopic: "Factorising", topicId: "algebra", tier: "both", difficulty: 6, relevance: 10, gradeMin: 5, gradeMax: 8, examFreq: 10, prereq: ["alg.factorising-linear", "alg.expanding"], mistakes: ["Wrong factor pair", "Sign of constant term"] }),
  S({ id: "alg.rearranging", name: "Rearranging formulae", category: "Algebra", subtopic: "Rearranging", topicId: "algebra", tier: "both", difficulty: 5, relevance: 9, gradeMin: 4, gradeMax: 8, examFreq: 8, prereq: ["alg.solving-linear"], mistakes: ["Adding instead of subtracting", "Not doing the same to both sides"] }),
  S({ id: "alg.solving-linear", name: "Solving linear equations", category: "Algebra", subtopic: "Equations", topicId: "algebra", tier: "foundation", difficulty: 4, relevance: 10, gradeMin: 3, gradeMax: 6, examFreq: 10, prereq: ["alg.simplifying"], mistakes: ["Sign errors when moving terms", "Dividing only one side"] }),
  S({ id: "alg.solving-quadratic", name: "Solving quadratics", category: "Algebra", subtopic: "Quadratics", topicId: "algebra", tier: "both", difficulty: 6, relevance: 10, gradeMin: 5, gradeMax: 8, examFreq: 10, prereq: ["alg.factorising-quadratic"], related: ["alg.quadratic-formula", "alg.completing-square"] }),
  S({ id: "alg.quadratic-formula", name: "Quadratic formula", category: "Algebra", subtopic: "Quadratics", topicId: "algebra", tier: "higher", difficulty: 7, relevance: 9, gradeMin: 6, gradeMax: 9, examFreq: 8, prereq: ["alg.solving-quadratic"], mistakes: ["b² − 4ac arithmetic", "Sign of b"] }),
  S({ id: "alg.completing-square", name: "Completing the square", category: "Algebra", subtopic: "Quadratics", topicId: "algebra", tier: "higher", difficulty: 7, relevance: 9, gradeMin: 6, gradeMax: 9, examFreq: 8, prereq: ["alg.solving-quadratic"], mistakes: ["Halving b incorrectly", "Forgetting to adjust the constant"] }),
  S({ id: "alg.simultaneous", name: "Simultaneous equations", category: "Algebra", subtopic: "Equations", topicId: "algebra", tier: "both", difficulty: 6, relevance: 9, gradeMin: 5, gradeMax: 8, examFreq: 8, prereq: ["alg.solving-linear"], mistakes: ["Elimination of the wrong variable", "Substitution slips"] }),
  S({ id: "alg.inequalities", name: "Inequalities", category: "Algebra", subtopic: "Inequalities", topicId: "algebra", tier: "both", difficulty: 5, relevance: 8, gradeMin: 4, gradeMax: 8, examFreq: 8, prereq: ["alg.solving-linear"], mistakes: ["Not reversing the inequality when multiplying by a negative"] }),
  S({ id: "alg.sequences", name: "Sequences", category: "Algebra", subtopic: "Sequences", topicId: "algebra", tier: "both", difficulty: 5, relevance: 8, gradeMin: 4, gradeMax: 7, examFreq: 8 }),
  S({ id: "alg.nth-term-linear", name: "Linear nth term", category: "Algebra", subtopic: "Sequences", topicId: "algebra", tier: "foundation", difficulty: 5, relevance: 8, gradeMin: 4, gradeMax: 6, examFreq: 8, prereq: ["alg.sequences"] }),
  S({ id: "alg.nth-term-quadratic", name: "Quadratic nth term", category: "Algebra", subtopic: "Sequences", topicId: "algebra", tier: "higher", difficulty: 7, relevance: 7, gradeMin: 7, gradeMax: 9, examFreq: 6, prereq: ["alg.nth-term-linear"] }),
  S({ id: "alg.algebraic-fractions", name: "Algebraic fractions", category: "Algebra", subtopic: "Fractions", topicId: "algebra", tier: "higher", difficulty: 8, relevance: 8, gradeMin: 7, gradeMax: 9, examFreq: 7, prereq: ["alg.factorising-quadratic", "num.fractions"], mistakes: ["Cancelling terms not factors", "Common denominator errors"] }),
  S({ id: "alg.functions", name: "Functions", category: "Algebra", subtopic: "Functions", topicId: "algebra", tier: "higher", difficulty: 7, relevance: 8, gradeMin: 6, gradeMax: 9, examFreq: 7, prereq: ["alg.rearranging"], mistakes: ["Composite order fg vs gf", "Inverse domain"] }),
  S({ id: "alg.iteration", name: "Iteration", category: "Algebra", subtopic: "Iteration", topicId: "algebra", tier: "higher", difficulty: 7, relevance: 7, gradeMin: 7, gradeMax: 9, examFreq: 6, prereq: ["alg.rearranging"], mistakes: ["Using the previous x incorrectly", "Rounding too early"] }),
  S({ id: "alg.proof", name: "Algebraic proof", category: "Algebra", subtopic: "Proof", topicId: "algebra", tier: "higher", difficulty: 8, relevance: 9, gradeMin: 7, gradeMax: 9, examFreq: 7, prereq: ["alg.expanding", "alg.factorising-quadratic"], mistakes: ["Not starting from a general even/odd form", "Stopping before a conclusion"] }),

  S({ id: "rat.ratio", name: "Ratio problems", category: "Ratio", subtopic: "Ratio", topicId: "ratio", tier: "both", difficulty: 5, relevance: 9, gradeMin: 4, gradeMax: 7, examFreq: 9, prereq: ["num.ratio"] }),
  S({ id: "rat.direct-proportion", name: "Direct proportion", category: "Ratio", subtopic: "Proportion", topicId: "ratio", tier: "both", difficulty: 5, relevance: 8, gradeMin: 4, gradeMax: 7, examFreq: 7, prereq: ["num.ratio"] }),
  S({ id: "rat.inverse-proportion", name: "Inverse proportion", category: "Ratio", subtopic: "Proportion", topicId: "ratio", tier: "higher", difficulty: 6, relevance: 7, gradeMin: 6, gradeMax: 8, examFreq: 6, prereq: ["rat.direct-proportion"] }),
  S({ id: "rat.best-buys", name: "Best buys", category: "Ratio", subtopic: "Proportion", topicId: "ratio", tier: "foundation", difficulty: 4, relevance: 6, gradeMin: 3, gradeMax: 5, examFreq: 5, prereq: ["num.percentages"] }),
  S({ id: "rat.speed", name: "Speed", category: "Ratio", subtopic: "Compound measures", topicId: "ratio", tier: "both", difficulty: 5, relevance: 8, gradeMin: 4, gradeMax: 7, examFreq: 8, mistakes: ["Not converting hours/minutes", "Distance = speed / time"] }),
  S({ id: "rat.density", name: "Density", category: "Ratio", subtopic: "Compound measures", topicId: "ratio", tier: "both", difficulty: 5, relevance: 7, gradeMin: 5, gradeMax: 7, examFreq: 6, related: ["rat.speed"] }),
  S({ id: "rat.pressure", name: "Pressure", category: "Ratio", subtopic: "Compound measures", topicId: "ratio", tier: "both", difficulty: 5, relevance: 6, gradeMin: 5, gradeMax: 7, examFreq: 5 }),
  S({ id: "rat.compound-measures", name: "Compound measures", category: "Ratio", subtopic: "Compound measures", topicId: "ratio", tier: "both", difficulty: 5, relevance: 7, gradeMin: 4, gradeMax: 7, examFreq: 6 }),
  S({ id: "rat.growth-decay", name: "Growth and decay", category: "Ratio", subtopic: "Percentages", topicId: "ratio", tier: "higher", difficulty: 6, relevance: 8, gradeMin: 5, gradeMax: 8, examFreq: 7, prereq: ["num.percentages"], mistakes: ["Simple vs compound interest", "Wrong multiplier"] }),

  S({ id: "geo.angles", name: "Angles", category: "Geometry", subtopic: "Angles", topicId: "geometry", tier: "foundation", difficulty: 3, relevance: 8, gradeMin: 2, gradeMax: 5, examFreq: 8, mistakes: ["Parallel line reasons missing"] }),
  S({ id: "geo.polygons", name: "Polygons", category: "Geometry", subtopic: "Polygons", topicId: "geometry", tier: "foundation", difficulty: 4, relevance: 7, gradeMin: 4, gradeMax: 6, examFreq: 6, prereq: ["geo.angles"] }),
  S({ id: "geo.constructions", name: "Constructions", category: "Geometry", subtopic: "Constructions", topicId: "geometry", tier: "foundation", difficulty: 4, relevance: 5, gradeMin: 4, gradeMax: 6, examFreq: 4 }),
  S({ id: "geo.transformations", name: "Transformations", category: "Geometry", subtopic: "Transformations", topicId: "geometry", tier: "both", difficulty: 5, relevance: 7, gradeMin: 4, gradeMax: 7, examFreq: 7, mistakes: ["Vector of translation", "Centre of enlargement"] }),
  S({ id: "geo.congruence", name: "Congruence", category: "Geometry", subtopic: "Congruence", topicId: "geometry", tier: "both", difficulty: 6, relevance: 6, gradeMin: 5, gradeMax: 7, examFreq: 5 }),
  S({ id: "geo.similarity", name: "Similarity", category: "Geometry", subtopic: "Similarity", topicId: "geometry", tier: "higher", difficulty: 6, relevance: 8, gradeMin: 5, gradeMax: 8, examFreq: 7, prereq: ["geo.congruence"], mistakes: ["Length vs area vs volume scale factors"] }),
  S({ id: "geo.circle-theorems", name: "Circle theorems", category: "Geometry", subtopic: "Circles", topicId: "geometry", tier: "higher", difficulty: 8, relevance: 9, gradeMin: 7, gradeMax: 9, examFreq: 8, prereq: ["geo.angles"], mistakes: ["Wrong theorem named", "Missing reasons"] }),
  S({ id: "geo.bearings", name: "Bearings", category: "Geometry", subtopic: "Bearings", topicId: "geometry", tier: "both", difficulty: 5, relevance: 6, gradeMin: 4, gradeMax: 7, examFreq: 5, prereq: ["geo.angles"], mistakes: ["Not measuring from North clockwise"] }),
  S({ id: "geo.pythagoras", name: "Pythagoras", category: "Geometry", subtopic: "Pythagoras", topicId: "geometry", tier: "both", difficulty: 5, relevance: 9, gradeMin: 4, gradeMax: 7, examFreq: 9, mistakes: ["Using Pythagoras on a non-right triangle", "Finding a leg vs hypotenuse"] }),
  S({ id: "geo.trig-right", name: "Right-angled trigonometry", category: "Geometry", subtopic: "Trigonometry", topicId: "geometry", tier: "both", difficulty: 6, relevance: 10, gradeMin: 5, gradeMax: 8, examFreq: 10, prereq: ["geo.pythagoras"], mistakes: ["SOHCAHTOA mix-up", "Degree/radian mode"] }),
  S({ id: "geo.trig-sine-cosine", name: "Sine and cosine rules", category: "Geometry", subtopic: "Trigonometry", topicId: "geometry", tier: "higher", difficulty: 8, relevance: 9, gradeMin: 7, gradeMax: 9, examFreq: 8, prereq: ["geo.trig-right"], mistakes: ["Ambiguous case of the sine rule", "Cosine rule rearrangement"] }),
  S({ id: "geo.area", name: "Area", category: "Geometry", subtopic: "Area", topicId: "geometry", tier: "foundation", difficulty: 4, relevance: 8, gradeMin: 3, gradeMax: 6, examFreq: 8 }),
  S({ id: "geo.volume", name: "Volume", category: "Geometry", subtopic: "Volume", topicId: "geometry", tier: "both", difficulty: 5, relevance: 8, gradeMin: 4, gradeMax: 7, examFreq: 8, prereq: ["geo.area"] }),
  S({ id: "geo.surface-area", name: "Surface area", category: "Geometry", subtopic: "Surface area", topicId: "geometry", tier: "both", difficulty: 5, relevance: 7, gradeMin: 4, gradeMax: 7, examFreq: 6, prereq: ["geo.area"] }),
  S({ id: "geo.vectors", name: "Vectors", category: "Geometry", subtopic: "Vectors", topicId: "geometry", tier: "higher", difficulty: 8, relevance: 9, gradeMin: 7, gradeMax: 9, examFreq: 8, prereq: ["alg.simplifying"], mistakes: ["Column vector arithmetic", "Magnitude vs direction", "Proof with vectors"] }),
  S({ id: "geo.3d-trig", name: "3D Pythagoras and trigonometry", category: "Geometry", subtopic: "Trigonometry", topicId: "geometry", tier: "higher", difficulty: 8, relevance: 7, gradeMin: 7, gradeMax: 9, examFreq: 6, prereq: ["geo.pythagoras", "geo.trig-right"] }),

  S({ id: "pro.basic", name: "Basic probability", category: "Probability", subtopic: "Probability", topicId: "probability", tier: "foundation", difficulty: 3, relevance: 8, gradeMin: 3, gradeMax: 5, examFreq: 8 }),
  S({ id: "pro.sample-spaces", name: "Sample spaces", category: "Probability", subtopic: "Probability", topicId: "probability", tier: "foundation", difficulty: 4, relevance: 7, gradeMin: 4, gradeMax: 6, examFreq: 6, prereq: ["pro.basic"] }),
  S({ id: "pro.tree-diagrams", name: "Tree diagrams", category: "Probability", subtopic: "Probability", topicId: "probability", tier: "both", difficulty: 6, relevance: 8, gradeMin: 5, gradeMax: 8, examFreq: 8, prereq: ["pro.basic"], mistakes: ["Adding along a branch", "With/without replacement"] }),
  S({ id: "pro.conditional", name: "Conditional probability", category: "Probability", subtopic: "Probability", topicId: "probability", tier: "higher", difficulty: 8, relevance: 9, gradeMin: 7, gradeMax: 9, examFreq: 7, prereq: ["pro.tree-diagrams"], mistakes: ["P(A|B) vs P(A and B)", "Not restricting the sample space"] }),
  S({ id: "pro.venn", name: "Venn diagrams", category: "Probability", subtopic: "Probability", topicId: "probability", tier: "both", difficulty: 6, relevance: 7, gradeMin: 5, gradeMax: 8, examFreq: 6, prereq: ["pro.basic"] }),

  S({ id: "sta.averages", name: "Averages", category: "Statistics", subtopic: "Averages", topicId: "statistics", tier: "foundation", difficulty: 3, relevance: 8, gradeMin: 2, gradeMax: 5, examFreq: 8, mistakes: ["Mean vs median vs mode"] }),
  S({ id: "sta.frequency-tables", name: "Frequency tables", category: "Statistics", subtopic: "Tables", topicId: "statistics", tier: "foundation", difficulty: 4, relevance: 8, gradeMin: 4, gradeMax: 6, examFreq: 8, prereq: ["sta.averages"] }),
  S({ id: "sta.grouped-data", name: "Grouped data", category: "Statistics", subtopic: "Tables", topicId: "statistics", tier: "both", difficulty: 5, relevance: 7, gradeMin: 5, gradeMax: 7, examFreq: 7, prereq: ["sta.frequency-tables"] }),
  S({ id: "sta.histograms", name: "Histograms", category: "Statistics", subtopic: "Charts", topicId: "statistics", tier: "higher", difficulty: 7, relevance: 7, gradeMin: 6, gradeMax: 8, examFreq: 6, prereq: ["sta.grouped-data"], mistakes: ["Frequency vs frequency density"] }),
  S({ id: "sta.cumulative-frequency", name: "Cumulative frequency", category: "Statistics", subtopic: "Charts", topicId: "statistics", tier: "higher", difficulty: 6, relevance: 7, gradeMin: 6, gradeMax: 8, examFreq: 6, prereq: ["sta.grouped-data"] }),
  S({ id: "sta.box-plots", name: "Box plots", category: "Statistics", subtopic: "Charts", topicId: "statistics", tier: "both", difficulty: 5, relevance: 7, gradeMin: 5, gradeMax: 7, examFreq: 6, prereq: ["sta.averages"] }),
  S({ id: "sta.scatter", name: "Scatter graphs", category: "Statistics", subtopic: "Charts", topicId: "statistics", tier: "foundation", difficulty: 4, relevance: 7, gradeMin: 4, gradeMax: 6, examFreq: 6 }),
  S({ id: "sta.sampling", name: "Sampling", category: "Statistics", subtopic: "Sampling", topicId: "statistics", tier: "both", difficulty: 5, relevance: 5, gradeMin: 5, gradeMax: 7, examFreq: 4 }),

  S({ id: "gra.linear", name: "Linear graphs", category: "Graphs", subtopic: "Linear", topicId: "graphs", tier: "foundation", difficulty: 4, relevance: 9, gradeMin: 4, gradeMax: 6, examFreq: 9, prereq: ["alg.solving-linear"], mistakes: ["Gradient from a graph", "y = mx + c intercept"] }),
  S({ id: "gra.quadratic", name: "Quadratic graphs", category: "Graphs", subtopic: "Quadratic", topicId: "graphs", tier: "both", difficulty: 6, relevance: 8, gradeMin: 5, gradeMax: 8, examFreq: 8, prereq: ["alg.solving-quadratic"] }),
  S({ id: "gra.cubic", name: "Cubic graphs", category: "Graphs", subtopic: "Polynomial", topicId: "graphs", tier: "higher", difficulty: 6, relevance: 6, gradeMin: 6, gradeMax: 8, examFreq: 5 }),
  S({ id: "gra.reciprocal", name: "Reciprocal graphs", category: "Graphs", subtopic: "Polynomial", topicId: "graphs", tier: "higher", difficulty: 6, relevance: 6, gradeMin: 6, gradeMax: 8, examFreq: 5 }),
  S({ id: "gra.transformations", name: "Transformations of graphs", category: "Graphs", subtopic: "Transformations", topicId: "graphs", tier: "higher", difficulty: 7, relevance: 7, gradeMin: 7, gradeMax: 9, examFreq: 6, prereq: ["gra.quadratic"], mistakes: ["f(x+a) direction", "Stretch vs translation"] }),
  S({ id: "gra.real-life", name: "Real-life graphs", category: "Graphs", subtopic: "Applied", topicId: "graphs", tier: "foundation", difficulty: 4, relevance: 6, gradeMin: 3, gradeMax: 6, examFreq: 6 }),

  S({ id: "num.order-ops", name: "Order of operations", category: "Number", subtopic: "Integers", topicId: "number", tier: "foundation", difficulty: 2, relevance: 8, gradeMin: 1, gradeMax: 4, examFreq: 7, mistakes: ["Ignoring BIDMAS"] }),
  S({ id: "num.rounding", name: "Rounding and significant figures", category: "Number", subtopic: "Decimals", topicId: "number", tier: "foundation", difficulty: 3, relevance: 8, gradeMin: 2, gradeMax: 5, examFreq: 8, prereq: ["num.decimals"], mistakes: ["Decimal places vs significant figures"] }),
  S({ id: "num.estimation", name: "Estimation", category: "Number", subtopic: "Decimals", topicId: "number", tier: "foundation", difficulty: 4, relevance: 7, gradeMin: 3, gradeMax: 6, examFreq: 6, prereq: ["num.rounding"] }),
  S({ id: "num.fdp", name: "FDP conversion", category: "Number", subtopic: "Percentages", topicId: "number", tier: "foundation", difficulty: 3, relevance: 9, gradeMin: 2, gradeMax: 5, examFreq: 8, prereq: ["num.fractions", "num.decimals", "num.percentages"] }),
  S({ id: "num.fraction-of-amount", name: "Fraction of an amount", category: "Number", subtopic: "Fractions", topicId: "number", tier: "foundation", difficulty: 3, relevance: 8, gradeMin: 2, gradeMax: 5, examFreq: 8, prereq: ["num.fractions"] }),
  S({ id: "num.reverse-percentages", name: "Reverse percentages", category: "Number", subtopic: "Percentages", topicId: "number", tier: "both", difficulty: 6, relevance: 9, gradeMin: 5, gradeMax: 8, examFreq: 8, prereq: ["num.percentages"], mistakes: ["Finding 10% of the new amount"] }),
  S({ id: "num.error-intervals", name: "Error intervals", category: "Number", subtopic: "Bounds", topicId: "number", tier: "higher", difficulty: 6, relevance: 7, gradeMin: 6, gradeMax: 8, examFreq: 6, prereq: ["num.rounding", "num.bounds"] }),
  S({ id: "num.product-rule", name: "Product rule for counting", category: "Number", subtopic: "Counting", topicId: "number", tier: "higher", difficulty: 6, relevance: 6, gradeMin: 6, gradeMax: 8, examFreq: 5 }),

  S({ id: "alg.expanding-double", name: "Expanding two brackets", category: "Algebra", subtopic: "Expanding", topicId: "algebra", tier: "both", difficulty: 5, relevance: 9, gradeMin: 4, gradeMax: 7, examFreq: 9, prereq: ["alg.expanding"], mistakes: ["Missing the last term", "Sign of negatives"] }),
  S({ id: "alg.equation-of-line", name: "Equation of a straight line", category: "Algebra", subtopic: "Graphs", topicId: "algebra", tier: "both", difficulty: 5, relevance: 9, gradeMin: 4, gradeMax: 7, examFreq: 9, prereq: ["gra.linear"], related: ["alg.parallel-perpendicular"] }),
  S({ id: "alg.parallel-perpendicular", name: "Parallel and perpendicular lines", category: "Algebra", subtopic: "Graphs", topicId: "algebra", tier: "higher", difficulty: 6, relevance: 8, gradeMin: 6, gradeMax: 8, examFreq: 7, prereq: ["alg.equation-of-line"], mistakes: ["Perpendicular as negative, not negative reciprocal"] }),
  S({ id: "alg.linear-quadratic-sim", name: "Linear and quadratic simultaneous", category: "Algebra", subtopic: "Equations", topicId: "algebra", tier: "higher", difficulty: 7, relevance: 8, gradeMin: 7, gradeMax: 9, examFreq: 7, prereq: ["alg.simultaneous", "alg.solving-quadratic"] }),
  S({ id: "alg.quadratic-inequalities", name: "Quadratic inequalities", category: "Algebra", subtopic: "Inequalities", topicId: "algebra", tier: "higher", difficulty: 7, relevance: 8, gradeMin: 7, gradeMax: 9, examFreq: 6, prereq: ["alg.inequalities", "alg.solving-quadratic"], mistakes: ["Sketch missing", "Wrong inequality region"] }),
  S({ id: "alg.identities", name: "Identities", category: "Algebra", subtopic: "Proof", topicId: "algebra", tier: "higher", difficulty: 6, relevance: 7, gradeMin: 6, gradeMax: 8, examFreq: 5, prereq: ["alg.expanding-double"] }),

  S({ id: "rat.recipes", name: "Recipes and proportion", category: "Ratio", subtopic: "Proportion", topicId: "ratio", tier: "foundation", difficulty: 4, relevance: 7, gradeMin: 3, gradeMax: 5, examFreq: 6, prereq: ["rat.direct-proportion"] }),
  S({ id: "rat.currency", name: "Currency conversion", category: "Ratio", subtopic: "Proportion", topicId: "ratio", tier: "foundation", difficulty: 4, relevance: 6, gradeMin: 3, gradeMax: 5, examFreq: 5, prereq: ["rat.direct-proportion"] }),
  S({ id: "rat.scale-drawings", name: "Scale drawings", category: "Ratio", subtopic: "Scale", topicId: "ratio", tier: "both", difficulty: 5, relevance: 6, gradeMin: 4, gradeMax: 6, examFreq: 5, prereq: ["num.ratio"] }),

  S({ id: "geo.circles", name: "Circumference and area of a circle", category: "Geometry", subtopic: "Circles", topicId: "geometry", tier: "foundation", difficulty: 4, relevance: 9, gradeMin: 4, gradeMax: 6, examFreq: 9, prereq: ["geo.area"], mistakes: ["Using diameter as radius", "πr vs πr²"] }),
  S({ id: "geo.sectors", name: "Sectors, arcs and segments", category: "Geometry", subtopic: "Circles", topicId: "geometry", tier: "higher", difficulty: 6, relevance: 8, gradeMin: 5, gradeMax: 8, examFreq: 7, prereq: ["geo.circles"], mistakes: ["Angle/360 missing", "Arc vs sector"] }),
  S({ id: "geo.triangle-area-trig", name: "Area of a triangle (½ab sin C)", category: "Geometry", subtopic: "Trigonometry", topicId: "geometry", tier: "higher", difficulty: 6, relevance: 8, gradeMin: 6, gradeMax: 8, examFreq: 7, prereq: ["geo.trig-right"] }),
  S({ id: "geo.exact-trig", name: "Exact trigonometric values", category: "Geometry", subtopic: "Trigonometry", topicId: "geometry", tier: "higher", difficulty: 6, relevance: 8, gradeMin: 6, gradeMax: 8, examFreq: 7, prereq: ["geo.trig-right"], mistakes: ["sin 60 and sin 30 swapped"] }),
  S({ id: "geo.similar-area-volume", name: "Similar areas and volumes", category: "Geometry", subtopic: "Similarity", topicId: "geometry", tier: "higher", difficulty: 7, relevance: 8, gradeMin: 7, gradeMax: 9, examFreq: 6, prereq: ["geo.similarity"], mistakes: ["Using length scale for volume"] }),
  S({ id: "geo.cones-spheres", name: "Cones, pyramids and spheres", category: "Geometry", subtopic: "Volume", topicId: "geometry", tier: "higher", difficulty: 6, relevance: 7, gradeMin: 6, gradeMax: 8, examFreq: 6, prereq: ["geo.volume"] }),
  S({ id: "geo.loci", name: "Loci", category: "Geometry", subtopic: "Constructions", topicId: "geometry", tier: "both", difficulty: 5, relevance: 5, gradeMin: 5, gradeMax: 7, examFreq: 4, prereq: ["geo.constructions"] }),
  S({ id: "geo.plans-elevations", name: "Plans and elevations", category: "Geometry", subtopic: "3D", topicId: "geometry", tier: "foundation", difficulty: 4, relevance: 5, gradeMin: 4, gradeMax: 6, examFreq: 4 }),

  S({ id: "pro.frequency-trees", name: "Frequency trees", category: "Probability", subtopic: "Probability", topicId: "probability", tier: "foundation", difficulty: 4, relevance: 7, gradeMin: 4, gradeMax: 6, examFreq: 6, prereq: ["pro.basic"] }),
  S({ id: "pro.relative-frequency", name: "Relative frequency", category: "Probability", subtopic: "Probability", topicId: "probability", tier: "foundation", difficulty: 4, relevance: 7, gradeMin: 4, gradeMax: 6, examFreq: 6, prereq: ["pro.basic"] }),
  S({ id: "pro.independent", name: "Independent events", category: "Probability", subtopic: "Probability", topicId: "probability", tier: "both", difficulty: 5, relevance: 8, gradeMin: 5, gradeMax: 7, examFreq: 7, prereq: ["pro.basic"], mistakes: ["Adding instead of multiplying independent events"] }),

  S({ id: "sta.pie-charts", name: "Pie charts", category: "Statistics", subtopic: "Charts", topicId: "statistics", tier: "foundation", difficulty: 4, relevance: 6, gradeMin: 3, gradeMax: 5, examFreq: 5, prereq: ["sta.averages"] }),
  S({ id: "sta.capture-recapture", name: "Capture-recapture", category: "Statistics", subtopic: "Sampling", topicId: "statistics", tier: "higher", difficulty: 6, relevance: 6, gradeMin: 6, gradeMax: 8, examFreq: 5, prereq: ["sta.sampling"] }),
  S({ id: "sta.stratified", name: "Stratified sampling", category: "Statistics", subtopic: "Sampling", topicId: "statistics", tier: "both", difficulty: 5, relevance: 6, gradeMin: 5, gradeMax: 7, examFreq: 5, prereq: ["sta.sampling"] }),

  S({ id: "gra.trig-graphs", name: "Trigonometric graphs", category: "Graphs", subtopic: "Trig", topicId: "graphs", tier: "higher", difficulty: 7, relevance: 8, gradeMin: 7, gradeMax: 9, examFreq: 6, prereq: ["geo.trig-right"] }),
  S({ id: "gra.exponential", name: "Exponential graphs", category: "Graphs", subtopic: "Exponential", topicId: "graphs", tier: "higher", difficulty: 7, relevance: 7, gradeMin: 7, gradeMax: 9, examFreq: 5 }),
  S({ id: "gra.area-under", name: "Area under a graph", category: "Graphs", subtopic: "Applied", topicId: "graphs", tier: "higher", difficulty: 6, relevance: 7, gradeMin: 6, gradeMax: 8, examFreq: 6, prereq: ["gra.real-life"] }),
  S({ id: "gra.velocity-time", name: "Velocity-time graphs", category: "Graphs", subtopic: "Applied", topicId: "graphs", tier: "both", difficulty: 6, relevance: 8, gradeMin: 5, gradeMax: 8, examFreq: 7, prereq: ["gra.real-life"], mistakes: ["Reading distance from height instead of area"] }),
  S({ id: "gra.solving-graphically", name: "Solving equations graphically", category: "Graphs", subtopic: "Applied", topicId: "graphs", tier: "both", difficulty: 6, relevance: 7, gradeMin: 5, gradeMax: 8, examFreq: 6, prereq: ["gra.quadratic"] }),
];

export const SKILL_BY_ID = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
