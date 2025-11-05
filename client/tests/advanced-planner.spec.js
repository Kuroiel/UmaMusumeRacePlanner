// tests/advanced-planner.spec.js
import { test, expect } from "@playwright/test";

test.describe("Advanced Planner Features", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());

    await page.reload();
    const searchInput = page.getByPlaceholder("Search...");
    await searchInput.pressSequentially("El Condor Pasa (Original)", {
      delay: 50,
    });
    await searchInput.press("Enter");

    await expect(searchInput).toHaveValue("El Condor Pasa (Original)");
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });

  test("Aptitude Editor should update race highlights", async ({ page }) => {
    const victoriaMileRow = page
      .locator("tr")
      .filter({ hasText: "Senior Year" })
      .filter({ hasText: "Victoria Mile" });

    await expect(victoriaMileRow).toHaveClass(/highlighted-race/);

    // Turn off the default filter to see the race become un-highlighted
    await page.getByLabel("Hide Unsuitable Races").uncheck();

    // Instead of relying on order with .nth(3), locate the select by its associated text.
    // This is much more robust if the order of aptitudes ever changes.
    await page
      .locator(".aptitude-item", { hasText: "Mile" })
      .getByRole("combobox")
      .selectOption("B");

    await expect(victoriaMileRow).not.toHaveClass(/highlighted-race/);

    const resetButton = page.getByRole("button", {
      name: "Reset to Default",
      exact: true,
    });
    await expect(resetButton).toBeVisible();
    await resetButton.click();

    await expect(victoriaMileRow).toHaveClass(/highlighted-race/);
  });

  test("Epithet Helper should add missing races", async ({ page }) => {
    const checklistButton = page.locator(".generate-button");
    await expect(checklistButton).toContainText("View Checklist (7)");

    const epithetPanel = page.locator(".panel-section", {
      hasText: "Epithet Helper",
    });
    const tripleCrownItem = epithetPanel.locator(".epithet-item", {
      hasText: "Classic Triple Crown",
    });
    await tripleCrownItem.getByRole("button", { name: /Add Missing/ }).click();

    await expect(page.getByRole("status")).toContainText(
      "Added 2 race(s) to your schedule!"
    );

    await expect(checklistButton).toContainText("View Checklist (9)");

    const satsukiShoRow = page
      .locator("tr")
      .filter({ hasText: "Classic Year" })
      .filter({ hasText: "Satsuki Sho" });
    await expect(satsukiShoRow.getByRole("checkbox")).toBeChecked();
  });

  test("Multi-Select should select and unselect races based on criteria", async ({
    page,
  }) => {
    const checklistButton = page.locator(".generate-button");
    await expect(checklistButton).toContainText("View Checklist (7)");

    await page.getByRole("heading", { name: "Multi Select" }).click();
    const multiSelectPanel = page.locator(".multi-select-form");
    await expect(multiSelectPanel).toBeVisible();

    await multiSelectPanel.locator(".multi-select-display").first().click();
    const multiSelectOptions = page.locator(".multi-select-options");
    await multiSelectOptions.getByLabel("G2").check();
    await page.locator("h2", { hasText: "Available Races" }).click();
    await expect(multiSelectOptions).not.toBeVisible();

    await multiSelectPanel
      .getByRole("button", { name: "Select Matching", exact: true })
      .click();

    await expect(checklistButton).toContainText("View Checklist (22)");

    await multiSelectPanel
      .getByRole("button", { name: "Unselect Matching", exact: true })
      .click();

    await expect(checklistButton).toContainText("View Checklist (7)");
  });

  test("Maximize Fans button should select optimal races", async ({ page }) => {
    const checklistButton = page.locator(".generate-button");
    await expect(checklistButton).toContainText("View Checklist (7)");

    await page.getByLabel("Junior Year").uncheck();
    await page.getByLabel("Classic Year").uncheck();
    await page.getByLabel("G2").uncheck();
    await page.getByLabel("G3").uncheck();
    await page.getByLabel("Dirt").uncheck();
    await page.getByLabel("Hide Unsuitable Races").uncheck();

    await page.getByRole("heading", { name: "Multi Select" }).click();

    const maximizeButton = page.getByRole("button", {
      name: "Maximize Fans",
      exact: true,
    });
    await maximizeButton.click();

    await expect(maximizeButton).toBeDisabled();
    await expect(maximizeButton).toHaveText("Calculating...");

    await expect(maximizeButton).toBeEnabled({ timeout: 10000 });
    await expect(maximizeButton).toHaveText("Maximize Fans");

    await expect(checklistButton).toContainText("View Checklist (10)");
  });

  test("'Prevent 3+ Consecutive' should stop additions that cause warnings", async ({
    page,
  }) => {
    const checklistButton = page.locator(".generate-button");
    const selectMatchingButton = page.getByRole("button", {
      name: "Select Matching",
      exact: true,
    });

    const tennoShoAutumn = page
      .locator("tr", { hasText: "Tenno Sho (Autumn)" })
      .getByRole("checkbox");
    const queenElizabethCup = page
      .locator("tr", { hasText: "Queen Elizabeth II Cup" })
      .getByRole("checkbox");
    const mileChamp = page.locator("tr", { hasText: "Mile Championship" });

    await tennoShoAutumn.check(); // Senior Oct-Late
    await queenElizabethCup.check(); // Senior Nov-Early
    await expect(checklistButton).toContainText("View Checklist (9)");

    const preventToggle = page.getByLabel("Prevent 3+ Consecutive Races");
    await expect(preventToggle).toBeChecked();

    await page.getByRole("heading", { name: "Multi Select" }).click();
    await page.locator(".multi-select-display").nth(0).click(); // grade
    await page.getByLabel("G1").check();
    await page.locator("h2").first().click();
    await page.locator(".multi-select-display").nth(2).click(); // distance
    await page.getByLabel("Mile").check();
    await page.locator("h2").first().click();
    await page.locator(".multi-select-display").nth(3).click(); // year
    await page.getByLabel("Senior").check();
    await page.locator("h2").first().click();

    await selectMatchingButton.click();

    await expect(mileChamp.getByRole("checkbox")).not.toBeChecked();

    await preventToggle.uncheck();
    await selectMatchingButton.click();

    await expect(mileChamp.getByRole("checkbox")).toBeChecked();
    await expect(mileChamp).toHaveClass(/warning-race-row/);
  });
});
