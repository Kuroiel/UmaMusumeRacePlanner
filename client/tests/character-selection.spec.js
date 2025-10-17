// tests/character-selection.spec.js
import { test, expect } from "@playwright/test";

test.describe("Character Selection and Career Loading", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should filter list by partial name and select a character", async ({
    page,
  }) => {
    const partialName = "Mejiro";
    const characterName = "Mejiro McQueen (Original)";
    const searchInput = page.getByPlaceholder("Search...");

    // Type slowly to simulate a user and allow the app to react.
    await searchInput.pressSequentially(partialName, { delay: 50 });

    // Use a more direct locator strategy for the character in the suggestion list.
    const characterOption = page.locator(".character-list li", {
      hasText: characterName,
    });
    await expect(characterOption).toBeVisible();
    await characterOption.click();

    // Assert that the search input now contains the full character name.
    await expect(searchInput).toHaveValue(characterName);

    // Assert that the rest of the UI has loaded for this character.
    await expect(
      page.getByRole("heading", { name: "2. Edit Aptitudes" })
    ).toBeVisible();

    // Use a more robust locator strategy for finding the race in the table.
    // This finds a `<tr>` that contains the text "Tenno Sho (Spring)".
    const tennoShoRow = page
      .locator("tr")
      .filter({ hasText: "Tenno Sho (Spring)" })
      .first();
    await expect(tennoShoRow).toBeVisible();

    // Verify the career race is correctly checked and disabled.
    const checkbox = tennoShoRow.getByRole("checkbox");
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toBeDisabled();

    // Verify the grade counter reflects the loaded career races.
    await expect(page.locator(".grade-counter")).toContainText("G1: 4");
  });

  test("should handle switching characters and resetting optional races", async ({
    page,
  }) => {
    const searchInput = page.getByPlaceholder("Search...");
    const firstCharName = "Daiwa Scarlet (Original)";
    const secondCharName = "Vodka (Original)";

    // Select the first character.
    await searchInput.pressSequentially("Daiwa Scarlet", { delay: 50 });
    await page
      .locator(".character-list li", { hasText: firstCharName })
      .click();

    // Wait for the checklist button to update and reflect the initial career races.
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (8)"
    );

    // Find and select an optional race.
    const optionalRaceRow = page
      .locator("tr")
      .filter({ hasText: "Hopeful Stakes" });
    await optionalRaceRow.getByRole("checkbox").check();

    // Assert that the checklist count has incremented.
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (9)"
    );

    // Search for and select the second character.
    await searchInput.fill("Vodka");
    await page
      .locator(".character-list li", { hasText: secondCharName })
      .click();

    // The confirmation modal should appear.
    const modal = page.getByRole("dialog", { name: "Switch Character" });
    await expect(modal).toBeVisible();
    await page.getByRole("button", { name: "Reset Optional" }).click();

    // Assert the modal is gone and the state has been updated.
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

    // Select the first character.
    await searchInput.pressSequentially("Daiwa Scarlet", { delay: 50 });
    await page
      .locator(".character-list li", { hasText: firstCharName })
      .click();
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (8)"
    );

    // Find and select an optional race.
    const optionalRaceRow = page
      .locator("tr")
      .filter({ hasText: "Hopeful Stakes" });
    await optionalRaceRow.getByRole("checkbox").check();
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (9)"
    );

    // Search for and select the second character.
    await searchInput.fill("Vodka");
    await page
      .locator(".character-list li", { hasText: secondCharName })
      .click();

    // The confirmation modal should appear.
    const modal = page.getByRole("dialog", { name: "Switch Character" });
    await expect(modal).toBeVisible();
    await page.getByRole("button", { name: "Keep Optional" }).click();

    // Assert the modal is gone and the state reflects the kept race.
    await expect(modal).not.toBeVisible();
    await expect(searchInput).toHaveValue(secondCharName);
    await expect(page.locator(".generate-button")).toContainText(
      "View Checklist (10)"
    );

    // Verify the kept race is still visible and checked.
    await expect(optionalRaceRow).toBeVisible();
    await expect(optionalRaceRow.getByRole("checkbox")).toBeChecked();
  });

  test("should show no results for a name that does not exist", async ({
    page,
  }) => {
    const searchInput = page.getByPlaceholder("Search...");
    await searchInput.pressSequentially("NonExistentCharacter", { delay: 50 });

    const suggestionList = page.locator("ul.character-list");
    // Assert that the list of character suggestions is empty.
    await expect(suggestionList).toBeEmpty();
  });
});
