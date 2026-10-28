import { describe, expect, it } from "vitest";
import type { AttendanceReport, AttendanceReportRow } from "./api/types";
import { csvCell, hours, REPORT_COLUMNS, reportFilename, reportToCsv, totalsAsRow } from "./attendance-csv";

const row = (over: Partial<AttendanceReportRow> = {}): AttendanceReportRow => ({
  userId: "e1",
  name: "Priya Nair",
  department: "Recruitment",
  expectedDays: 20,
  daysWorked: 18,
  daysAbsent: 1,
  daysOnLeave: 1,
  lateCount: 3,
  lateExcused: 1,
  avgLateMin: 25,
  earlyCount: 2,
  earlyExcused: 0,
  idleEvents: 4,
  idleMin: 150,
  noClockOut: 1,
  totalWorkedMin: 9300,
  avgWorkedMin: 517,
  minWorkMinutes: 510,
  shortDays: 2,
  shortfallMin: 90,
  overtimeMin: 45,
  ...over,
});

const report = (rows: AttendanceReportRow[]): AttendanceReport => ({
  from: "2026-10-01",
  to: "2026-10-31",
  rows,
  totals: {
    people: rows.length,
    expectedDays: 40,
    daysWorked: 36,
    daysAbsent: 2,
    daysOnLeave: 2,
    lateCount: 6,
    lateExcused: 2,
    avgLateMin: 24,
    earlyCount: 3,
    earlyExcused: 1,
    idleEvents: 8,
    idleMin: 300,
    noClockOut: 2,
    totalWorkedMin: 18600,
    avgWorkedMin: 517,
    shortDays: 4,
    shortfallMin: 180,
    overtimeMin: 90,
  },
});

describe("hours", () => {
  it.each([
    [0, "0.00"],
    [30, "0.50"],
    [510, "8.50"],
    [517, "8.62"],
    [9300, "155.00"],
  ])("%d minutes -> %s hours", (min, expected) => expect(hours(min)).toBe(expected));
});

describe("csvCell", () => {
  it("leaves plain values alone", () => {
    expect(csvCell("Priya Nair")).toBe("Priya Nair");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(0)).toBe("0");
  });

  it("is empty for null and undefined", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes values with a comma, a quote or a newline, doubling inner quotes", () => {
    expect(csvCell("Nair, Priya")).toBe('"Nair, Priya"');
    expect(csvCell('The "Boss"')).toBe('"The ""Boss"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  describe("spreadsheet formula injection (names are typed by users)", () => {
    it.each(["=SUM(A1:A9)", "+1+1", "-2+3", "@cmd", "\tcmd", "\rcmd"])("defuses %j with a leading apostrophe", (evil) => {
      expect(csvCell(evil).replace(/^"/, "").startsWith("'")).toBe(true);
    });

    it("applies even when the value also needs quoting", () => {
      expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
    });

    it("does not touch a normal negative NUMBER (only text can be an injected formula)", () => {
      expect(csvCell(-5)).toBe("-5");
    });

    it("does not touch values merely containing those characters", () => {
      expect(csvCell("a=b")).toBe("a=b");
      expect(csvCell("Mary-Ann")).toBe("Mary-Ann");
    });
  });
});

describe("reportToCsv", () => {
  it("has a title line, a header line, one line per person and a totals line", () => {
    const lines = reportToCsv(report([row(), row({ userId: "e2", name: "Jon Carter" })])).split("\r\n");
    expect(lines[0]).toBe("Attendance report 2026-10-01 to 2026-10-31");
    expect(lines[1].split(",")).toEqual(REPORT_COLUMNS.map((c) => c.header));
    expect(lines).toHaveLength(2 + 2 + 1);
    expect(lines[4].startsWith("Total (2 people)")).toBe(true);
  });

  it("every line has the same number of columns", () => {
    const lines = reportToCsv(report([row(), row({ name: "Jon Carter" })])).split("\r\n").slice(1);
    const widths = new Set(lines.map((l) => l.split(",").length));
    expect(widths.size).toBe(1);
    expect(widths.has(REPORT_COLUMNS.length)).toBe(true);
  });

  it("writes a person's numbers in the right columns, hours as decimals", () => {
    const [, , line] = reportToCsv(report([row()])).split("\r\n");
    const cells = line.split(",");
    const at = (header: string) => cells[REPORT_COLUMNS.findIndex((c) => c.header === header)];
    expect(at("Employee")).toBe("Priya Nair");
    expect(at("Department")).toBe("Recruitment");
    expect(at("Days absent")).toBe("1");
    expect(at("Late arrivals")).toBe("3");
    expect(at("Late arrivals excused")).toBe("1");
    expect(at("Idle hours")).toBe("2.50");
    expect(at("Total hours")).toBe("155.00");
    expect(at("Minimum hours per day")).toBe("8.50");
    expect(at("Short days")).toBe("2");
    expect(at("Shortfall hours")).toBe("1.50");
    expect(at("Overtime hours")).toBe("0.75");
  });

  it("blanks the department when there is none", () => {
    const [, , line] = reportToCsv(report([row({ department: null })])).split("\r\n");
    expect(line.split(",")[1]).toBe("");
  });

  it("the totals line leaves 'minimum hours' blank (it differs by person)", () => {
    const lines = reportToCsv(report([row()])).split("\r\n");
    const total = lines[3].split(",");
    expect(total[REPORT_COLUMNS.findIndex((c) => c.header === "Minimum hours per day")]).toBe("");
    expect(total[REPORT_COLUMNS.findIndex((c) => c.header === "Total hours")]).toBe("310.00");
  });

  it("quotes and defuses hostile names", () => {
    const csv = reportToCsv(report([row({ name: '=cmd|"/c calc"' })]));
    expect(csv).toContain(`"'=cmd|""/c calc"""`);
    expect(csv).not.toMatch(/(^|\r\n)=/);
  });

  it("with nobody in the report, has just the title and headers (no totals line)", () => {
    expect(reportToCsv(report([])).split("\r\n")).toHaveLength(2);
  });

  it("totalsAsRow labels the total with the number of people", () => {
    expect(totalsAsRow(report([row()]).totals).name).toBe("Total (1 person)");
    expect(totalsAsRow(report([row(), row()]).totals).name).toBe("Total (2 people)");
  });
});

describe("reportFilename", () => {
  it("names the file after the period", () => {
    expect(reportFilename({ from: "2026-10-01", to: "2026-10-31" })).toBe("attendance-2026-10-01_to_2026-10-31.csv");
  });
});
