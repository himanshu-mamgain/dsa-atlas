import { describe, expect, it } from "vitest";
import { canFormat, formatCode } from "./format";

describe("formatCode", () => {
  it("formats JavaScript and TypeScript", async () => {
    expect(await formatCode("function twoSum(nums,target){const seen=new Map();for(let i=0;i<nums.length;i++){if(seen.has(target-nums[i]))return [seen.get(target-nums[i]),i];seen.set(nums[i],i)}}", "javascript")).toBe(
      "function twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];\n    seen.set(nums[i], i);\n  }\n}\n",
    );
    expect(await formatCode("const f=(a:number):number=>a*2", "typescript")).toBe("const f = (a: number): number => a * 2;\n");
  });

  it("throws on code it can't parse, and only handles JS/TS", async () => {
    await expect(formatCode("function (", "javascript")).rejects.toThrow();
    expect(canFormat("python")).toBe(false);
  });
});
