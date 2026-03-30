import { loadFeatures, runFeatures } from "@questi0nm4rk/feats";
import "./steps/build.steps.ts";
import "./steps/list.steps.ts";
import "./steps/resolve.steps.ts";
import "./steps/validate.steps.ts";

const features = await loadFeatures("features/**/*.feature", {
  cwd: process.cwd(),
});

runFeatures(features);
