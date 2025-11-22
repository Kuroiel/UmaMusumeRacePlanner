import { test, expect } from "@playwright/test";

test.describe("Race Filtering Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");

    const searchInput = page.getByPlaceholder("Search...");
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

    await page.getByLabel("G1", { exact: true }).uncheck();
    await expect(tennoautumnRow.first()).not.toBeVisible();

    await page.getByLabel("G1", { exact: true }).check();
    await expect(tennoautumnRow.first()).toBeVisible();
  });

  test("should filter by Year", async ({ page }) => {
    const classicTakarazukaKinen = page
      .locator("tr")
      .filter({ hasText: "Classic Year - June - Late" });
    const osakaHai = page.locator("tr").filter({ hasText: "Osaka Hai" });

    await expect(classicTakarazukaKinen.first()).toBeVisible();
    await expect(osakaHai.first()).toBeVisible();

    await page.getByLabel("Senior Year").uncheck();
    await expect(osakaHai.first()).not.toBeVisible();
    await expect(classicTakarazukaKinen.first()).toBeVisible();
  });

  test("should filter by Track", async ({ page }) => {
    const turfRace = page.locator("tr").filter({ hasText: "Satsuki Sho" });
    await expect(turfRace).toBeVisible();

    await page.getByLabel("Turf").uncheck();
    await expect(turfRace).not.toBeVisible();
  });

  test("should filter by a combination of criteria", async ({ page }) => {
    await page.getByLabel("G2").uncheck();
    await page.getByLabel("G3").uncheck();
    await page.getByLabel("Dirt").uncheck();
    await page.getByLabel("Senior Year").uncheck();

    const g2race = page.locator("tr").filter({ hasText: "Aoba Sho" }); // G2
    await expect(g2race).not.toBeVisible();

    const g1race = page.locator("tr").filter({ hasText: "Satsuki Sho" });
    await expect(g1race).toBeVisible();
  });

  test("should hide unsuitable races based on aptitude filters", async ({
    page,
  }) => {
    const yasudaKinenRow = page
      .locator("tr")
      .filter({ hasText: "Yasuda Kinen" });
    const hideUnsuitableToggle = page.getByLabel("Hide Unsuitable Races");

    await hideUnsuitableToggle.uncheck();

    await expect(yasudaKinenRow.first()).toBeVisible();
    await expect(yasudaKinenRow.first()).not.toHaveClass(/highlighted-race/);

    await page
      .locator("div.aptitude-filter-item", { hasText: "Dist. Apt. ≥" })
      .locator("select")
      .selectOption("C");
    await expect(yasudaKinenRow.first()).toHaveClass(/highlighted-race/);

    await hideUnsuitableToggle.check();
    await page
      .locator("div.aptitude-filter-item", { hasText: "Dist. Apt. ≥" })
      .locator("select")
      .selectOption("A");

    await expect(yasudaKinenRow.first()).not.toBeVisible();
  });

  test("should show only selected races when toggled", async ({ page }) => {
    const allRowsInTbody = page.locator("tbody tr");
    await expect(allRowsInTbody.first()).toBeVisible();
    const initialRowCount = await allRowsInTbody.count();
    expect(initialRowCount).toBeGreaterThan(6);

    const optionalRaceRow = page
      .locator("tr")
      .filter({ hasText: "Hopeful Stakes" });
    await optionalRaceRow.first().getByRole("checkbox").check();

    await page.getByLabel("Show Only Selected Races").check();

    await expect(allRowsInTbody).toHaveCount(7);
    await expect(optionalRaceRow.first()).toBeVisible();
  });

  test("should filter by race name search term", async ({ page }) => {
    const arimaKinenRows = page.locator("tr", { hasText: "Arima Kinen" });
    await expect(arimaKinenRows).toHaveCount(2);

    await page.getByLabel("Always Show Career Races").uncheck();

    const raceSearchInput = page.getByPlaceholder("Search race name...");
    await raceSearchInput.pressSequentially("Tenno Sho (Autumn)", {
      delay: 30,
    });

    const tennoautumnRow = page.locator("tr", {
      hasText: "Tenno Sho (Autumn)",
    });
    await expect(tennoautumnRow).toBeVisible();
    await expect(tennoautumnRow).toHaveCount(1);
    await expect(arimaKinenRows.first()).not.toBeVisible();

    await raceSearchInput.fill("");
    await expect(arimaKinenRows.first()).toBeVisible();
    await expect(tennoautumnRow).toBeVisible();
  });

  test("'Always Show Career Races' should override other filters", async ({
    page,
  }) => {
    const careerRace = page.locator("tr").filter({ hasText: "Japanese Derby" });
    const alwaysShowToggle = page.getByLabel("Always Show Career Races");

    await expect(alwaysShowToggle).toBeChecked();
    await expect(careerRace).toBeVisible();

    await page.getByLabel("G1", { exact: true }).uncheck();
    await expect(careerRace).toBeVisible();

    await alwaysShowToggle.uncheck();
    await expect(careerRace).not.toBeVisible();

    await alwaysShowToggle.check();
    await expect(careerRace).toBeVisible();
  });
});
