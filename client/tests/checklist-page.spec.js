import { test, expect } from "@playwright/test";

async function setupChecklistWithOptionalRaces(page) {
  await page.goto("/");
  const searchInput = page.getByPlaceholder("Search...");
  await searchInput.pressSequentially("Special Week (Original)", {
    delay: 30,
  });
  await searchInput.press("Enter");
  await expect(page.locator("tbody tr").first()).toBeVisible();

  await page
    .locator("tr")
    .filter({ hasText: "Hopeful Stakes" })
    .first()
    .getByRole("checkbox")
    .check();

  await page
    .locator("tr")
    .filter({ hasText: "Satsuki Sho" })
    .first()
    .getByRole("checkbox")
    .check();

  await page
    .locator("tr")
    .filter({ hasText: "Mermaid Stakes" })
    .first()
    .getByRole("checkbox")
    .check();

  await expect(page.locator(".generate-button")).toContainText(
    "View Checklist (9)"
  );
  await page.getByRole("button", { name: /View Checklist/ }).click();

  await expect(
    page.getByRole("heading", { name: "Active Checklist" })
  ).toBeVisible();
  await expect(page.locator(".checklist-item").first()).toBeVisible();
}

test.describe("Checklist Page Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await setupChecklistWithOptionalRaces(page);
  });

  test("should display the correct races and summary counts", async ({
    page,
  }) => {
    await expect(page.locator(".checklist-item")).toHaveCount(9);

    await expect(
      page.locator(".checklist-item").filter({ hasText: "Japanese Derby" })
    ).toBeVisible();
    await expect(
      page.locator(".checklist-item").filter({ hasText: "Satsuki Sho" })
    ).toBeVisible();

    const gradeCounter = page.locator(".grade-counter").first();
    await expect(gradeCounter).toContainText("G1: 7");
    await expect(gradeCounter).toContainText("Won:0 / 9");
  });

  test("Progress Helper should target the first race and allow status updates", async ({
    page,
  }) => {
    const progressHelper = page.locator(".progress-helper");

    await expect(progressHelper).toContainText("Next Race:");
    await expect(progressHelper).toContainText("Hopeful Stakes");
    await expect(progressHelper.getByText("Exclusive")).toBeVisible();

    await progressHelper.getByRole("button", { name: "Won" }).click();

    await expect(progressHelper).toContainText("Kisaragi Sho");
    await expect(progressHelper.getByText("Career")).toBeVisible();

    const hopefulStakesItem = page
      .locator(".checklist-item")
      .filter({ hasText: "Hopeful Stakes" });
    await expect(hopefulStakesItem.getByLabel("Ran")).toBeChecked();
    await expect(hopefulStakesItem.getByLabel("Won")).toBeChecked();

    await expect(page.locator(".grade-counter").first()).toContainText(
      "Won:1 / 9"
    );
  });

  test('should "smart-add" a future race instance when a non-career race is skipped', async ({
    page,
  }) => {
    // 1. Skip 4 times to reach Mermaid Stakes (June Classic Year)
    const progressHelper = page.locator(".progress-helper");
    await progressHelper.getByRole("button", { name: "Won" }).click(); // Hopeful
    await progressHelper.getByRole("button", { name: "Won" }).click(); // Kisaragi
    await progressHelper.getByRole("button", { name: "Won" }).click(); // Yayoi
    await progressHelper.getByRole("button", { name: "Won" }).click(); // Satsuki

    // 2. Verify Mermaid Stakes is current
    await expect(progressHelper).toContainText("Mermaid Stakes");

    // 3. Click Skip
    await progressHelper.getByRole("button", { name: "Skipped" }).click();

    // 4. Verify Toast
    await expect(page.getByRole("status")).toContainText(
      "Found a later version of this race and added it to your checklist."
    );

    // 5. Verify Count (9 original + 1 added = 10)
    await expect(page.locator(".checklist-item")).toHaveCount(10);

    // 6. Verify Old Race (Classic Year Mermaid Stakes) is Skipped
    const classicMermaid = page
      .locator(".checklist-item")
      .filter({ hasText: "Mermaid Stakes" })
      .filter({ hasText: "Classic Year" });
    await expect(classicMermaid).toBeVisible();
    await expect(classicMermaid.getByLabel("Skip")).toBeChecked();

    // 7. Verify New Race (Senior Year Mermaid Stakes) is Visible and Smart Added
    const seniorMermaid = page
      .locator(".checklist-item")
      .filter({ hasText: "Mermaid Stakes" })
      .filter({ hasText: "Senior Year" });
    await expect(seniorMermaid).toBeVisible();
    await expect(seniorMermaid.locator(".smart-add-indicator")).toHaveAttribute(
      "title",
      "This race was automatically added."
    );
  });

  test("should allow editing notes and resetting statuses/notes", async ({
    page,
  }) => {
    const firstRaceItem = page.locator(".checklist-item").first();
    const firstRaceNotes = firstRaceItem.getByPlaceholder("Notes...");
    const noteText = "Need 400 speed for this race.";

    await firstRaceNotes.fill(noteText);
    await expect(firstRaceNotes).toHaveValue(noteText);

    await firstRaceItem.getByLabel("Ran").check();
    await expect(firstRaceItem.getByLabel("Ran")).toBeChecked();

    await page.getByRole("button", { name: "Reset All Status" }).click();

    // Use filter to target the specific confirmation toast
    const statusToast = page
      .locator(".confirmation-toast")
      .filter({ hasText: "Reset all" });
    await expect(statusToast).toBeVisible();
    await statusToast.getByRole("button", { name: "Confirm" }).click();

    // Check for success message instead of checking if toast is hidden
    await expect(
      page.getByText("Ran/Won/Skipped statuses have been reset.")
    ).toBeVisible();

    await expect(firstRaceItem.getByLabel("Ran")).not.toBeChecked();
    await expect(firstRaceNotes).toHaveValue(noteText);

    await page.getByRole("button", { name: "Clear All Notes" }).click();

    // Use filter for the second toast to avoid ambiguity if the first one lingers
    const notesToast = page
      .locator(".confirmation-toast")
      .filter({ hasText: "Clear all notes" });
    await expect(notesToast).toBeVisible();
    await notesToast.getByRole("button", { name: "Confirm" }).click();

    // Check for success message
    await expect(page.getByText("All notes have been cleared.")).toBeVisible();

    await expect(firstRaceNotes).toHaveValue("");
  });

  test("Progress Helper should allow removing a non-career race", async ({
    page,
  }) => {
    const progressHelper = page.locator(".progress-helper");
    const hopefulItem = page
      .locator(".checklist-item")
      .filter({ hasText: "Hopeful Stakes" });

    // Verify Hopeful Stakes is displayed
    await expect(progressHelper).toContainText("Hopeful Stakes");
    await expect(hopefulItem).toBeVisible();

    const removeButton = progressHelper.getByRole("button", {
      name: "Remove",
    });
    await expect(removeButton).toBeEnabled();
    await removeButton.click();

    // Verify Hopeful Stakes is gone
    await expect(hopefulItem).not.toBeVisible();

    // Verify count is 8 (9 original - 1 removed)
    await expect(page.locator(".checklist-item")).toHaveCount(8);

    // Verify next race is Kisaragi Sho
    await expect(progressHelper).toContainText("Kisaragi Sho");
  });

  test("Undo button in Progress Helper should revert the last action", async ({
    page,
  }) => {
    const progressHelper = page.locator(".progress-helper");
    const undoButton = progressHelper.getByRole("button", { name: "Undo" });
    const wonCounter = page.locator(".grade-counter", { hasText: "Won:" });

    // Initial state: 9 races
    await expect(wonCounter).toContainText("Won:0 / 9");
    await expect(undoButton).toBeDisabled();

    // Mark first race (Hopeful Stakes) as won
    await progressHelper.getByRole("button", { name: "Won" }).click();

    // Verify new state
    await expect(wonCounter).toContainText("Won:1 / 9");
    await expect(progressHelper).toContainText("Kisaragi Sho");
    await expect(undoButton).toBeEnabled();
    await expect(undoButton).toHaveAttribute(
      "title",
      "Undo: Marked 'Hopeful Stakes' as won."
    );

    // Click Undo
    await undoButton.click();

    await expect(page.getByRole("status")).toContainText("Action undone!");

    // Verify reverted state
    await expect(wonCounter).toContainText("Won:0 / 9");
    await expect(undoButton).toBeDisabled();
    await expect(progressHelper).toContainText("Hopeful Stakes");
  });

  test("should disable Skip and Remove actions for career races", async ({
    page,
  }) => {
    const progressHelper = page.locator(".progress-helper");
    const kikukaShoItem = page
      .locator(".checklist-item")
      .filter({ hasText: "Kikuka Sho" });

    const skipCheckbox = kikukaShoItem.getByLabel("Skip");
    const itemRemoveButton = kikukaShoItem.getByRole("button", {
      name: "Remove",
    });

    await expect(skipCheckbox).toBeDisabled();
    await expect(itemRemoveButton).toBeDisabled();
  });
});
