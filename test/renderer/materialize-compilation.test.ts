import assert from "node:assert/strict";
import test from "node:test";

import { compileCandidateProjectConfig } from "../../src/compiler/compile-candidate.js";
import type { CandidateCompilation } from "../../src/compiler/private-model.js";
import {
  materializeCompilation,
  validatePrivateRendererSourceMaterialization,
} from "../../src/renderer/materialize-compilation.js";
import { renderRequestFromMaterialization } from "../../src/renderer/from-compilation.js";
import {
  balancedCandidateConfig,
  fastCandidateConfig,
  reorderedBalancedCandidateConfig,
} from "../fixtures/config/specimens.js";
import { initialCompilerOptions } from "../fixtures/compiler/capabilities.js";

function compile(input: unknown): CandidateCompilation {
  const result = compileCandidateProjectConfig(input, initialCompilerOptions);
  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected candidate compilation to succeed.");
  }
  return result.compilation;
}

test("materializes deterministic advisory project instructions", () => {
  const compilation = compile(balancedCandidateConfig);
  const materialization = materializeCompilation(compilation);

  assert.equal(materialization.revision, 1);
  assert.equal(materialization.files.length, 1);
  assert.equal(
    materialization.files[0]?.path,
    "project-instructions/development-flow.md",
  );
  assert.match(
    materialization.files[0]?.content ?? "",
    /Project instructions are advisory and do not mechanically authorize transitions/u,
  );
  assert.match(
    materialization.files[0]?.content ?? "",
    /Move from `reconcile` to `implement`/u,
  );
  assert.doesNotMatch(
    materialization.files[0]?.content ?? "",
    /Compiler digest|Capability evidence|candidate-config/u,
  );
  assert.equal(
    materialization.files[0]?.contentDigest,
    "ba17b89e57423ced99d5dda357e83b48bc4f208ed68272508c401b73839e04ff",
  );
  assert.equal(
    materialization.digest,
    "25f907fa0e8c7b6ae5094aba4573c0c2fd5b61f7b42fef18924a36db0465990e",
  );
  validatePrivateRendererSourceMaterialization(materialization);
});

test("keeps materialization stable for reorder-equivalent candidate intent", () => {
  const first = materializeCompilation(compile(balancedCandidateConfig));
  const second = materializeCompilation(
    compile(reorderedBalancedCandidateConfig),
  );

  assert.deepEqual(second, first);
});

test("keeps Fast and Balanced materializations distinct", () => {
  const fast = materializeCompilation(compile(fastCandidateConfig));
  const balanced = materializeCompilation(compile(balancedCandidateConfig));

  assert.notEqual(fast.digest, balanced.digest);
  assert.doesNotMatch(fast.files[0]?.content ?? "", /reconcile/u);
  assert.match(balanced.files[0]?.content ?? "", /reconcile/u);
});

test("derives a render request from verified materialization", () => {
  const compilation = compile(balancedCandidateConfig);
  const materialization = materializeCompilation(compilation);
  const request = renderRequestFromMaterialization(
    compilation,
    materialization,
  );

  assert.deepEqual(request.sourceFiles, [
    "project-instructions/development-flow.md",
  ]);
  assert.equal(
    request.inputDigest,
    "974fc2bef7d4dc80fc9c491df0fee4aada49d921d1570730f77cb733983dcca2",
  );
  assert.equal(request.sourceDigest, materialization.digest);
});

test("rejects unsafe or corrupted materialization", () => {
  const compilation = compile(balancedCandidateConfig);
  const materialization = materializeCompilation(compilation);
  const unsafeCompilation: CandidateCompilation = {
    ...compilation,
    policyValidation: {
      safe: false,
      exploredStates: 1,
      violations: [],
    },
  };
  assert.throws(
    () => materializeCompilation(unsafeCompilation),
    /Refusing to materialize an unsafe compilation/u,
  );

  assert.throws(
    () =>
      validatePrivateRendererSourceMaterialization({
        ...materialization,
        files: materialization.files.map((file) => ({
          ...file,
          content: `${file.content}\ncorrupted\n`,
        })),
      }),
    /content digest does not match/u,
  );

  const fastCompilation = compile(fastCandidateConfig);
  assert.throws(
    () =>
      renderRequestFromMaterialization(
        fastCompilation,
        materialization,
      ),
    /belongs to a different compilation/u,
  );
});
