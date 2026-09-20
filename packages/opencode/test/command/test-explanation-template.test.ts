import { describe, expect, test } from "bun:test"
import { Command } from "../../src/command"
import TEST_EXPLANATION from "../../src/command/template/test-explanation.txt"

describe("test explanation template", () => {
  test("takes the tests to explain through $ARGUMENTS", () => {
    expect(Command.hints(TEST_EXPLANATION)).toEqual(["$ARGUMENTS"])
  })

  test("asks for the overall purpose and why the test matters", () => {
    expect(TEST_EXPLANATION).toContain("**Purpose**")
    expect(TEST_EXPLANATION).toContain("**Why it matters**")
  })

  test("teaches instead of translating line by line", () => {
    expect(TEST_EXPLANATION).toContain("Do not translate the test into plain English line by line")
  })

  test("does not offer replacement code unless the student asks", () => {
    expect(TEST_EXPLANATION).toContain("Do not produce replacement")
    expect(TEST_EXPLANATION).toContain("unless the student explicitly asks")
  })

  test("detects the framework instead of assuming one", () => {
    expect(TEST_EXPLANATION).toContain("identify the language and test framework")
    expect(TEST_EXPLANATION).toContain("Do not assume any particular one")
    // Examples span several languages so no single ecosystem is implied.
    for (const framework of ["JUnit", "pytest", "Jest", "RSpec"]) expect(TEST_EXPLANATION).toContain(framework)
  })
})
