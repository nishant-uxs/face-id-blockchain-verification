import chalk from "chalk";
import boxen from "boxen";
import { BRAND } from "../config/brand.js";
import type { AuditCheck, AuditSection } from "../audit/verifier.js";

export function printBanner(): void {
  const title = chalk.hex(BRAND.colors.green).bold(`${BRAND.name} // ${BRAND.subtitle}`);
  const tagline = chalk.hex(BRAND.colors.pink)(BRAND.tagline);
  console.log(
    boxen(`${title}\n${tagline}`, {
      padding: 1,
      borderColor: "#0B6839",
      borderStyle: "round",
      backgroundColor: "#0A1F14",
      title: chalk.hex(BRAND.colors.yellow)("✦"),
      titleAlignment: "center",
    })
  );
}

export function printAuditBanner(): void {
  console.log(
    boxen(chalk.hex(BRAND.colors.cream).bold("HH GOA // AUDIT REPORT"), {
      padding: 1,
      borderColor: "#0B6839",
      borderStyle: "round",
      backgroundColor: "#0A1F14",
    })
  );
}

export function printSuccessBanner(explorerUrl?: string): void {
  const lines = [chalk.hex(BRAND.colors.green).bold("VERIFIED ✓")];
  if (explorerUrl) {
    lines.push(chalk.hex(BRAND.colors.muted)(explorerUrl));
  }
  console.log(
    boxen(lines.join("\n"), {
      padding: 1,
      borderColor: "#FEE101",
      borderStyle: "round",
      backgroundColor: "#0A1F14",
    })
  );
}

export function printAuditSuccessBanner(): void {
  console.log(
    boxen(
      [
        chalk.hex(BRAND.colors.green).bold("✓ VERIFICATION VALID"),
        chalk.hex(BRAND.colors.muted)("Evidence integrity confirmed on-chain"),
      ].join("\n"),
      {
        padding: 1,
        borderColor: "#FEE101",
        borderStyle: "round",
        backgroundColor: "#0A1F14",
      }
    )
  );
}

export function printFailureBanner(message: string): void {
  console.log(
    boxen(chalk.hex(BRAND.colors.pink).bold(message), {
      padding: 1,
      borderColor: "#FF0080",
      borderStyle: "round",
      backgroundColor: "#0A1F14",
    })
  );
}

export function printNoMatchBanner(): void {
  printFailureBanner("NO VERIFIED MATCH FOUND");
}

export function printPipelineErrorBanner(code: string, message: string): void {
  printFailureBanner(`PIPELINE ERROR [${code}]\n${message}`);
}

export function createStepLogger(totalSteps: number) {
  return {
    onStep(step: number, _total: number, message: string) {
      const prefix = chalk.hex(BRAND.colors.yellow)(`[${step}/${totalSteps}]`);
      const label = chalk.hex(BRAND.colors.cream).bold(message);
      console.log(`\n${prefix} ${label}`);
    },
    onDetail(message: string) {
      console.log(chalk.hex(BRAND.colors.muted)(`      ✓ ${message}`));
    },
  };
}

export function printEvidenceScore(components: Array<{ label: string; points: number }>, total: number): void {
  console.log(chalk.hex(BRAND.colors.cream).bold("\nEvidence score:"));
  for (const c of components) {
    console.log(chalk.hex(BRAND.colors.muted)(`  ${c.label.padEnd(28)} +${c.points}`));
  }
  console.log(chalk.hex(BRAND.colors.yellow)(`  ${"─".repeat(30)}`));
  console.log(chalk.hex(BRAND.colors.green).bold(`  Total${" ".repeat(23)}${total}`));
}

const SECTION_ORDER: AuditSection[] = ["INPUT IMAGE", "EVIDENCE", "BLOCKCHAIN", "RESULT"];

export function printAuditReport(checks: AuditCheck[]): void {
  printAuditBanner();
  console.log();

  for (const section of SECTION_ORDER) {
    const sectionChecks = checks.filter((c) => c.section === section);
    if (sectionChecks.length === 0) continue;

    console.log(chalk.hex(BRAND.colors.yellow).bold(section));
    for (const check of sectionChecks) {
      const icon = check.skipped
        ? chalk.hex(BRAND.colors.muted)("–")
        : check.passed
          ? chalk.green("✓")
          : chalk.red("✗");
      console.log(`  ${icon} ${check.name}: ${chalk.hex(BRAND.colors.muted)(check.detail)}`);
    }
    console.log();
  }
}
