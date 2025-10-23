import { test, expect } from "@playwright/test";

test.describe("Race Filtering Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    const searchInput = page.getByPlaceholder("Search...");
    // Switch to Special Week. They have a 'C' in Mile, which is perfect for the aptitude test.
    await searchInput.pressSequentially("Special Week (Original)", {
      delay: 30,
    });
    await searchInput.press("Enter");

    await expect(searchInput).toHaveValue("Special Week (Original)");
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });

  test("should filter by Grade", async ({ page }) => {
    const tennoautumnRow = page
      .locator("tr")
      .filter({ hasText: "Tenno Sho (Autumn)" });

    await expect(tennoautumnRow.first()).toBeVisible();

    // Interact with the filter and assert the change.
    await page.getByLabel("G1", { exact: true }).uncheck();
    await expect(tennoautumnRow.first()).not.toBeVisible();

    // Re-enable the filter and assert the row reappears.
    await page.getByLabel("G1", { exact: true }).check();
    await expect(tennoautumnRow.first()).toBeVisible();
  });

  test("should filter by Year", async ({ page }) => {
    // Locate a race known to be in Classic year and one in Senior year.
    const classicTakarazukaKinen = page
      .locator("tr")
      .filter({ hasText: "Classic Year - June - Late" });
    const osakaHai = page.locator("tr").filter({ hasText: "Osaka Hai" });

    // Assert both are visible initially.
    await expect(classicTakarazukaKinen.first()).toBeVisible();
    await expect(osakaHai.first()).toBeVisible();

    // Uncheck "Senior Year" and assert only the senior race disappears.
    await page.getByLabel("Senior Year").uncheck();
    await expect(osakaHai.first()).not.toBeVisible();
    await expect(classicTakarazukaKinen.first()).toBeVisible();
  });

  test("should filter by Track", async ({ page }) => {
    // Special Week has no Dirt races, so we'll test by hiding Turf.
    const turfRace = page.locator("tr").filter({ hasText: "Satsuki Sho" });
    await expect(turfRace).toBeVisible();

    await page.getByLabel("Turf").uncheck();
    await expect(turfRace).not.toBeVisible();
  });

  test("should filter by a combination of criteria", async ({ page }) => {
    // Uncheck multiple filters.
    await page.getByLabel("G2").uncheck();
    await page.getByLabel("G3").uncheck();
    await page.getByLabel("Dirt").uncheck();
    await page.getByLabel("Senior Year").uncheck();

    // Assert that a race matching the unchecked criteria is not visible.
    const g2race = page.locator("tr").filter({ hasText: "Aoba Sho" }); // G2
    await expect(g2race).not.toBeVisible();

    // Assert that a race that still matches the active filters is visible (Classic Year G1s).
    const g1race = page.locator("tr").filter({ hasText: "Satsuki Sho" });
    await expect(g1race).toBeVisible();
  });

  test("should hide unsuitable races based on aptitude filters", async ({
    page,
  }) => {
    // Special Week has 'C' aptitude for Mile. Yasuda Kinen is a Mile race.
    const yasudaKinenRow = page
      .locator("tr")
      .filter({ hasText: "Yasuda Kinen" });
    const hideUnsuitableToggle = page.getByLabel("Hide Unsuitable Races");

    // CRITICAL FIX: The "Hide Unsuitable" filter is on by default.
    // We must turn it OFF to make the unsuitable race appear for the test.
    await hideUnsuitableToggle.uncheck();

    // Now that it's visible, we can assert its initial state.
    // It should NOT be highlighted because the default filter is 'A' and Special Week's Mile is 'C'.
    await expect(yasudaKinenRow.first()).toBeVisible();
    await expect(yasudaKinenRow.first()).not.toHaveClass(/highlighted-race/);

    // Change the distance aptitude filter to require 'C' or better.
    // Special Week's 'C' is now sufficient, so it should become highlighted.
    await page
      .locator("div.aptitude-filter-item", { hasText: "Dist. Apt. ≥" })
      .locator("select")
      .selectOption("C");
    await expect(yasudaKinenRow.first()).toHaveClass(/highlighted-race/);

    // Now, turn the "Hide Unsuitable" toggle back ON.
    await hideUnsuitableToggle.check();
    // And set the filter back to 'A', making the race unsuitable again.
    await page
      .locator("div.aptitude-filter-item", { hasText: "Dist. Apt. ≥" })
      .locator("select")
      .selectOption("A");

    // The row should now disappear because the toggle is active.
    await expect(yasudaKinenRow.first()).not.toBeVisible();
  });

  test("should show only selected races when toggled", async ({ page }) => {
    const allRowsInTbody = page.locator("tbody tr");
    await expect(allRowsInTbody.first()).toBeVisible();
    const initialRowCount = await allRowsInTbody.count();
    expect(initialRowCount).toBeGreaterThan(6); // Sanity check

    // Select an optional race known not to be a career race for Special Week.
    const optionalRaceRow = page
      .locator("tr")
      .filter({ hasText: "Hopeful Stakes" });
    await optionalRaceRow.first().getByRole("checkbox").check();

    await page.getByLabel("Show Only Selected Races").check();

    // Special Week has 9 career races + 1 optional = 10 selected.
    await expect(allRowsInTbody).toHaveCount(7);
    await expect(optionalRaceRow.first()).toBeVisible();
  });

  test("should filter by race name search term", async ({ page }) => {
    // There are two "Arima Kinen" races visible by default for Special Week
    const arimaKinenRows = page.locator("tr", { hasText: "Arima Kinen" });
    await expect(arimaKinenRows).toHaveCount(2);

    // FIX: Disable the career race override to properly test the search filter in isolation.
    await page.getByLabel("Always Show Career Races").uncheck();

    // Search for a specific race
    const raceSearchInput = page.getByPlaceholder("Search race name...");
    await raceSearchInput.pressSequentially("Tenno Sho (Autumn)", {
      delay: 30,
    });

    // Only the Tenno Sho (Autumn) should be visible
    const tennoautumnRow = page.locator("tr", {
      hasText: "Tenno Sho (Autumn)",
    });
    await expect(tennoautumnRow).toBeVisible();
    await expect(tennoautumnRow).toHaveCount(1);
    await expect(arimaKinenRows.first()).not.toBeVisible();

    // Clear the search
    await raceSearchInput.fill("");
    await expect(arimaKinenRows.first()).toBeVisible();
    await expect(tennoautumnRow).toBeVisible();
  });

  test("'Always Show Career Races' should override other filters", async ({
    page,
  }) => {
    // Special Week's career includes the G1 Japanese Derby.
    const careerRace = page.locator("tr").filter({ hasText: "Japanese Derby" });
    const alwaysShowToggle = page.getByLabel("Always Show Career Races");

    // Initially, the toggle is on and the race is visible.
    await expect(alwaysShowToggle).toBeChecked();
    await expect(careerRace).toBeVisible();

    // Turn off G1 races. The career race should STILL be visible because the toggle is on.
    await page.getByLabel("G1", { exact: true }).uncheck();
    await expect(careerRace).toBeVisible();

    // Now, turn off the "Always Show" toggle. The career race should now disappear.
    await alwaysShowToggle.uncheck();
    await expect(careerRace).not.toBeVisible();

    // Turn the toggle back on. The race should reappear, even with G1s filtered out.
    await alwaysShowToggle.check();
    await expect(careerRace).toBeVisible();
  });
});
