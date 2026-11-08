import type { Problem } from "@dsa-atlas/shared";
import { newReview } from "@dsa-atlas/review";

/** One worked example so a new user sees what a complete note looks like. */
export function seedProblems(): Problem[] {
  const now = Date.now();
  return [
    {
      id: "two-sum",
      title: "Two Sum",
      url: "https://leetcode.com/problems/two-sum/",
      platform: "LeetCode",
      difficulty: "Easy",
      topics: ["Array", "Hashing"],
      patterns: ["Hash map lookup"],
      structuraTopics: ["key-value-store"],
      notes:
        "Classic trade: spend O(n) memory to drop a loop.\n\nEdge cases: duplicates (e.g. [3,3], target 6), negative numbers, exactly one answer guaranteed.",
      review: newReview(now),
      createdAt: now,
      updatedAt: now,
      approaches: [
        {
          id: "brute",
          kind: "brute",
          idea: "Try every pair (i, j) with i < j and return the first pair that sums to target.",
          time: "O(n^2)",
          space: "O(1)",
          solutions: [
            {
              language: "cpp",
              code: `vector<int> twoSum(vector<int>& nums, int target) {
    int n = nums.size();
    for (int i = 0; i < n; i++)
        for (int j = i + 1; j < n; j++)
            if (nums[i] + nums[j] == target) return {i, j};
    return {};
}`,
              languageNotes: "int can overflow if values near 2^31 are added; use long long for the sum if the constraints allow it.",
            },
            {
              language: "python",
              code: `def twoSum(nums, target):
    n = len(nums)
    for i in range(n):
        for j in range(i + 1, n):
            if nums[i] + nums[j] == target:
                return [i, j]
    return []`,
              languageNotes: "No overflow in Python, but the nested loop is ~50x slower than C++; n = 10^4 already takes seconds.",
            },
          ],
        },
        {
          id: "optimal",
          kind: "optimal",
          idea: "One pass: for each x, check whether target - x was already seen; store x → index in a hash map.",
          time: "O(n)",
          space: "O(n)",
          solutions: [
            {
              language: "cpp",
              code: `vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> seen; // value -> index
    for (int i = 0; i < nums.size(); i++) {
        auto it = seen.find(target - nums[i]);
        if (it != seen.end()) return {it->second, i};
        seen[nums[i]] = i;
    }
    return {};
}`,
              languageNotes: "unordered_map is O(1) on average but can degrade with adversarial hashes; map would be O(log n).",
            },
            {
              language: "java",
              code: `public int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> seen = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        Integer j = seen.get(target - nums[i]);
        if (j != null) return new int[] {j, i};
        seen.put(nums[i], i);
    }
    return new int[0];
}`,
              languageNotes: "HashMap<Integer, Integer> boxes every int, so it uses more memory than C++; still O(n).",
            },
            {
              language: "python",
              code: `def twoSum(nums, target):
    seen = {}  # value -> index
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i
    return []`,
              languageNotes: "dict lookups are O(1) average; enumerate keeps it clean.",
            },
            {
              language: "javascript",
              code: `function twoSum(nums, target) {
  const seen = new Map(); // value -> index
  for (let i = 0; i < nums.length; i++) {
    const j = seen.get(target - nums[i]);
    if (j !== undefined) return [j, i];
    seen.set(nums[i], i);
  }
  return [];
}`,
              languageNotes: "Use Map, not a plain object: object keys become strings and inherit prototype keys.",
            },
          ],
        },
      ],
    },
  ];
}
