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

  await expect(page.locator(".generate-button")).toContainText(
    "View Checklist (11)"
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
    await expect(page.locator(".checklist-item")).toHaveCount(11);

    await expect(
      page.locator(".checklist-item").filter({ hasText: "Japanese Derby" })
    ).toBeVisible();
    await expect(
      page.locator(".checklist-item").filter({ hasText: "Satsuki Sho" })
    ).toBeVisible();

    const gradeCounter = page.locator(".grade-counter").first();
    await expect(gradeCounter).toContainText("G1: 8");
    await expect(gradeCounter).toContainText("Won: 0 / 11");
  });

  test("Progress Helper should target the first race and allow status updates", async ({
    page,
  }) => {
    const progressHelper = page.locator(".progress-helper");

    await expect(progressHelper).toContainText("Next Race:");
    await expect(progressHelper).toContainText("Yayoi Sho");
    await expect(progressHelper.getByText("Career")).toBeVisible();

    await progressHelper.getByRole("button", { name: "Won" }).click();

    await expect(progressHelper).toContainText("Satsuki Sho");
    await expect(progressHelper.getByText("Career")).not.toBeVisible();

    const yayoiShoItem = page
      .locator(".checklist-item")
      .filter({ hasText: "Yayoi Sho" });
    await expect(yayoiShoItem.getByLabel("Ran")).toBeChecked();
    await expect(yayoiShoItem.getByLabel("Won")).toBeChecked();

    await expect(page.locator(".grade-counter").first()).toContainText(
      "Won: 1 / 11"
    );
  });

  test('should "smart-add" a future race instance when a non-career race is skipped', async ({
    page,
  }) => {
    await page
      .locator(".progress-helper")
      .getByRole("button", { name: "Won" })
      .click();
    await page
      .locator(".progress-helper")
      .getByRole("button", { name: "Won" })
      .click();
    await page
      .locator(".progress-helper")
      .getByRole("button", { name: "Won" })
      .click();

    const progressHelper = page.locator(".progress-helper");
    await expect(progressHelper).toContainText("Hopeful Stakes");

    await progressHelper.getByRole("button", { name: "Skipped" }).click();

    await expect(page.getByRole("status")).toContainText(
      "Found a later version of this race and added it to your checklist."
    );

    await expect(page.locator(".checklist-item")).toHaveCount(12);

    const juniorHopeful = page
      .locator(".checklist-item")
      .filter({ hasText: "Junior Year - December - Late" });
    await expect(juniorHopeful.getByLabel("Skip")).toBeChecked();

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

    await firstRaceNotes.fill(noteText);
    await expect(firstRaceNotes).toHaveValue(noteText);

    await firstRaceItem.getByLabel("Ran").check();
    await expect(firstRaceItem.getByLabel("Ran")).toBeChecked();

    await page.getByRole("button", { name: "Reset All Status" }).click();
    const statusToast = page.getByRole("alert");
    await expect(statusToast).toContainText(
      /Reset all 'Ran', 'Won', and 'Skipped' statuses\?/
    );
    await statusToast.getByRole("button", { name: "Confirm" }).click();

    await expect(firstRaceItem.getByLabel("Ran")).not.toBeChecked();
    await expect(firstRaceNotes).toHaveValue(noteText);

    await page.getByRole("button", { name: "Clear All Notes" }).click();
    const notesToast = page.getByRole("alert");
    await expect(notesToast).toContainText(/Clear all notes\?/);
    await notesToast.getByRole("button", { name: "Confirm" }).click();

    await expect(firstRaceNotes).toHaveValue("");
  });

  test("Progress Helper should allow removing a non-career race", async ({
    page,
  }) => {
    const progressHelper = page.locator(".progress-helper");
    const satsukiShoItem = page
      .locator(".checklist-item")
      .filter({ hasText: "Satsuki Sho" });

    await progressHelper.getByRole("button", { name: "Won" }).click();

    await expect(progressHelper).toContainText("Satsuki Sho");
    await expect(satsukiShoItem).toBeVisible();
    await expect(page.locator(".checklist-item")).toHaveCount(11);

    const removeButton = progressHelper.getByRole("button", {
      name: "Remove",
    });
    await expect(removeButton).toBeEnabled();
    await removeButton.click();

    await expect(satsukiShoItem).not.toBeVisible();
    await expect(page.locator(".checklist-item")).toHaveCount(10);

    await expect(progressHelper).toContainText("Japanese Derby");
  });

  test("Undo button in Progress Helper should revert the last action", async ({
    page,
  }) => {
    const progressHelper = page.locator(".progress-helper");
    const undoButton = progressHelper.getByRole("button", { name: "Undo" });
    const wonCounter = page.locator(".grade-counter", { hasText: "Won:" });

    await expect(wonCounter).toContainText("Won: 0 / 11");
    await expect(undoButton).toBeDisabled();

    await progressHelper.getByRole("button", { name: "Won" }).click();

    await expect(wonCounter).toContainText("Won: 1 / 11");
    await expect(progressHelper).toContainText("Satsuki Sho");
    await expect(undoButton).toBeEnabled();
    await expect(undoButton).toHaveAttribute(
      "title",
      "Undo: Marked 'Yayoi Sho' as won."
    );

    await undoButton.click();

    await expect(page.getByRole("status")).toContainText("Action undone!");

    await expect(wonCounter).toContainText("Won: 0 / 11");
    await expect(undoButton).toBeDisabled();
    await expect(progressHelper).toContainText("Yayoi Sho");
  });

  test("should disable Skip and Remove actions for career races", async ({
    page,
  }) => {
    const progressHelper = page.locator(".progress-helper");
    const yayoiShoItem = page
      .locator(".checklist-item")
      .filter({ hasText: "Yayoi Sho" });

    await expect(progressHelper).toContainText("Yayoi Sho");
    const skipButton = progressHelper.getByRole("button", {
      name: "Skipped",
    });
    const removeButton = progressHelper.getByRole("button", { name: "Remove" });

    await expect(skipButton).toBeDisabled();
    await expect(removeButton).toBeDisabled();

    const skipCheckbox = yayoiShoItem.getByLabel("Skip");
    const itemRemoveButton = yayoiShoItem.getByRole("button", {
      name: "Remove",
    });

    await expect(skipCheckbox).toBeDisabled();
    await expect(itemRemoveButton).toBeDisabled();
  });
});
