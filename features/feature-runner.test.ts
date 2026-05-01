import { loadFeatures, runFeatures } from "@questi0nm4rk/feats";
import "./steps/common.steps.ts";

const features = await loadFeatures("features/**/*.feature", {
  cwd: process.cwd(),
});

runFeatures(features);
