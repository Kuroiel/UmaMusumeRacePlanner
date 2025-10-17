// tests/filters.spec.js
import { test, expect } from "@playwright/test";

test.describe("Race Filtering Functionality", () => {
  test.beforeEach(async ({ page }) => {
    // This setup is repeated, so it's perfect for a beforeEach hook.
    await page.goto("/");
    // Use pressSequentially for a more human-like typing that allows the UI to react.
    await page
      .getByPlaceholder("Search...")
      .pressSequentially("Oguri Cap (Original)", { delay: 50 });
    await page.getByRole("listitem", { name: "Oguri Cap (Original)" }).click();

    // A robust way to wait for the table to be populated is to wait for a specific,
    // known element to appear. Here we wait for the table body to have at least one row.
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });

  test("should filter by Grade", async ({ page }) => {
    // Use a robust locator strategy: find a <tr> that contains the text.
    const japanCupRow = page.locator("tr").filter({ hasText: "Japan Cup" });

    await expect(japanCupRow.first()).toBeVisible();

    // Interact with the filter and assert the change.
    await page.getByLabel("G1", { exact: true }).uncheck();
    await expect(japanCupRow.first()).not.toBeVisible();

    // Re-enable the filter and assert the row reappears.
    await page.getByLabel("G1", { exact: true }).check();
    await expect(japanCupRow.first()).toBeVisible();
  });

  test("should filter by Year", async ({ page }) => {
    // Locate a race known to be in Classic year and one in Senior year.
    const classicArimaKinen = page
      .locator("tr")
      .filter({ hasText: "Classic Year - December - Late" });
    const seniorFebruaryStakes = page
      .locator("tr")
      .filter({ hasText: "February Stakes" });

    // Assert both are visible initially.
    await expect(classicArimaKinen.first()).toBeVisible();
    await expect(seniorFebruaryStakes).toBeVisible();

    // Uncheck "Senior Year" and assert only the senior race disappears.
    await page.getByLabel("Senior Year").uncheck();
    await expect(seniorFebruaryStakes).not.toBeVisible();
    await expect(classicArimaKinen.first()).toBeVisible();
  });

  test("should filter by Track", async ({ page }) => {
    const dirtChampionsCup = page
      .locator("tr")
      .filter({ hasText: "Champions Cup" });
    const turfYasudaKinen = page
      .locator("tr")
      .filter({ hasText: "Yasuda Kinen" });

    await page.getByLabel("Dirt").uncheck();
    await expect(dirtChampionsCup).not.toBeVisible();
    await expect(turfYasudaKinen.first()).toBeVisible();
  });

  test("should filter by a combination of criteria", async ({ page }) => {
    // Uncheck multiple filters.
    await page.getByLabel("G2").uncheck();
    await page.getByLabel("G3").uncheck();
    await page.getByLabel("Dirt").uncheck();
    await page.getByLabel("Senior Year").uncheck();

    // Assert that a race matching the unchecked criteria is not visible.
    const g2race = page.locator("tr").filter({ hasText: "Kyoto Shimbun Hai" });
    await expect(g2race).not.toBeVisible();

    // Assert that a race that still matches the active filters is visible.
    const g1race = page.locator("tr").filter({ hasText: "Arima Kinen" });
    await expect(g1race.first()).toBeVisible();
  });

  test("should hide unsuitable races based on aptitude filters", async ({
    page,
  }) => {
    // Oguri Cap has 'B' aptitude for Mile. Yasuda Kinen is a Mile race.
    const yasudaKinenRow = page
      .locator("tr")
      .filter({ hasText: "Yasuda Kinen" });

    // Initially, the race is visible, but NOT highlighted because the default filter is 'A' and Oguri's Mile is 'B'.
    await expect(yasudaKinenRow.first()).toBeVisible();
    await expect(yasudaKinenRow.first()).not.toHaveClass(/highlighted-race/);

    // Uncheck "Hide Unsuitable Races" to ensure it stays visible for the next step.
    await page.getByLabel("Hide Unsuitable Races").uncheck();

    // Change the distance aptitude filter to require 'C' or better.
    // Oguri Cap's 'B' is now sufficient, so it should become highlighted.
    await page.getByLabel("Dist. Apt. ≥").selectOption("C");
    await expect(yasudaKinenRow.first()).toHaveClass(/highlighted-race/);

    // Now, check "Hide Unsuitable Races" again.
    await page.getByLabel("Hide Unsuitable Races").check();
    // And set the filter back to 'A', making it unsuitable.
    await page.getByLabel("Dist. Apt. ≥").selectOption("A");

    // The row should now disappear.
    await expect(yasudaKinenRow.first()).not.toBeVisible();
  });

  test("should show only selected races when toggled", async ({ page }) => {
    const allRowsInTbody = page.locator("tbody tr");
    await expect(allRowsInTbody.first()).toBeVisible();
    const initialRowCount = await allRowsInTbody.count();
    expect(initialRowCount).toBeGreaterThan(10); // Sanity check

    // Select an optional race known not to be a career race for Oguri Cap.
    const optionalRaceRow = page
      .locator("tr")
      .filter({ hasText: "Satsuki Sho" });
    await optionalRaceRow.getByRole("checkbox").check();

    await page.getByLabel("Show Only Selected Races").check();

    // Oguri Cap has 9 career races + 1 optional = 10 selected.
    await expect(allRowsInTbody).toHaveCount(10);
    await expect(optionalRaceRow).toBeVisible();
  });
});
