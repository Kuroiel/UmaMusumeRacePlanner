// tests/checklist-page.spec.js
import { test, expect } from "@playwright/test";

// Helper to set up a consistent state for checklist tests
async function setupChecklistWithOptionalRaces(page) {
  await page.goto("/");
  await page
    .getByPlaceholder("Search...")
    .pressSequentially("Special Week (Original)", { delay: 30 });
  await page.getByRole("listitem", { name: "Special Week (Original)" }).click();
  await expect(page.locator("tbody tr").first()).toBeVisible();

  // Select the G1 Hopeful Stakes (non-career, has a future instance)
  await page
    .locator("tr")
    .filter({ hasText: "Hopeful Stakes" })
    .first() // Selects the Junior Year instance
    .getByRole("checkbox")
    .check();

  // Select another optional race
  await page
    .locator("tr")
    .filter({ hasText: "Satsuki Sho" })
    .first()
    .getByRole("checkbox")
    .check();

  await expect(page.locator(".generate-button")).toContainText(
    "View Checklist (11)"
  );
  await page.getByRole("button", { name: /View Checklist/ }).click();

  // Wait for navigation and for the checklist page to be ready
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
    // Verify the total number of races matches the button count from the planner
    await expect(page.locator(".checklist-item")).toHaveCount(11);

    // Check that a known career race is present
    await expect(
      page.locator(".checklist-item").filter({ hasText: "Japanese Derby" })
    ).toBeVisible();
    // Check that a known optional race is present
    await expect(
      page.locator(".checklist-item").filter({ hasText: "Satsuki Sho" })
    ).toBeVisible();

    // Verify the summary counters are correct
    const gradeCounter = page.locator(".grade-counter").first();
    await expect(gradeCounter).toContainText("G1: 8");
    await expect(gradeCounter).toContainText("Won: 0 / 11");
  });

  test("Progress Helper should target the first race and allow status updates", async ({
    page,
  }) => {
    const progressHelper = page.locator(".progress-helper");

    // The first race for Special Week is Yayoi Sho
    await expect(progressHelper).toContainText("Next Race:");
    await expect(progressHelper).toContainText("Yayoi Sho");
    await expect(progressHelper.getByText("Career")).toBeVisible();

    // Mark it as won
    await progressHelper.getByRole("button", { name: "Won" }).click();

    // The Progress Helper should now target the *next* race, Satsuki Sho
    await expect(progressHelper).toContainText("Satsuki Sho");
    await expect(progressHelper.getByText("Career")).not.toBeVisible();

    // Verify the main list item for Yayoi Sho is updated
    const yayoiShoItem = page
      .locator(".checklist-item")
      .filter({ hasText: "Yayoi Sho" });
    await expect(yayoiShoItem.getByLabel("Ran")).toBeChecked();
    await expect(yayoiShoItem.getByLabel("Won")).toBeChecked();

    // And the summary count is updated
    await expect(page.locator(".grade-counter").first()).toContainText(
      "Won: 1 / 11"
    );
  });

  test('should "smart-add" a future race instance when a non-career race is skipped', async ({
    page,
  }) => {
    // First, mark all races up to Hopeful Stakes as won
    await page
      .locator(".progress-helper")
      .getByRole("button", { name: "Won" })
      .click(); // Yayoi Sho
    await page
      .locator(".progress-helper")
      .getByRole("button", { name: "Won" })
      .click(); // Satsuki Sho
    await page
      .locator(".progress-helper")
      .getByRole("button", { name: "Won" })
      .click(); // Japanese Derby

    // The next race should be Hopeful Stakes (the Junior Year one)
    const progressHelper = page.locator(".progress-helper");
    await expect(progressHelper).toContainText("Hopeful Stakes");

    // Mark it as skipped
    await progressHelper.getByRole("button", { name: "Skipped" }).click();

    // A toast should appear confirming the smart-add
    await expect(page.getByRole("status")).toContainText(
      "Found a later version of this race and added it to your checklist."
    );

    // The total race count should now be 12
    await expect(page.locator(".checklist-item")).toHaveCount(12);

    // The Junior Year Hopeful Stakes should be marked as skipped
    const juniorHopeful = page
      .locator(".checklist-item")
      .filter({ hasText: "Junior Year - December - Late" });
    await expect(juniorHopeful.getByLabel("Skip")).toBeChecked();

    // The Classic Year Hopeful Stakes should now be in the list, marked with the smart-add indicator
    const classicHopeful = page
      .locator(".checklist-item")
      .filter({ hasText: "Classic Year - December - Late" });
    await expect(classicHopeful).toBeVisible();
    await expect(
      classicHopeful.locator(".smart-add-indicator")
    ).toHaveAttribute("title", "This race was automatically added.");
  });

  test("should allow editing notes and resetting statuses/notes", async ({
    page,
  }) => {
    const firstRaceItem = page.locator(".checklist-item").first();
    const firstRaceNotes = firstRaceItem.getByPlaceholder("Notes...");
    const noteText = "Need 400 speed for this race.";

    // Add a note
    await firstRaceNotes.fill(noteText);
    await expect(firstRaceNotes).toHaveValue(noteText);

    // Mark as ran
    await firstRaceItem.getByLabel("Ran").check();
    await expect(firstRaceItem.getByLabel("Ran")).toBeChecked();

    // Click "Reset All Status" and confirm
    await page.getByRole("button", { name: "Reset All Status" }).click();
    const statusToast = page.getByRole("alert");
    await expect(statusToast).toContainText(
      /Reset all 'Ran', 'Won', and 'Skipped' statuses\?/
    );
    await statusToast.getByRole("button", { name: "Confirm" }).click();

    // Verify status is reset but note is kept
    await expect(firstRaceItem.getByLabel("Ran")).not.toBeChecked();
    await expect(firstRaceNotes).toHaveValue(noteText);

    // Click "Clear All Notes" and confirm
    await page.getByRole("button", { name: "Clear All Notes" }).click();
    const notesToast = page.getByRole("alert");
    await expect(notesToast).toContainText(/Clear all notes\?/);
    await notesToast.getByRole("button", { name: "Confirm" }).click();

    // Verify note is cleared
    await expect(firstRaceNotes).toHaveValue("");
  });

  test("Progress Helper should allow removing a non-career race", async ({
    page,
  }) => {
    const progressHelper = page.locator(".progress-helper");
    const satsukiShoItem = page
      .locator(".checklist-item")
      .filter({ hasText: "Satsuki Sho" });

    // Mark the first race (Yayoi Sho) as won to advance the helper
    await progressHelper.getByRole("button", { name: "Won" }).click();

    // The next race is now Satsuki Sho, which is optional.
    await expect(progressHelper).toContainText("Satsuki Sho");
    await expect(satsukiShoItem).toBeVisible();
    await expect(page.locator(".checklist-item")).toHaveCount(11);

    // Get the remove button from the helper and click it
    const removeButton = progressHelper.getByRole("button", {
      name: "Remove",
    });
    await expect(removeButton).toBeEnabled();
    await removeButton.click();

    // Satsuki Sho should be gone from the list
    await expect(satsukiShoItem).not.toBeVisible();
    await expect(page.locator(".checklist-item")).toHaveCount(10);

    // The Progress Helper should have advanced to the *next* race, Japanese Derby
    await expect(progressHelper).toContainText("Japanese Derby");
  });

  test("Undo button in Progress Helper should revert the last action", async ({
    page,
  }) => {
    const progressHelper = page.locator(".progress-helper");
    const undoButton = progressHelper.getByRole("button", { name: "Undo" });
    const wonCounter = page.locator(".grade-counter", { hasText: "Won:" });

    // Initial state: 0 wins, Undo is disabled.
    await expect(wonCounter).toContainText("Won: 0 / 11");
    await expect(undoButton).toBeDisabled();

    // Perform an action: Mark the first race as won.
    await progressHelper.getByRole("button", { name: "Won" }).click();

    // State after action: 1 win, Undo is now enabled, helper targets next race.
    await expect(wonCounter).toContainText("Won: 1 / 11");
    await expect(progressHelper).toContainText("Satsuki Sho"); // Advanced to next race
    await expect(undoButton).toBeEnabled();
    await expect(undoButton).toHaveAttribute(
      "title",
      "Undo: Marked 'Yayoi Sho' as won."
    );

    // Click the Undo button.
    await undoButton.click();

    // A success toast should appear.
    await expect(page.getByRole("status")).toContainText("Action undone!");

    // State should be reverted: 0 wins, Undo is disabled again, helper targets original race.
    await expect(wonCounter).toContainText("Won: 0 / 11");
    await expect(undoButton).toBeDisabled();
    await expect(progressHelper).toContainText("Yayoi Sho"); // Reverted to original race
  });

  test("should disable Skip and Remove actions for career races", async ({
    page,
  }) => {
    // The first race, Yayoi Sho, is a career race for Special Week.
    const progressHelper = page.locator(".progress-helper");
    const yayoiShoItem = page
      .locator(".checklist-item")
      .filter({ hasText: "Yayoi Sho" });

    // --- Check the Progress Helper ---
    await expect(progressHelper).toContainText("Yayoi Sho");
    const skipButton = progressHelper.getByRole("button", {
      name: "Skipped",
    });
    const removeButton = progressHelper.getByRole("button", { name: "Remove" });

    await expect(skipButton).toBeDisabled();
    await expect(removeButton).toBeDisabled();

    // --- Check the main checklist item ---
    const skipCheckbox = yayoiShoItem.getByLabel("Skip");
    const itemRemoveButton = yayoiShoItem.getByRole("button", {
      name: "Remove",
    });

    // The label around the checkbox is what gets the disabled class.
    await expect(skipCheckbox).toBeDisabled();
    await expect(itemRemoveButton).toBeDisabled();
  });
});
