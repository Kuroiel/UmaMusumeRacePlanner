import { test, expect } from "@playwright/test";

test.describe.serial("Character Selection and Career Loading", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should filter list by partial name and select a character", async ({
    page,
  }) => {
    const partialName = "Mejiro";
    const characterName = "Mejiro McQueen (Original)";
    const searchInput = page.getByPlaceholder("Search...");

    await searchInput.pressSequentially(partialName, { delay: 50 });

    const characterOption = page.locator(".character-list li", {
      hasText: characterName,
    });
    await expect(characterOption).toBeVisible();
    await characterOption.click();

    await expect(searchInput).toHaveValue(characterName);

    await expect(
      page.getByRole("heading", { name: "2. Edit Aptitudes" })
    ).toBeVisible();

    const tennoShoRow = page
      .locator("tr")
      .filter({ hasText: "Tenno Sho (Spring)" })
      .first();
    await expect(tennoShoRow).toBeVisible();

    const checkbox = tennoShoRow.getByRole("checkbox");
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toBeDisabled();

    await expect(page.locator(".grade-counter")).toContainText("G1: 4");
  });

  test("should handle switching characters and resetting optional races", async ({
    page,
  }) => {
    const searchInput = page.getByPlaceholder("Search...");
    const firstCharName = "Daiwa Scarlet (Original)";
    const secondCharName = "Vodka (Original)";

    await searchInput.pressSequentially("Daiwa Scarlet", { delay: 50 });
    await page
      .locator(".character-list li", { hasText: firstCharName })
      .click();

    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (8)"
    );

    const optionalRaceRow = page
      .locator("tr")
      .filter({ hasText: "Hopeful Stakes" });
    await optionalRaceRow.getByRole("checkbox").check();

    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (9)"
    );

    await searchInput.fill("Vodka");
    await page
      .locator(".character-list li", { hasText: secondCharName })
      .click();

    const modal = page.getByRole("dialog", { name: "Switch Character" });
    await expect(modal).toBeVisible();
    await page.getByRole("button", { name: "Reset Optional" }).click();

    await expect(modal).not.toBeVisible();
    await expect(searchInput).toHaveValue(secondCharName);
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (9)"
    );
  });

  test("should handle switching characters and keeping optional races", async ({
    page,
  }) => {
    const searchInput = page.getByPlaceholder("Search...");
    const firstCharName = "Daiwa Scarlet (Original)";
    const secondCharName = "Vodka (Original)";

    await searchInput.pressSequentially("Daiwa Scarlet", { delay: 50 });
    await page
      .locator(".character-list li", { hasText: firstCharName })
      .click();
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (8)"
    );

    const optionalRaceRow = page
      .locator("tr")
      .filter({ hasText: "Hopeful Stakes" });
    await optionalRaceRow.getByRole("checkbox").check();
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (9)"
    );

    await searchInput.fill("Vodka");
    await page
      .locator(".character-list li", { hasText: secondCharName })
      .click();

    const modal = page.getByRole("dialog", { name: "Switch Character" });
    await expect(modal).toBeVisible();
    await page.getByRole("button", { name: "Keep Optional" }).click();

    await expect(modal).not.toBeVisible();
    await expect(searchInput).toHaveValue(secondCharName);
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (10)"
    );

    await expect(optionalRaceRow).toBeVisible();
    await expect(optionalRaceRow.getByRole("checkbox")).toBeChecked();
  });

  test("should show no results for a name that does not exist", async ({
    page,
  }) => {
    const searchInput = page.getByPlaceholder("Search...");
    await searchInput.pressSequentially("NonExistentCharacter", { delay: 50 });

    const suggestionList = page.locator("ul.character-list");
    await expect(suggestionList).toBeEmpty();
  });
});
