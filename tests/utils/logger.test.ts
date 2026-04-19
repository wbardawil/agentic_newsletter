import { describe, it, expect, vi } from "vitest";
import { createLogger } from "../../src/utils/logger.js";

describe("createLogger", () => {
  it("creates a logger with all methods", () => {
    const logger = createLogger("info");
    expect(logger.debug).toBeTypeOf("function");
    expect(logger.info).toBeTypeOf("function");
    expect(logger.warn).toBeTypeOf("function");
    expect(logger.error).toBeTypeOf("function");
    expect(logger.child).toBeTypeOf("function");
  });

  it("writes JSON to stdout for info level", () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const logger = createLogger("info");

    logger.info("test message", { runId: "abc" });

    expect(writeSpy).toHaveBeenCalledOnce();
    const output = JSON.parse(writeSpy.mock.calls[0]![0] as string);
    expect(output.level).toBe("info");
    expect(output.message).toBe("test message");
    expect(output.runId).toBe("abc");
    expect(output.timestamp).toBeDefined();

    writeSpy.mockRestore();
  });

  it("writes to stderr for error level", () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const logger = createLogger("debug");

    logger.error("oops");

    expect(stderrSpy).toHaveBeenCalledOnce();
    stderrSpy.mockRestore();
  });

  it("filters messages below configured level", () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const logger = createLogger("warn");

    logger.debug("should not appear");
    logger.info("should not appear");

    expect(writeSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it("child logger merges context", () => {
    const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const logger = createLogger("info");
    const child = logger.child({ agentName: "radar" });

    child.info("scanning");

    const output = JSON.parse(writeSpy.mock.calls[0]![0] as string);
    expect(output.agentName).toBe("radar");
    expect(output.message).toBe("scanning");

    writeSpy.mockRestore();
  });
});
