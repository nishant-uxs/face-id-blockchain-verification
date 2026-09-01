#!/usr/bin/env node
import { Command } from "commander";
import { requireAuditConfig, requireVerifyConfig } from "../config/env.js";
import { runVerificationPipeline } from "../pipeline/orchestrator.js";
import { auditVerification } from "../audit/verifier.js";
import { ConfigError, NoMatchError, PipelineError } from "../utils/errors.js";
import { redactSecrets } from "../utils/redact.js";
import { BRAND } from "../config/brand.js";
import {
  createStepLogger,
  printAuditReport,
  printAuditSuccessBanner,
  printEvidenceScore,
  printBanner,
  printFailureBanner,
  printNoMatchBanner,
  printPipelineErrorBanner,
  printSuccessBanner,
} from "./ui.js";
import chalk from "chalk";

const program = new Command();

program
  .name("hh-goa-verify")
  .description("HH Goa 2026 Task #3 — Face ID + Blockchain Verification Engine")
  .version("1.0.0");

program
  .command("verify")
  .description("Run the full verification pipeline")
  .argument("<image>", "Path to input image")
  .option("-o, --output <path>", "Output verification JSON path", "artifacts/verification.json")
  .action(async (image: string, options: { output: string }) => {
    printBanner();
    try {
      const config = requireVerifyConfig();
      const logger = createStepLogger(8);
      const { record, outputPath } = await runVerificationPipeline(
        image,
        config,
        options.output,
        logger
      );

      printEvidenceScore(record.evidence.scoreBreakdown, record.evidence.evidenceScore);

      const explorerUrl = `${BRAND.chain.explorer}/tx/${record.blockchain.transactionHash}`;
      console.log(chalk.hex(BRAND.colors.muted)(`\nArtifact: ${outputPath}`));
      console.log(chalk.hex(BRAND.colors.muted)(`Explorer: ${explorerUrl}`));
      console.log(
        chalk.hex(BRAND.colors.muted)(
          `IPFS: https://${config.pinataGateway}/ipfs/${record.storage.ipfsCid}`
        )
      );
      console.log(
        chalk.hex(BRAND.colors.muted)(
          `Evidence: ${record.evidence.pageClassification} — ${record.evidence.selectedMatchUrl}`
        )
      );

      printSuccessBanner(explorerUrl);
      process.exit(0);
    } catch (err) {
      if (err instanceof NoMatchError) {
        printNoMatchBanner();
        console.log(chalk.hex(BRAND.colors.muted)(`\n${err.message}`));
        process.exit(2);
      }
      if (err instanceof ConfigError) {
        printPipelineErrorBanner(err.code, redactSecrets(err.message));
        process.exit(1);
      }
      if (err instanceof PipelineError) {
        printPipelineErrorBanner(err.code, redactSecrets(err.message));
        process.exit(1);
      }
      printPipelineErrorBanner("UNEXPECTED", redactSecrets(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  });

program
  .command("audit")
  .description("Independently verify a previous verification record")
  .argument("<record>", "Path to verification JSON")
  .option("-i, --image <path>", "Input image for SHA-256 cross-check")
  .action(async (record: string, options: { image?: string }) => {
    try {
      const config = requireAuditConfig();
      const result = await auditVerification(record, config, options.image);
      printAuditReport(result.checks);

      if (result.valid) {
        printAuditSuccessBanner();
        process.exit(0);
      } else {
        printFailureBanner("VERIFICATION FAILED");
        if (result.failureReason) {
          console.log(chalk.hex(BRAND.colors.muted)(`\nReason: ${result.failureReason}`));
        }
        process.exit(1);
      }
    } catch (err) {
      printFailureBanner("VERIFICATION FAILED");
      console.log(chalk.hex(BRAND.colors.muted)(redactSecrets(err instanceof Error ? err.message : String(err))));
      process.exit(1);
    }
  });

program.parse();
