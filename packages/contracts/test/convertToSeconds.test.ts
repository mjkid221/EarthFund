import { expect } from "chai";
import convertToSeconds from "../helpers/convertToSeconds";

describe("Convert to Seconds", () => {
  it("should return the seconds field", () => {
    expect(convertToSeconds({ seconds: 500 })).to.eq(500);
  });
  it("should return the minutes field in seconds", () => {
    expect(convertToSeconds({ minutes: 1 })).to.eq(60);
    expect(convertToSeconds({ minutes: 5 })).to.eq(5 * 60);
    expect(convertToSeconds({ minutes: 500 })).to.eq(500 * 60);
  });
  it("should return the hours field in seconds", () => {
    expect(convertToSeconds({ hours: 1 })).to.eq(3600);
    expect(convertToSeconds({ hours: 7 })).to.eq(7 * 3600);
    expect(convertToSeconds({ hours: 125 })).to.eq(125 * 3600);
  });
  it("should return the days field in seconds", () => {
    expect(convertToSeconds({ days: 1 })).to.eq(86400);
    expect(convertToSeconds({ days: 7 })).to.eq(7 * 86400);
    expect(convertToSeconds({ days: 125 })).to.eq(125 * 86400);
  });
  it("should return the weeks field in seconds", () => {
    expect(convertToSeconds({ weeks: 1 })).to.eq(604800);
    expect(convertToSeconds({ weeks: 7 })).to.eq(7 * 604800);
    expect(convertToSeconds({ weeks: 125 })).to.eq(125 * 604800);
  });
  it("should return the months field in seconds", () => {
    expect(convertToSeconds({ months: 1 })).to.eq(2629800);
    expect(convertToSeconds({ months: 7 })).to.eq(7 * 2629800);
    expect(convertToSeconds({ months: 125 })).to.eq(125 * 2629800);
  });
  it("should return the years field in seconds", () => {
    expect(convertToSeconds({ years: 1 })).to.eq(31540000);
    expect(convertToSeconds({ years: 7 })).to.eq(7 * 31540000);
    expect(convertToSeconds({ years: 125 })).to.eq(125 * 31540000);
  });
});
