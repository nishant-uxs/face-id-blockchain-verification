export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable = false
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

/** Reverse search ran but no acceptable evidence was found — NOT a system failure. */
export class NoMatchError extends PipelineError {
  constructor(message = "NO VERIFIED MATCH FOUND") {
    super(message, "NO_MATCH", false);
    this.name = "NoMatchError";
  }
}

/** Configuration, API, network, or infrastructure failure. */
export class ConfigError extends PipelineError {
  constructor(message: string, code = "CONFIG_ERROR") {
    super(message, code, false);
    this.name = "ConfigError";
  }
}

export class AuditError extends Error {
  constructor(
    message: string,
    public readonly reason: string
  ) {
    super(message);
    this.name = "AuditError";
  }
}
