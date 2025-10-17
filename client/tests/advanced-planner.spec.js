// tests/advanced-planner.spec.js
import { test, expect } from "@playwright/test";

test.describe("Advanced Planner Features", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Select a character with varied aptitudes for comprehensive testing
    await page
      .getByPlaceholder("Search...")
      .pressSequentially("El Condor Pasa (Original)", { delay: 30 });
    await page
      .getByRole("listitem", { name: "El Condor Pasa (Original)" })
      .click();
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });

  test("Aptitude Editor should update race highlights", async ({ page }) => {
    // Victoria Mile is a G1 Mile race on Turf. El Condor Pasa has A-Turf, A-Mile by default.
    const victoriaMileRow = page
      .locator("tr")
      .filter({ hasText: "Victoria Mile" });

    // With default filters (Track B, Dist A), the race should be highlighted.
    await expect(victoriaMileRow).toHaveClass(/highlighted-race/);

    // Open Aptitude Editor and change Mile aptitude from A to B.
    await page.locator(".aptitude-item select").nth(3).selectOption("B"); // 4th select is 'mile'

    // Now, the race should still be visible (because "Hide Unsuitable" is on but B >= A is false)
    // but it should NOT be highlighted anymore.
    await expect(victoriaMileRow).toBeVisible();
    await expect(victoriaMileRow).not.toHaveClass(/highlighted-race/);

    // Test the reset button
    const resetButton = page.getByRole("button", { name: "Reset to Default" });
    await expect(resetButton).toBeVisible();
    await resetButton.click();

    // The race should become highlighted again.
    await expect(victoriaMileRow).toHaveClass(/highlighted-race/);
  });

  test("Epithet Helper should add missing races", async ({ page }) => {
    const checklistButton = page.locator(".generate-button");
    // El Condor Pasa has 9 career races.
    await expect(checklistButton).toContainText("View Checklist (9)");

    // Open the epithet helper panel
    const epithetPanel = page.locator(".panel-section", {
      hasText: "Epithet Helper",
    });
    // Click the "Add Missing" button for the Classic Triple Crown.
    const tripleCrownItem = epithetPanel.locator(".epithet-item", {
      hasText: "Classic Triple Crown",
    });
    await tripleCrownItem.getByRole("button", { name: /Add Missing/ }).click();

    // A success toast should appear.
    await expect(page.getByRole("status")).toContainText(
      "Added 3 race(s) to your schedule!"
    );

    // The checklist count should now be 9 + 3 = 12.
    await expect(checklistButton).toContainText("View Checklist (12)");

    // Verify that one of the added races (Satsuki Sho) is now checked.
    const satsukiShoRow = page.locator("tr").filter({ hasText: "Satsuki Sho" });
    await expect(satsukiShoRow.getByRole("checkbox")).toBeChecked();
  });

  test("Multi-Select should select and unselect races based on criteria", async ({
    page,
  }) => {
    const checklistButton = page.locator(".generate-button");
    await expect(checklistButton).toContainText("View Checklist (9)");

    // Open the multi-select panel
    await page.getByRole("heading", { name: "Multi Select" }).click();

    // Select all G2 races
    await page.locator(".multi-select-display").nth(0).click(); // Clicks the 'grade' dropdown
    await page.getByLabel("G2").check();
    await page.locator("body").click(); // Click away to close dropdown

    await page.getByRole("button", { name: "Select Matching" }).click();

    // El Condor Pasa has 2 career G2s. All visible G2s will be selected.
    // There are 5 total optional G2s visible, so 9 + 5 = 14.
    await expect(checklistButton).toContainText("View Checklist (14)");

    // Now, unselect them
    await page.getByRole("button", { name: "Unselect Matching" }).click();
    // Career races cannot be unselected, so the count goes back to 9.
    await expect(checklistButton).toContainText("View Checklist (9)");
  });

  test("Maximize Fans button should select optimal races", async ({ page }) => {
    const checklistButton = page.locator(".generate-button");
    await expect(checklistButton).toContainText("View Checklist (9)");

    // To make the test deterministic, we apply a very specific filter.
    // Filter for only Senior Year, G1, Turf races.
    await page.getByLabel("Junior Year").uncheck();
    await page.getByLabel("Classic Year").uncheck();
    await page.getByLabel("G2").uncheck();
    await page.getByLabel("G3").uncheck();
    await page.getByLabel("Dirt").uncheck();
    await page.locator("label", { hasText: "Show Pre-OP/OP Races" }).check();

    // Open the multi-select panel
    await page.getByRole("heading", { name: "Multi Select" }).click();

    const maximizeButton = page.getByRole("button", { name: "Maximize Fans" });
    await maximizeButton.click();

    // The button should show a "Calculating..." state briefly.
    await expect(maximizeButton).toBeDisabled();
    await expect(maximizeButton).toHaveText("Calculating...");

    // Wait for calculation to finish
    await expect(maximizeButton).toBeEnabled();
    await expect(maximizeButton).toHaveText("Maximize Fans");

    // With these filters, the algorithm should select a specific number of races.
    // This number might need adjustment if race data changes, but it provides a stable check.
    // 3 career + 7 optimal optional = 10
    await expect(checklistButton).toContainText("View Checklist (10)");
  });
});
